pub mod python;
pub mod javascript;
pub mod java;

use crate::{Dependency, Language, Parser};
use std::path::Path;
use anyhow::Result;

pub fn get_parser_for_file(path: &Path) -> Option<Box<dyn Parser>> {
    let filename = path.file_name()?.to_str()?;
    
    match filename {
        "requirements.txt" | "pyproject.toml" => Some(Box::new(python::PythonParser)),
        "package-lock.json" => Some(Box::new(javascript::JavascriptParser)),
        "pom.xml" => Some(Box::new(java::JavaParser)),
        _ => None,
    }
}

pub fn detect_language(path: &Path) -> Option<Language> {
    let filename = path.file_name()?.to_str()?;
    
    match filename {
        "requirements.txt" | "pyproject.toml" => Some(Language::Python),
        "package-lock.json" => Some(Language::JavaScript),
        "pom.xml" => Some(Language::Java),
        _ => None,
    }
}
