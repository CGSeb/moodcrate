use std::fs;
use std::io::BufWriter;
use std::path::{Path, PathBuf};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use image::codecs::png::PngEncoder;
use image::ImageEncoder;
use sha2::{Sha256, Digest};
use tauri::Manager;

const IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "tiff", "tif", "avif"];

fn mime_for_ext(ext: &str) -> &'static str {
    match ext {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        "tiff" | "tif" => "image/tiff",
        "avif" => "image/avif",
        _ => "application/octet-stream",
    }
}

#[tauri::command]
fn list_images(path: &str) -> Result<Vec<String>, String> {
    let dir = Path::new(path);
    if !dir.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }

    let mut images: Vec<String> = Vec::new();
    let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_path = entry.path();
        if file_path.is_file() {
            if let Some(ext) = file_path.extension().and_then(|e| e.to_str()) {
                if IMAGE_EXTENSIONS.contains(&ext.to_lowercase().as_str()) {
                    if let Some(p) = file_path.to_str() {
                        images.push(p.to_string());
                    }
                }
            }
        }
    }

    images.sort();
    Ok(images)
}

#[tauri::command]
fn read_image(path: &str) -> Result<String, String> {
    let data = fs::read(path).map_err(|e| e.to_string())?;
    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();
    let mime = mime_for_ext(&ext);
    Ok(format!("data:{};base64,{}", mime, STANDARD.encode(&data)))
}

#[tauri::command]
fn import_files(sources: Vec<String>, target_dir: String, mode: String) -> Result<Vec<String>, String> {
    let target = Path::new(&target_dir);
    if !target.is_dir() {
        return Err(format!("Target is not a directory: {}", target_dir));
    }

    let mut imported: Vec<String> = Vec::new();

    for source in &sources {
        let src_path = Path::new(source);
        if !src_path.is_file() {
            continue;
        }

        let file_name = match src_path.file_name() {
            Some(name) => name,
            None => continue,
        };

        let mut dest = target.join(file_name);

        // Handle filename collisions
        if dest.exists() {
            let stem = src_path.file_stem().and_then(|s| s.to_str()).unwrap_or("file");
            let ext = src_path.extension().and_then(|e| e.to_str()).unwrap_or("");
            let mut counter = 1u32;
            loop {
                let new_name = if ext.is_empty() {
                    format!("{}_{}", stem, counter)
                } else {
                    format!("{}_{}.{}", stem, counter, ext)
                };
                dest = target.join(&new_name);
                if !dest.exists() {
                    break;
                }
                counter += 1;
            }
        }

        let result = if mode == "move" {
            // fs::rename fails across drives on Windows; fall back to copy + delete
            fs::rename(src_path, &dest).or_else(|_| {
                fs::copy(src_path, &dest).and_then(|_| fs::remove_file(src_path))
            })
        } else {
            fs::copy(src_path, &dest).map(|_| ())
        };

        match result {
            Ok(_) => {
                if let Some(p) = dest.to_str() {
                    imported.push(p.to_string());
                }
            }
            Err(e) => {
                eprintln!("Failed to import {}: {}", source, e);
            }
        }
    }

    Ok(imported)
}

#[tauri::command]
fn save_clipboard_image(rgba_data: Vec<u8>, width: u32, height: u32, target_dir: String) -> Result<String, String> {
    let target = Path::new(&target_dir);
    if !target.is_dir() {
        return Err(format!("Target is not a directory: {}", target_dir));
    }

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();

    let filename = format!("clipboard_{}.png", timestamp);
    let dest = target.join(&filename);

    let file = fs::File::create(&dest).map_err(|e| e.to_string())?;
    let writer = BufWriter::new(file);
    let encoder = PngEncoder::new(writer);
    encoder
        .write_image(&rgba_data, width, height, image::ExtendedColorType::Rgba8)
        .map_err(|e| e.to_string())?;

    dest.to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Failed to convert path to string".to_string())
}

#[tauri::command]
fn delete_image(path: String) -> Result<(), String> {
    let file = Path::new(&path);
    if !file.is_file() {
        return Err(format!("Not a file: {}", path));
    }
    fs::remove_file(file).map_err(|e| e.to_string())
}

fn thumbnail_cache_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let thumb_dir = data_dir.join("thumbnails");
    if !thumb_dir.exists() {
        fs::create_dir_all(&thumb_dir).map_err(|e| e.to_string())?;
    }
    Ok(thumb_dir)
}

#[tauri::command]
async fn generate_thumbnail(app_handle: tauri::AppHandle, path: String, max_size: u32) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let src = Path::new(&path);
        if !src.is_file() {
            return Err(format!("Not a file: {}", path));
        }

        let ext = src.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();

        // SVGs are already lightweight vector graphics — return original path
        if ext == "svg" {
            return Ok(path);
        }

        // Build a cache key from path + modification time
        let metadata = fs::metadata(src).map_err(|e| e.to_string())?;
        let modified = metadata.modified().map_err(|e| e.to_string())?;
        let mod_epoch = modified.duration_since(std::time::UNIX_EPOCH).map_err(|e| e.to_string())?.as_millis();

        let mut hasher = Sha256::new();
        hasher.update(path.as_bytes());
        hasher.update(mod_epoch.to_le_bytes());
        hasher.update(max_size.to_le_bytes());
        let hash = format!("{:x}", hasher.finalize());

        let cache_dir = thumbnail_cache_dir(&app_handle)?;
        let cached_path = cache_dir.join(format!("{}.webp", hash));

        // Return cached thumbnail path if it exists
        if cached_path.is_file() {
            return cached_path.to_str()
                .map(|s| s.to_string())
                .ok_or_else(|| "Failed to convert path".to_string());
        }

        // Decode the source image
        let img = image::open(src).map_err(|e| format!("Failed to decode image: {}", e))?;

        // Resize preserving aspect ratio (only downscale, never upscale)
        let thumb = if img.width() > max_size || img.height() > max_size {
            img.thumbnail(max_size, max_size)
        } else {
            img
        };

        // Encode as WebP and save to cache
        let webp_data = webp_encode(&thumb)?;
        fs::write(&cached_path, &webp_data).map_err(|e| e.to_string())?;

        cached_path.to_str()
            .map(|s| s.to_string())
            .ok_or_else(|| "Failed to convert path".to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn clear_collection_cache(app_handle: tauri::AppHandle, path: &str) -> Result<u32, String> {
    let image_paths = list_images(path)?;
    let cache_dir = thumbnail_cache_dir(&app_handle)?;
    let mut removed = 0u32;

    for image_path in &image_paths {
        let src = Path::new(image_path);
        let ext = src.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
        if ext == "svg" {
            continue;
        }
        let metadata = match fs::metadata(src) {
            Ok(m) => m,
            Err(_) => continue,
        };
        let modified = match metadata.modified() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let mod_epoch = match modified.duration_since(std::time::UNIX_EPOCH) {
            Ok(d) => d.as_millis(),
            Err(_) => continue,
        };

        // Remove thumbnails for all possible max_size values
        for &max_size in &[400u32] {
            let mut hasher = Sha256::new();
            hasher.update(image_path.as_bytes());
            hasher.update(mod_epoch.to_le_bytes());
            hasher.update(max_size.to_le_bytes());
            let hash = format!("{:x}", hasher.finalize());
            let cached_path = cache_dir.join(format!("{}.webp", hash));
            if cached_path.is_file() {
                let _ = fs::remove_file(&cached_path);
                removed += 1;
            }
        }
    }

    Ok(removed)
}

fn webp_encode(img: &image::DynamicImage) -> Result<Vec<u8>, String> {
    let mut buf = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut buf);
    img.write_to(&mut cursor, image::ImageFormat::WebP)
        .map_err(|e| format!("Failed to encode WebP: {}", e))?;
    Ok(buf)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![list_images, read_image, import_files, save_clipboard_image, delete_image, generate_thumbnail, clear_collection_cache])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
