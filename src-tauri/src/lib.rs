use std::fs;
use std::path::Path;
use base64::{Engine as _, engine::general_purpose::STANDARD};

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![list_images, read_image])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
