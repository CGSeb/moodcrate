use super::*;
use image::{DynamicImage, RgbaImage};
use std::sync::atomic::{AtomicU64, Ordering};
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

#[test]
fn mime_lookup_covers_supported_and_unknown_extensions() {
    assert_eq!(mime_for_ext("jpg"), "image/jpeg");
    assert_eq!(mime_for_ext("svg"), "image/svg+xml");
    assert_eq!(mime_for_ext("unknown"), "application/octet-stream");
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
fn moodcrate_data_dir_from_base_creates_the_app_directory() {
    let dir = TestDir::new("moodcrate_data_dir");

    let app_dir = moodcrate_data_dir_from_base(dir.path()).expect("app data dir should be created");

    assert!(app_dir.is_dir());
    assert_eq!(app_dir.file_name().and_then(|name| name.to_str()), Some("Moodcrate"));
}

#[test]
fn tags_and_moodboards_paths_use_expected_filenames() {
    let dir = TestDir::new("data_paths");
    let app_dir = moodcrate_data_dir_from_base(dir.path()).expect("app data dir should be created");

    assert!(tags_data_path_from_base(&app_dir).ends_with("tags.json"));
    assert!(moodboards_data_path_from_base(&app_dir).ends_with("moodboards.json"));
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
fn thumbnail_cache_dir_from_base_creates_the_cache_directory() {
    let dir = TestDir::new("thumbnail_cache_dir");

    let cache_dir = thumbnail_cache_dir_from_base(dir.path()).expect("cache dir should be created");

    assert!(cache_dir.is_dir());
    assert_eq!(cache_dir.file_name().and_then(|name| name.to_str()), Some("thumbnails"));
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
fn png_encode_returns_png_bytes() {
    let encoded = png_encode(&sample_rgba_image(2, 2)).expect("png should encode");

    assert!(encoded.starts_with(&[0x89, b'P', b'N', b'G']));
    assert!(!encoded.is_empty());
}
