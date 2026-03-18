use std::fs;
use std::path::{Path, PathBuf};

pub(crate) fn moodcrate_base_dir_from_paths(
    document_dir: Result<PathBuf, String>,
    local_dir: Result<PathBuf, String>,
) -> Result<PathBuf, String> {
    document_dir.or(local_dir)
}

pub(crate) fn data_path_from_base(base_dir: &Path, file_name: &str) -> PathBuf {
    base_dir.join(file_name)
}

pub(crate) fn moodcrate_data_dir_from_base(base_dir: &Path) -> Result<PathBuf, String> {
    let app_dir = base_dir.join("Moodcrate");
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    }
    Ok(app_dir)
}

pub(crate) fn resolve_moodcrate_file_path(
    document_dir: Result<PathBuf, String>,
    local_dir: Result<PathBuf, String>,
    file_name: &str,
) -> Result<PathBuf, String> {
    moodcrate_base_dir_from_paths(document_dir, local_dir)
        .and_then(|base_dir| moodcrate_data_dir_from_base(&base_dir))
        .map(|base_dir| data_path_from_base(&base_dir, file_name))
}

pub(crate) fn load_data_file(path: &Path) -> Result<String, String> {
    if path.is_file() {
        fs::read_to_string(path).map_err(|e| e.to_string())
    } else {
        Ok(String::new())
    }
}

pub(crate) fn save_data_file(path: &Path, data: &str) -> Result<(), String> {
    fs::write(path, data).map_err(|e| e.to_string())
}

pub(crate) fn load_named_data(
    document_dir: Result<PathBuf, String>,
    local_dir: Result<PathBuf, String>,
    file_name: &str,
) -> Result<String, String> {
    resolve_moodcrate_file_path(document_dir, local_dir, file_name)
        .and_then(|path| load_data_file(&path))
}

pub(crate) fn save_named_data(
    document_dir: Result<PathBuf, String>,
    local_dir: Result<PathBuf, String>,
    file_name: &str,
    data: &str,
) -> Result<(), String> {
    resolve_moodcrate_file_path(document_dir, local_dir, file_name)
        .and_then(|path| save_data_file(&path, data))
}
