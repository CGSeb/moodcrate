use base64::{engine::general_purpose::STANDARD, Engine as _};
use image::codecs::png::PngEncoder;
use image::ImageEncoder;
use std::fs;
use std::io::{BufWriter, Cursor};
use std::path::Path;
use tauri::Manager;

mod storage;
mod thumbnails;

use storage::{load_named_data, save_named_data};
use thumbnails::{clear_collection_cache_from_app_data, generate_thumbnail_from_app_data};

const IMAGE_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "tiff", "tif", "avif",
];

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

fn import_result_to_paths(
    imported: &mut Vec<String>,
    source: &str,
    dest: &Path,
    result: std::io::Result<()>,
) {
    match result {
        Ok(()) => {
            if let Some(path) = dest.to_str() {
                imported.push(path.to_string());
            }
        }
        Err(error) => eprintln!("Failed to import {}: {}", source, error),
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
fn import_files(
    sources: Vec<String>,
    target_dir: String,
    mode: String,
) -> Result<Vec<String>, String> {
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

        let Some(file_name) = src_path.file_name() else { continue };
        let mut dest = target.join(file_name);

        if dest.exists() {
            let stem = src_path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("file");
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
            fs::rename(src_path, &dest)
                .or_else(|_| fs::copy(src_path, &dest).and_then(|_| fs::remove_file(src_path)))
        } else {
            fs::copy(src_path, &dest).map(|_| ())
        };

        import_result_to_paths(&mut imported, source, &dest, result);
    }

    Ok(imported)
}

#[tauri::command]
fn save_clipboard_image(
    rgba_data: Vec<u8>,
    width: u32,
    height: u32,
    target_dir: String,
) -> Result<String, String> {
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

#[tauri::command]
fn load_tags_data(app_handle: tauri::AppHandle) -> Result<String, String> { load_named_data(app_handle.path().document_dir().map_err(|e| e.to_string()), app_handle.path().app_local_data_dir().map_err(|e| e.to_string()), "tags.json") }

#[tauri::command]
fn save_tags_data(app_handle: tauri::AppHandle, data: String) -> Result<(), String> { save_named_data(app_handle.path().document_dir().map_err(|e| e.to_string()), app_handle.path().app_local_data_dir().map_err(|e| e.to_string()), "tags.json", &data) }

#[tauri::command]
fn load_moodboards_data(app_handle: tauri::AppHandle) -> Result<String, String> { load_named_data(app_handle.path().document_dir().map_err(|e| e.to_string()), app_handle.path().app_local_data_dir().map_err(|e| e.to_string()), "moodboards.json") }

#[tauri::command]
fn save_moodboards_data(app_handle: tauri::AppHandle, data: String) -> Result<(), String> { save_named_data(app_handle.path().document_dir().map_err(|e| e.to_string()), app_handle.path().app_local_data_dir().map_err(|e| e.to_string()), "moodboards.json", &data) }

#[tauri::command]
async fn generate_thumbnail(app_handle: tauri::AppHandle, path: String, max_size: u32) -> Result<String, String> { let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string()); tauri::async_runtime::spawn_blocking(move || generate_thumbnail_from_app_data(app_data_dir, path, max_size)).await.map_err(|e| e.to_string())? }

#[tauri::command]
fn clear_collection_cache(app_handle: tauri::AppHandle, path: &str) -> Result<u32, String> { clear_collection_cache_from_app_data(app_handle.path().app_data_dir().map_err(|e| e.to_string()), path) }

fn png_encode(img: &image::DynamicImage) -> Result<Vec<u8>, String> {
    let mut buf = Vec::new();
    let mut cursor = Cursor::new(&mut buf);
    img.write_to(&mut cursor, image::ImageFormat::Png)
        .map_err(|e| format!("Failed to encode PNG: {}", e))?;
    Ok(buf)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_images,
            read_image,
            import_files,
            save_clipboard_image,
            delete_image,
            generate_thumbnail,
            clear_collection_cache,
            load_tags_data,
            save_tags_data,
            load_moodboards_data,
            save_moodboards_data
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod lib_tests;
