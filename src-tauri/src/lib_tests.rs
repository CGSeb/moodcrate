use super::*;
use super::storage::{
    data_path_from_base, load_data_file, load_named_data, moodcrate_base_dir_from_paths,
    moodcrate_data_dir_from_base, resolve_moodcrate_file_path, save_data_file, save_named_data,
};
use super::thumbnails::{
    clear_collection_cache_from_app_data, clear_collection_cache_in_dir, file_mod_epoch,
    generate_thumbnail_from_app_data, generate_thumbnail_to_cache, generate_thumbnail_with_cache_dir,
    resolve_thumbnail_cache_dir, thumbnail_cache_dir_from_base, thumbnail_cache_key,
};
use image::{DynamicImage, RgbaImage};
use std::sync::atomic::{AtomicU64, Ordering};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

struct TestDir {
    path: PathBuf,
}

impl TestDir {
    fn new(prefix: &str) -> Self {
        let unique = format!(
            "{}_{}_{}_{}",
            prefix,
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system clock should be after unix epoch")
                .as_nanos(),
            TEST_COUNTER.fetch_add(1, Ordering::Relaxed)
        );
        let path = std::env::temp_dir().join(unique);
        fs::create_dir_all(&path).expect("temporary test directory should be created");
        Self { path }
    }

    fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for TestDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

fn sample_rgba_image(width: u32, height: u32) -> DynamicImage {
    let pixels = vec![255u8, 0, 0, 255]
        .into_iter()
        .cycle()
        .take((width * height * 4) as usize)
        .collect::<Vec<_>>();
    let image = RgbaImage::from_raw(width, height, pixels)
        .expect("rgba image should be constructed");
    DynamicImage::ImageRgba8(image)
}

fn write_png(path: &Path) {
    let png = png_encode(&sample_rgba_image(2, 2)).expect("png should encode");
    fs::write(path, png).expect("png fixture should be written");
}

fn write_png_with_size(path: &Path, width: u32, height: u32) {
    let png = png_encode(&sample_rgba_image(width, height)).expect("png should encode");
    fs::write(path, png).expect("png fixture should be written");
}

fn write_jpeg(path: &Path) {
    let image = sample_rgba_image(2, 2);
    let mut bytes = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut bytes);
    image
        .write_to(&mut cursor, image::ImageFormat::Jpeg)
        .expect("jpeg should encode");
    fs::write(path, bytes).expect("jpeg fixture should be written");
}

#[test]
fn mime_lookup_covers_supported_and_unknown_extensions() {
    assert_eq!(mime_for_ext("jpg"), "image/jpeg");
    assert_eq!(mime_for_ext("png"), "image/png");
    assert_eq!(mime_for_ext("gif"), "image/gif");
    assert_eq!(mime_for_ext("webp"), "image/webp");
    assert_eq!(mime_for_ext("svg"), "image/svg+xml");
    assert_eq!(mime_for_ext("bmp"), "image/bmp");
    assert_eq!(mime_for_ext("tiff"), "image/tiff");
    assert_eq!(mime_for_ext("tif"), "image/tiff");
    assert_eq!(mime_for_ext("avif"), "image/avif");
    assert_eq!(mime_for_ext("unknown"), "application/octet-stream");
}

#[test]
fn moodcrate_base_dir_from_paths_prefers_document_dir_and_falls_back_to_local_dir() {
    let document_dir = PathBuf::from("C:\\documents");
    let local_dir = PathBuf::from("C:\\local");

    let preferred = moodcrate_base_dir_from_paths(Ok(document_dir.clone()), Ok(local_dir.clone()))
        .expect("document dir should be preferred");
    let fallback = moodcrate_base_dir_from_paths(
        Err("documents unavailable".to_string()),
        Ok(local_dir.clone()),
    )
    .expect("local dir should be used as a fallback");

    assert_eq!(preferred, document_dir);
    assert_eq!(fallback, local_dir);
}

#[test]
fn moodcrate_base_dir_from_paths_propagates_fallback_errors() {
    let error = moodcrate_base_dir_from_paths(
        Err("documents unavailable".to_string()),
        Err("local data unavailable".to_string()),
    )
    .expect_err("missing base paths should fail");

    assert_eq!(error, "local data unavailable");
}

#[test]
fn list_images_filters_supported_files_and_sorts_results() {
    let dir = TestDir::new("list_images");
    write_png(&dir.path().join("zebra.PNG"));
    write_png(&dir.path().join("alpha.png"));
    fs::write(dir.path().join("notes.txt"), b"ignore me").expect("text fixture should be written");
    fs::create_dir_all(dir.path().join("nested")).expect("nested directory should be created");

    let images = list_images(dir.path().to_str().expect("temp path should be utf-8"))
        .expect("listing images should succeed");

    assert_eq!(images.len(), 2);
    assert!(images[0].ends_with("alpha.png"));
    assert!(images[1].ends_with("zebra.PNG"));
}

#[test]
fn list_images_skips_files_without_supported_extensions() {
    let dir = TestDir::new("list_images_no_extension");
    write_png(&dir.path().join("keep.png"));
    fs::write(dir.path().join("README"), b"ignore me").expect("extensionless fixture should be written");

    let images = list_images(dir.path().to_str().expect("temp path should be utf-8"))
        .expect("listing images should succeed");

    assert_eq!(images.len(), 1);
    assert!(images[0].ends_with("keep.png"));
}

#[test]
fn list_images_errors_for_non_directory_paths() {
    let dir = TestDir::new("list_images_error");
    let file_path = dir.path().join("single.png");
    write_png(&file_path);

    let error = list_images(file_path.to_str().expect("temp path should be utf-8"))
        .expect_err("listing a file path should fail");

    assert!(error.contains("Not a directory"));
}

#[test]
fn read_image_returns_a_png_data_url() {
    let dir = TestDir::new("read_image");
    let file_path = dir.path().join("sample.png");
    write_png(&file_path);

    let data_url = read_image(file_path.to_str().expect("temp path should be utf-8"))
        .expect("reading image should succeed");

    assert!(data_url.starts_with("data:image/png;base64,"));
}

#[test]
fn read_image_errors_for_missing_files() {
    let dir = TestDir::new("read_image_missing");
    let missing_path = dir.path().join("missing.png");

    let error = read_image(missing_path.to_str().expect("temp path should be utf-8"))
        .expect_err("reading a missing image should fail");

    assert!(!error.is_empty());
}

#[test]
fn read_image_uses_file_extension_and_png_default_when_missing() {
    let dir = TestDir::new("read_image_extensions");
    let jpeg_path = dir.path().join("sample.jpg");
    let extensionless_path = dir.path().join("sample");
    write_jpeg(&jpeg_path);
    write_png(&extensionless_path);

    let jpeg_data_url = read_image(jpeg_path.to_str().expect("temp path should be utf-8"))
        .expect("reading jpeg should succeed");
    let default_data_url = read_image(extensionless_path.to_str().expect("temp path should be utf-8"))
        .expect("reading extensionless png should succeed");

    assert!(jpeg_data_url.starts_with("data:image/jpeg;base64,"));
    assert!(default_data_url.starts_with("data:image/png;base64,"));
}

#[test]
fn moodcrate_data_dir_from_base_creates_the_app_directory() {
    let dir = TestDir::new("moodcrate_data_dir");

    let app_dir = moodcrate_data_dir_from_base(dir.path()).expect("app data dir should be created");

    assert!(app_dir.is_dir());
    assert_eq!(app_dir.file_name().and_then(|name| name.to_str()), Some("Moodcrate"));
}

#[test]
fn moodcrate_data_dir_from_base_reuses_existing_app_directory() {
    let dir = TestDir::new("moodcrate_existing_dir");
    let existing_dir = dir.path().join("Moodcrate");
    fs::create_dir_all(&existing_dir).expect("existing app directory should be created");

    let app_dir = moodcrate_data_dir_from_base(dir.path()).expect("existing app data dir should be reused");

    assert_eq!(app_dir, existing_dir);
}

#[test]
fn tags_and_moodboards_paths_use_expected_filenames() {
    let dir = TestDir::new("data_paths");
    let app_dir = moodcrate_data_dir_from_base(dir.path()).expect("app data dir should be created");

    assert!(data_path_from_base(&app_dir, "custom.json").ends_with("custom.json"));
    assert!(data_path_from_base(&app_dir, "tags.json").ends_with("tags.json"));
    assert!(data_path_from_base(&app_dir, "moodboards.json").ends_with("moodboards.json"));
}

#[test]
fn resolve_moodcrate_file_path_uses_document_dir_and_filename() {
    let dir = TestDir::new("resolve_moodcrate_file_path");

    let path = resolve_moodcrate_file_path(
        Ok(dir.path().to_path_buf()),
        Err("unused".to_string()),
        "tags.json",
    )
    .expect("moodcrate file path should resolve");

    assert!(path.ends_with(Path::new("Moodcrate").join("tags.json")));
}

#[test]
fn load_named_data_uses_local_dir_fallback() {
    let dir = TestDir::new("load_named_data_local");
    let file_path = dir.path().join("Moodcrate").join("tags.json");
    fs::create_dir_all(file_path.parent().expect("file should have a parent"))
        .expect("moodcrate directory should be created");
    fs::write(&file_path, "{\"tags\":2}").expect("fixture data should be written");

    let data = load_named_data(
        Err("document dir unavailable".to_string()),
        Ok(dir.path().to_path_buf()),
        "tags.json",
    )
    .expect("named data should load from local fallback");

    assert_eq!(data, "{\"tags\":2}");
}

#[test]
fn save_named_data_creates_moodcrate_dir_under_document_dir() {
    let dir = TestDir::new("save_named_data_document");

    save_named_data(
        Ok(dir.path().to_path_buf()),
        Err("local dir unavailable".to_string()),
        "moodboards.json",
        "{\"boards\":1}",
    )
    .expect("named data should save under document dir");

    let file_path = dir.path().join("Moodcrate").join("moodboards.json");
    let saved = fs::read_to_string(file_path).expect("saved data should be readable");
    assert_eq!(saved, "{\"boards\":1}");
}

#[test]
fn load_data_file_returns_empty_string_for_missing_files() {
    let dir = TestDir::new("load_data_file_empty");
    let file_path = dir.path().join("missing.json");

    let data = load_data_file(&file_path).expect("missing files should return an empty string");

    assert!(data.is_empty());
}

#[test]
fn save_data_file_and_load_data_file_round_trip_contents() {
    let dir = TestDir::new("data_round_trip");
    let file_path = dir.path().join("tags.json");

    save_data_file(&file_path, "{\"tags\":1}").expect("data file should be written");
    let data = load_data_file(&file_path).expect("data file should be read");

    assert_eq!(data, "{\"tags\":1}");
}

#[test]
fn import_files_copies_files_and_renames_collisions() {
    let source_dir = TestDir::new("import_copy_source");
    let target_dir = TestDir::new("import_copy_target");
    let source_path = source_dir.path().join("ref.png");
    write_png(&source_path);
    write_png(&target_dir.path().join("ref.png"));

    let imported = import_files(
        vec![source_path.to_str().expect("temp path should be utf-8").to_string()],
        target_dir.path().to_str().expect("temp path should be utf-8").to_string(),
        "copy".to_string(),
    )
    .expect("copy import should succeed");

    assert_eq!(imported.len(), 1);
    assert!(imported[0].ends_with("ref_1.png"));
    assert!(source_path.is_file());
    assert!(target_dir.path().join("ref_1.png").is_file());
}

#[test]
fn import_files_errors_for_invalid_target_directories() {
    let source_dir = TestDir::new("import_invalid_target_source");
    let source_path = source_dir.path().join("ref.png");
    write_png(&source_path);
    let invalid_target = source_dir.path().join("missing-target");

    let error = import_files(
        vec![source_path.to_str().expect("temp path should be utf-8").to_string()],
        invalid_target.to_str().expect("temp path should be utf-8").to_string(),
        "copy".to_string(),
    )
    .expect_err("invalid target directories should fail");

    assert!(error.contains("Target is not a directory"));
}

#[test]
fn import_files_renames_extensionless_files_after_multiple_collisions() {
    let source_dir = TestDir::new("import_no_extension_source");
    let target_dir = TestDir::new("import_no_extension_target");
    let source_path = source_dir.path().join("reference");
    write_png(&source_path);
    write_png(&target_dir.path().join("reference"));
    write_png(&target_dir.path().join("reference_1"));

    let imported = import_files(
        vec![source_path.to_str().expect("temp path should be utf-8").to_string()],
        target_dir.path().to_str().expect("temp path should be utf-8").to_string(),
        "copy".to_string(),
    )
    .expect("copy import should succeed");

    assert_eq!(imported.len(), 1);
    assert!(imported[0].ends_with("reference_2"));
    assert!(target_dir.path().join("reference_2").is_file());
}

#[test]
fn import_files_moves_files_and_removes_originals() {
    let source_dir = TestDir::new("import_move_source");
    let target_dir = TestDir::new("import_move_target");
    let source_path = source_dir.path().join("moved.png");
    write_png(&source_path);

    let imported = import_files(
        vec![source_path.to_str().expect("temp path should be utf-8").to_string()],
        target_dir.path().to_str().expect("temp path should be utf-8").to_string(),
        "move".to_string(),
    )
    .expect("move import should succeed");

    assert_eq!(imported.len(), 1);
    assert!(imported[0].ends_with("moved.png"));
    assert!(!source_path.exists());
    assert!(target_dir.path().join("moved.png").is_file());
}

#[test]
fn import_files_skips_missing_sources() {
    let target_dir = TestDir::new("import_missing_target");
    let missing_path = target_dir.path().join("missing.png");

    let imported = import_files(
        vec![missing_path.to_str().expect("temp path should be utf-8").to_string()],
        target_dir.path().to_str().expect("temp path should be utf-8").to_string(),
        "copy".to_string(),
    )
    .expect("missing sources should be skipped without failing");

    assert!(imported.is_empty());
}

#[test]
fn import_result_to_paths_tracks_success_and_ignores_failures() {
    let dir = TestDir::new("import_result");
    let dest = dir.path().join("imported.png");
    let mut imported = Vec::new();

    import_result_to_paths(&mut imported, "source.png", &dest, Ok(()));
    import_result_to_paths(
        &mut imported,
        "source.png",
        &dest,
        Err(std::io::Error::other("copy failed")),
    );

    assert_eq!(imported, vec![dest.to_str().expect("temp path should be utf-8").to_string()]);
}

#[test]
fn save_clipboard_image_writes_a_png_file() {
    let target_dir = TestDir::new("clipboard_save");

    let saved_path = save_clipboard_image(
        vec![255, 0, 0, 255],
        1,
        1,
        target_dir.path().to_str().expect("temp path should be utf-8").to_string(),
    )
    .expect("clipboard image should be saved");

    let saved_path = PathBuf::from(saved_path);
    assert!(saved_path.is_file());
    assert_eq!(saved_path.extension().and_then(|ext| ext.to_str()), Some("png"));
}

#[test]
fn save_clipboard_image_errors_for_invalid_targets() {
    let target_dir = TestDir::new("clipboard_save_errors");
    let invalid_target = target_dir.path().join("missing");

    let error = save_clipboard_image(
        vec![255, 0, 0, 255],
        1,
        1,
        invalid_target.to_str().expect("temp path should be utf-8").to_string(),
    )
    .expect_err("invalid clipboard targets should fail");

    assert!(error.contains("Target is not a directory"));
}

#[test]
fn thumbnail_cache_dir_from_base_creates_the_cache_directory() {
    let dir = TestDir::new("thumbnail_cache_dir");

    let cache_dir = thumbnail_cache_dir_from_base(dir.path()).expect("cache dir should be created");

    assert!(cache_dir.is_dir());
    assert_eq!(cache_dir.file_name().and_then(|name| name.to_str()), Some("thumbnails"));
}

#[test]
fn thumbnail_cache_dir_from_base_reuses_existing_directory() {
    let dir = TestDir::new("thumbnail_cache_existing");
    let existing_dir = dir.path().join("thumbnails");
    fs::create_dir_all(&existing_dir).expect("existing cache directory should be created");

    let cache_dir = thumbnail_cache_dir_from_base(dir.path()).expect("existing cache dir should be reused");

    assert_eq!(cache_dir, existing_dir);
}

#[test]
fn resolve_thumbnail_cache_dir_creates_the_cache_subdirectory() {
    let dir = TestDir::new("resolve_thumbnail_cache_dir");

    let cache_dir = resolve_thumbnail_cache_dir(Ok(dir.path().to_path_buf()))
        .expect("cache directory should resolve");

    assert!(cache_dir.is_dir());
    assert!(cache_dir.ends_with("thumbnails"));
}

#[test]
fn file_mod_epoch_returns_some_for_existing_files_and_none_for_missing_files() {
    let dir = TestDir::new("file_mod_epoch");
    let existing_path = dir.path().join("alpha.png");
    let missing_path = dir.path().join("missing.png");
    write_png(&existing_path);

    let existing = file_mod_epoch(&existing_path);
    let missing = file_mod_epoch(&missing_path);

    assert!(existing.is_some());
    assert_eq!(missing, None);
}

#[test]
fn generate_thumbnail_to_cache_creates_and_reuses_a_cached_thumbnail() {
    let image_dir = TestDir::new("thumbnail_generation");
    let cache_dir = TestDir::new("thumbnail_generation_cache");
    let source_path = image_dir.path().join("large.png");
    write_png_with_size(&source_path, 800, 400);

    let first_path = generate_thumbnail_to_cache(
        cache_dir.path(),
        source_path.to_str().expect("temp path should be utf-8"),
        200,
    )
    .expect("thumbnail generation should succeed");

    let second_path = generate_thumbnail_to_cache(
        cache_dir.path(),
        source_path.to_str().expect("temp path should be utf-8"),
        200,
    )
    .expect("cached thumbnail lookup should succeed");

    assert_eq!(first_path, second_path);
    assert!(Path::new(&first_path).is_file());

    let cached = image::open(&first_path).expect("cached thumbnail should be readable");
    assert!(cached.width() <= 200);
    assert!(cached.height() <= 200);
}

#[test]
fn generate_thumbnail_to_cache_keeps_small_images_at_original_size() {
    let image_dir = TestDir::new("thumbnail_small_image");
    let cache_dir = TestDir::new("thumbnail_small_image_cache");
    let source_path = image_dir.path().join("small.png");
    write_png_with_size(&source_path, 50, 20);

    let cached_path = generate_thumbnail_to_cache(
        cache_dir.path(),
        source_path.to_str().expect("temp path should be utf-8"),
        200,
    )
    .expect("thumbnail generation should succeed");

    let cached = image::open(&cached_path).expect("cached thumbnail should be readable");
    assert_eq!((cached.width(), cached.height()), (50, 20));
}

#[test]
fn generate_thumbnail_to_cache_returns_svg_paths_unchanged() {
    let image_dir = TestDir::new("thumbnail_svg");
    let cache_dir = TestDir::new("thumbnail_svg_cache");
    let source_path = image_dir.path().join("vector.svg");
    fs::write(&source_path, r#"<svg xmlns="http://www.w3.org/2000/svg"></svg>"#)
        .expect("svg fixture should be written");

    let result = generate_thumbnail_to_cache(
        cache_dir.path(),
        source_path.to_str().expect("temp path should be utf-8"),
        200,
    )
    .expect("svg thumbnails should return the original path");

    assert_eq!(result, source_path.to_str().expect("temp path should be utf-8"));
}

#[test]
fn generate_thumbnail_to_cache_errors_for_missing_files() {
    let cache_dir = TestDir::new("thumbnail_missing_cache");
    let missing_path = cache_dir.path().join("missing.png");

    let error = generate_thumbnail_to_cache(
        cache_dir.path(),
        missing_path.to_str().expect("temp path should be utf-8"),
        200,
    )
    .expect_err("missing image paths should fail");

    assert!(error.contains("Not a file"));
}

#[test]
fn generate_thumbnail_to_cache_errors_for_invalid_image_contents() {
    let image_dir = TestDir::new("thumbnail_invalid_image");
    let cache_dir = TestDir::new("thumbnail_invalid_image_cache");
    let source_path = image_dir.path().join("broken.png");
    fs::write(&source_path, b"not an image").expect("invalid image fixture should be written");

    let error = generate_thumbnail_to_cache(
        cache_dir.path(),
        source_path.to_str().expect("temp path should be utf-8"),
        200,
    )
    .expect_err("invalid images should fail to decode");

    assert!(error.contains("Failed to decode image"));
}

#[test]
fn generate_thumbnail_with_cache_dir_uses_the_supplied_directory() {
    let image_dir = TestDir::new("thumbnail_helper_image");
    let cache_dir = TestDir::new("thumbnail_helper_cache");
    let source_path = image_dir.path().join("large.png");
    write_png_with_size(&source_path, 600, 300);

    let generated = generate_thumbnail_with_cache_dir(
        cache_dir.path().to_path_buf(),
        source_path.to_str().expect("temp path should be utf-8").to_string(),
        180,
    )
    .expect("thumbnail helper should succeed");

    assert!(generated.starts_with(cache_dir.path().to_str().expect("temp path should be utf-8")));
}

#[test]
fn generate_thumbnail_from_app_data_uses_app_data_dir() {
    let image_dir = TestDir::new("thumbnail_app_data_image");
    let app_data_dir = TestDir::new("thumbnail_app_data_root");
    let source_path = image_dir.path().join("app-data.png");
    write_png_with_size(&source_path, 640, 320);

    let generated = generate_thumbnail_from_app_data(
        Ok(app_data_dir.path().to_path_buf()),
        source_path.to_str().expect("temp path should be utf-8").to_string(),
        160,
    )
    .expect("app-data thumbnail generation should succeed");

    assert!(generated.starts_with(
        app_data_dir.path().join("thumbnails").to_str().expect("temp path should be utf-8")
    ));
}

#[test]
fn clear_collection_cache_in_dir_removes_matching_cached_files() {
    let collection_dir = TestDir::new("clear_cache_collection");
    let cache_dir = TestDir::new("clear_cache_cache");
    let image_path = collection_dir.path().join("alpha.png");
    let svg_path = collection_dir.path().join("vector.svg");
    write_png(&image_path);
    fs::write(&svg_path, r#"<svg xmlns="http://www.w3.org/2000/svg"></svg>"#)
        .expect("svg fixture should be written");

    let metadata = fs::metadata(&image_path).expect("image metadata should exist");
    let modified = metadata.modified().expect("modified time should exist");
    let mod_epoch = modified
        .duration_since(UNIX_EPOCH)
        .expect("modified time should be after unix epoch")
        .as_millis();
    let hash = thumbnail_cache_key(
        image_path.to_str().expect("temp path should be utf-8"),
        mod_epoch,
        400,
    );

    let png_cache = cache_dir.path().join(format!("{}.png", hash));
    let webp_cache = cache_dir.path().join(format!("{}.webp", hash));
    fs::write(&png_cache, b"png").expect("png cache fixture should be written");
    fs::write(&webp_cache, b"webp").expect("webp cache fixture should be written");

    let removed = clear_collection_cache_in_dir(
        cache_dir.path(),
        collection_dir.path().to_str().expect("temp path should be utf-8"),
    )
    .expect("cache clearing should succeed");

    assert_eq!(removed, 2);
    assert!(!png_cache.exists());
    assert!(!webp_cache.exists());
}

#[test]
fn clear_collection_cache_from_app_data_uses_cache_subdirectory() {
    let collection_dir = TestDir::new("clear_cache_app_data_collection");
    let app_data_dir = TestDir::new("clear_cache_app_data_root");
    let cache_dir = app_data_dir.path().join("thumbnails");
    fs::create_dir_all(&cache_dir).expect("thumbnail cache should be created");
    let image_path = collection_dir.path().join("alpha.png");
    write_png(&image_path);

    let metadata = fs::metadata(&image_path).expect("image metadata should exist");
    let modified = metadata.modified().expect("modified time should exist");
    let mod_epoch = modified
        .duration_since(UNIX_EPOCH)
        .expect("modified time should be after unix epoch")
        .as_millis();
    let hash = thumbnail_cache_key(
        image_path.to_str().expect("temp path should be utf-8"),
        mod_epoch,
        400,
    );

    let cached_path = cache_dir.join(format!("{}.png", hash));
    fs::write(&cached_path, b"png").expect("cache fixture should be written");

    let removed = clear_collection_cache_from_app_data(
        Ok(app_data_dir.path().to_path_buf()),
        collection_dir.path().to_str().expect("temp path should be utf-8"),
    )
    .expect("cache clearing should succeed");

    assert_eq!(removed, 1);
    assert!(!cached_path.exists());
}

#[test]
fn clear_collection_cache_in_dir_errors_for_invalid_collection_paths() {
    let cache_dir = TestDir::new("clear_cache_invalid");
    let invalid_path = cache_dir.path().join("missing");

    let error = clear_collection_cache_in_dir(
        cache_dir.path(),
        invalid_path.to_str().expect("temp path should be utf-8"),
    )
    .expect_err("invalid collection paths should fail");

    assert!(error.contains("Not a directory"));
}

#[test]
fn delete_image_removes_existing_files() {
    let dir = TestDir::new("delete_image");
    let file_path = dir.path().join("delete-me.png");
    write_png(&file_path);

    delete_image(file_path.to_str().expect("temp path should be utf-8").to_string())
        .expect("deleting image should succeed");

    assert!(!file_path.exists());
}

#[test]
fn delete_image_errors_for_missing_files() {
    let dir = TestDir::new("delete_image_missing");
    let missing_path = dir.path().join("missing.png");

    let error = delete_image(missing_path.to_str().expect("temp path should be utf-8").to_string())
        .expect_err("deleting a missing image should fail");

    assert!(error.contains("Not a file"));
}

#[test]
fn save_data_file_errors_when_parent_directory_is_missing() {
    let dir = TestDir::new("save_data_file_error");
    let file_path = dir.path().join("missing-parent").join("tags.json");

    let error = save_data_file(&file_path, "{}").expect_err("writing under a missing parent should fail");

    assert!(!error.is_empty());
}

#[test]
fn png_encode_returns_png_bytes() {
    let encoded = png_encode(&sample_rgba_image(2, 2)).expect("png should encode");

    assert!(encoded.starts_with(&[0x89, b'P', b'N', b'G']));
    assert!(!encoded.is_empty());
}
