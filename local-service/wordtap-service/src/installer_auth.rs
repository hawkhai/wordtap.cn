use std::{
    error::Error,
    fs,
    io::{self, ErrorKind},
    path::PathBuf,
};

use rand::RngCore;

use crate::config::APP_DIR_NAME;

const INSTALLER_TOKEN_FILE: &str = "installer-token";

pub(crate) fn load_or_create_installer_token() -> Result<String, Box<dyn Error + Send + Sync>> {
    let path = installer_token_path()?;
    if let Ok(token) = fs::read_to_string(&path) {
        let trimmed = token.trim();
        if !trimmed.is_empty() {
            return Ok(trimmed.to_string());
        }
    }

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let token = random_token();
    fs::write(&path, &token)?;
    Ok(token)
}

pub(crate) fn read_installer_token() -> Result<String, Box<dyn Error + Send + Sync>> {
    let token = fs::read_to_string(installer_token_path()?)?;
    let trimmed = token.trim();
    if trimmed.is_empty() {
        return Err("Installer token file is empty.".into());
    }
    Ok(trimmed.to_string())
}

fn installer_token_path() -> Result<PathBuf, Box<dyn Error + Send + Sync>> {
    let base_dir = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .or_else(dirs::data_dir)
        .ok_or_else(|| {
            io::Error::new(
                ErrorKind::NotFound,
                "Unable to find a writable application data directory.",
            )
        })?;

    Ok(base_dir.join(APP_DIR_NAME).join(INSTALLER_TOKEN_FILE))
}

fn random_token() -> String {
    let mut buffer = [0; 32];
    rand::thread_rng().fill_bytes(&mut buffer);
    hex::encode_upper(buffer)
}
