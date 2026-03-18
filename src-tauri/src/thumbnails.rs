use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

pub(crate) fn thumbnail_cache_dir_from_base(base_dir: &Path) -> Result<PathBuf, String> {
    let thumb_dir = base_dir.join("thumbnails");
    if !thumb_dir.exists() {
        fs::create_dir_all(&thumb_dir).map_err(|e| e.to_string())?;
    }
    Ok(thumb_dir)
}

pub(crate) fn resolve_thumbnail_cache_dir(
    app_data_dir: Result<PathBuf, String>,
) -> Result<PathBuf, String> {
    app_data_dir.and_then(|data_dir| thumbnail_cache_dir_from_base(&data_dir))
}

pub(crate) fn thumbnail_cache_key(path: &str, mod_epoch: u128, max_size: u32) -> String {
    let mut hasher = Sha256::new();
    hasher.update(path.as_bytes());
    hasher.update(mod_epoch.to_le_bytes());
    hasher.update(max_size.to_le_bytes());
    format!("{:x}", hasher.finalize())
}

pub(crate) fn file_mod_epoch(path: &Path) -> Option<u128> {
    fs::metadata(path)
        .ok()?
        .modified()
        .ok()?
        .duration_since(std::time::UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_millis())
}

pub(crate) fn generate_thumbnail_with_cache_dir(
    cache_dir: PathBuf,
    path: String,
    max_size: u32,
) -> Result<String, String> {
    generate_thumbnail_to_cache(&cache_dir, &path, max_size)
}

pub(crate) fn generate_thumbnail_from_app_data(
    app_data_dir: Result<PathBuf, String>,
    path: String,
    max_size: u32,
) -> Result<String, String> {
    resolve_thumbnail_cache_dir(app_data_dir)
        .and_then(|cache_dir| generate_thumbnail_with_cache_dir(cache_dir, path, max_size))
}

pub(crate) fn generate_thumbnail_to_cache(
    cache_dir: &Path,
    path: &str,
    max_size: u32,
) -> Result<String, String> {
    let src = Path::new(path);
    if !src.is_file() {
        return Err(format!("Not a file: {}", path));
    }

    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if ext == "svg" {
        return Ok(path.to_string());
    }

    let metadata = fs::metadata(src).map_err(|e| e.to_string())?;
    let modified = metadata.modified().map_err(|e| e.to_string())?;
    let mod_epoch = modified
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();

    let hash = thumbnail_cache_key(path, mod_epoch, max_size);
    let cached_path = cache_dir.join(format!("{}.png", hash));

    if cached_path.is_file() {
        return cached_path
            .to_str()
            .map(|s| s.to_string())
            .ok_or_else(|| "Failed to convert path".to_string());
    }

    let img = image::open(src).map_err(|e| format!("Failed to decode image: {}", e))?;
    let thumb = if img.width() > max_size || img.height() > max_size {
        img.thumbnail(max_size, max_size)
    } else {
        img
    };

    let png_data = crate::png_encode(&thumb)?;
    fs::write(&cached_path, &png_data).map_err(|e| e.to_string())?;

    cached_path
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Failed to convert path".to_string())
}

pub(crate) fn clear_collection_cache_in_dir(cache_dir: &Path, path: &str) -> Result<u32, String> {
    let image_paths = crate::list_images(path)?;
    let mut removed = 0u32;

    for image_path in &image_paths {
        let src = Path::new(image_path);
        let ext = src
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        if ext == "svg" {
            continue;
        }

        let Some(mod_epoch) = file_mod_epoch(src) else {
            continue;
        };

        for &max_size in &[400u32] {
            let hash = thumbnail_cache_key(image_path, mod_epoch, max_size);
            for extension in ["png", "webp"] {
                let cached_path = cache_dir.join(format!("{}.{}", hash, extension));
                if cached_path.is_file() {
                    let _ = fs::remove_file(&cached_path);
                    removed += 1;
                }
            }
        }
    }

    Ok(removed)
}

pub(crate) fn clear_collection_cache_from_app_data(
    app_data_dir: Result<PathBuf, String>,
    path: &str,
) -> Result<u32, String> {
    resolve_thumbnail_cache_dir(app_data_dir)
        .and_then(|cache_dir| clear_collection_cache_in_dir(&cache_dir, path))
}
