use std::path::PathBuf;
use std::time::SystemTime;

#[cfg(target_os = "windows")]
use std::os::windows::fs::MetadataExt;

#[cfg(target_family = "unix")]
use std::os::unix::fs::MetadataExt;

pub fn get_app_home() -> PathBuf {
    if let Ok(home) = std::env::var("ABT_HOME") {
        return PathBuf::from(home);
    }

    if let Some(home) = dirs::home_dir() {
        return home.join(".abt");
    }

    std::env::temp_dir().join("abt")
}

pub fn get_models_dir() -> PathBuf {
    get_app_home().join("models")
}

pub fn get_logs_dir() -> PathBuf {
    get_app_home().join("logs")
}

pub fn get_cache_dir() -> PathBuf {
    get_app_home().join("cache")
}

pub fn get_config_path() -> PathBuf {
    get_app_home().join("config.toml")
}

pub fn get_database_path() -> PathBuf {
    get_app_home().join("abt.db")
}

pub fn ensure_dir_exists(path: &std::path::Path) -> crate::Result<()> {
    if !path.exists() {
        std::fs::create_dir_all(path)?;
    }
    Ok(())
}

pub fn init_app_directories() -> crate::Result<()> {
    ensure_dir_exists(&get_app_home())?;
    ensure_dir_exists(&get_models_dir())?;
    ensure_dir_exists(&get_logs_dir())?;
    ensure_dir_exists(&get_cache_dir())?;
    Ok(())
}

pub fn get_file_size(path: &std::path::Path) -> crate::Result<u64> {
    let metadata = std::fs::metadata(path)?;
    Ok(metadata.len())
}

pub fn get_file_modified_time(path: &std::path::Path) -> crate::Result<SystemTime> {
    let metadata = std::fs::metadata(path)?;
    Ok(metadata.modified()?)
}

#[cfg(target_family = "unix")]
pub fn set_file_permissions(path: &std::path::Path, mode: u32) -> crate::Result<()> {
    use std::fs::Permissions;
    use std::os::unix::fs::PermissionsExt;
    
    std::fs::set_permissions(path, Permissions::from_mode(mode))?;
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn set_file_permissions(_path: &std::path::Path, _mode: u32) -> crate::Result<()> {
    Ok(())
}

#[cfg(target_family = "unix")]
pub fn get_file_permissions(path: &std::path::Path) -> crate::Result<u32> {
    use std::os::unix::fs::MetadataExt;
    let metadata = std::fs::metadata(path)?;
    Ok(metadata.mode())
}

#[cfg(target_os = "windows")]
pub fn get_file_permissions(_path: &std::path::Path) -> crate::Result<u32> {
    Ok(0o644)
}

pub fn is_windows() -> bool {
    cfg!(target_os = "windows")
}

pub fn is_macos() -> bool {
    cfg!(target_os = "macos")
}

pub fn is_linux() -> bool {
    cfg!(target_os = "linux")
}

pub fn get_os_name() -> &'static str {
    if is_windows() {
        "Windows"
    } else if is_macos() {
        "macOS"
    } else if is_linux() {
        "Linux"
    } else {
        "Unknown"
    }
}

pub fn get_cpu_count() -> usize {
    num_cpus::get()
}

pub fn get_physical_cpu_count() -> usize {
    num_cpus::get_physical()
}

pub fn format_path_for_display(path: &std::path::Path) -> String {
    path.to_string_lossy().to_string()
}

pub fn normalize_path_separators(path: &str) -> String {
    if is_windows() {
        path.replace('/', "\\")
    } else {
        path.replace('\\', "/")
    }
}

#[cfg(target_os = "windows")]
pub fn get_long_path_support() -> bool {
    true
}

#[cfg(not(target_os = "windows"))]
pub fn get_long_path_support() -> bool {
    true
}

pub fn get_temp_dir() -> PathBuf {
    std::env::temp_dir()
}

pub fn create_temp_file(prefix: &str) -> crate::Result<PathBuf> {
    let temp_file = get_temp_dir().join(format!("{}_{}", prefix, rand::random::<u64>()));
    std::fs::File::create(&temp_file)?;
    Ok(temp_file)
}

pub fn safe_remove_file(path: &std::path::Path) -> bool {
    if path.exists() && path.is_file() {
        std::fs::remove_file(path).is_ok()
    } else {
        false
    }
}

pub fn safe_remove_dir(path: &std::path::Path) -> bool {
    if path.exists() && path.is_dir() {
        std::fs::remove_dir_all(path).is_ok()
    } else {
        false
    }
}

pub fn copy_file_safe(source: &std::path::Path, destination: &std::path::Path) -> crate::Result<u64> {
    if let Some(parent) = destination.parent() {
        ensure_dir_exists(parent)?;
    }
    let copied = std::fs::copy(source, destination)?;
    Ok(copied)
}

pub fn move_file_safe(source: &std::path::Path, destination: &std::path::Path) -> crate::Result<()> {
    if let Some(parent) = destination.parent() {
        ensure_dir_exists(parent)?;
    }
    
    if std::fs::rename(source, destination).is_ok() {
        return Ok(());
    }
    
    std::fs::copy(source, destination)?;
    std::fs::remove_file(source)?;
    Ok(())
}

pub fn get_directory_size(path: &std::path::Path) -> crate::Result<u64> {
    let mut total_size = 0;
    
    for entry in walkdir::WalkDir::new(path)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            if let Ok(metadata) = entry.metadata() {
                total_size += metadata.len();
            }
        }
    }
    
    Ok(total_size)
}

pub fn format_size(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

pub fn get_executable_path() -> crate::Result<PathBuf> {
    Ok(std::env::current_exe()?)
}

pub fn get_current_dir() -> crate::Result<PathBuf> {
    Ok(std::env::current_dir()?)
}

pub fn set_current_dir(path: &std::path::Path) -> crate::Result<()> {
    std::env::set_current_dir(path)?;
    Ok(())
}

pub fn expand_tilde(path: &str) -> PathBuf {
    if path.starts_with('~') {
        if let Some(home) = dirs::home_dir() {
            if path.len() == 1 {
                return home;
            }
            if path.starts_with("~/") || path.starts_with("~\\") {
                return home.join(&path[2..]);
            }
        }
    }
    PathBuf::from(path)
}

pub fn is_hidden(path: &std::path::Path) -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::fs::MetadataExt;
        if let Ok(metadata) = std::fs::metadata(path) {
            return (metadata.file_attributes() & 2) != 0;
        }
        false
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        path.file_name()
            .and_then(|n| n.to_str())
            .map(|s| s.starts_with('.'))
            .unwrap_or(false)
    }
}

pub fn scan_directory(
    path: &std::path::Path,
    extensions: &[&str],
    recursive: bool,
) -> crate::Result<Vec<PathBuf>> {
    let mut files = Vec::new();
    
    let walker = if recursive {
        walkdir::WalkDir::new(path)
    } else {
        walkdir::WalkDir::new(path).max_depth(1)
    };

    for entry in walker.into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            let path = entry.path();
            
            if extensions.is_empty() {
                files.push(path.to_path_buf());
            } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if extensions.contains(&ext.to_lowercase().as_str()) {
                    files.push(path.to_path_buf());
                }
            }
        }
    }

    Ok(files)
}
