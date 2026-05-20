use crate::{Dependency, Language, Parser};
use anyhow::Result;
use regex::Regex;
use std::fs;
use std::path::Path;

#[derive(Default)]
pub struct PythonParser;

impl Parser for PythonParser {
    fn parse(&self, path: &Path) -> Result<Vec<Dependency>> {
        let filename = path.file_name().and_then(|f| f.to_str()).unwrap_or("");
        
        match filename {
            "requirements.txt" => self.parse_requirements_txt(path),
            "pyproject.toml" => self.parse_pyproject_toml(path),
            _ => Ok(Vec::new()),
        }
    }

    fn language(&self) -> Language {
        Language::Python
    }
}

impl PythonParser {
    fn parse_requirements_txt(&self, path: &Path) -> Result<Vec<Dependency>> {
        let content = fs::read_to_string(path)?;
        let mut dependencies = Vec::new();
        
        let version_regex = Regex::new(r"^([a-zA-Z0-9_-]+)([<>=!~]+.*)?$")?;
        
        for line in content.lines() {
            let line = line.trim();
            
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            
            if let Some(caps) = version_regex.captures(line) {
                let name = caps[1].to_string();
                let version = caps.get(2)
                    .map(|m| m.as_str().trim_start_matches(&['=', '>', '<', '!', '~'][..]))
                    .unwrap_or("*")
                    .to_string();
                
                dependencies.push(Dependency {
                    name,
                    version,
                    language: Language::Python,
                    dependencies: Vec::new(),
                });
            }
        }
        
        Ok(dependencies)
    }

    fn parse_pyproject_toml(&self, path: &Path) -> Result<Vec<Dependency>> {
        let content = fs::read_to_string(path)?;
        let parsed: toml::Value = toml::from_str(&content)?;
        let mut dependencies = Vec::new();
        
        if let Some(project) = parsed.get("project") {
            if let Some(deps) = project.get("dependencies").and_then(|d| d.as_array()) {
                for dep in deps {
                    if let Some(dep_str) = dep.as_str() {
                        let (name, version) = self.parse_dependency_string(dep_str);
                        dependencies.push(Dependency {
                            name,
                            version,
                            language: Language::Python,
                            dependencies: Vec::new(),
                        });
                    }
                }
            }
        }
        
        if let Some(tool) = parsed.get("tool") {
            if let Some(poetry) = tool.get("poetry") {
                if let Some(deps) = poetry.get("dependencies").and_then(|d| d.as_table()) {
                    for (name, version_val) in deps {
                        if name != "python" {
                            let version = match version_val {
                                toml::Value::String(s) => s.clone(),
                                toml::Value::Table(t) => {
                                    t.get("version").and_then(|v| v.as_str()).unwrap_or("*").to_string()
                                }
                                _ => "*".to_string(),
                            };
                            dependencies.push(Dependency {
                                name: name.clone(),
                                version: version.trim_start_matches(&['^', '~', '=', '>', '<'][..]).to_string(),
                                language: Language::Python,
                                dependencies: Vec::new(),
                            });
                        }
                    }
                }
            }
        }
        
        Ok(dependencies)
    }

    fn parse_dependency_string(&self, dep_str: &str) -> (String, String) {
        let re = Regex::new(r"^([a-zA-Z0-9_-]+)([<>=!~].*)?$").unwrap();
        if let Some(caps) = re.captures(dep_str) {
            let name = caps[1].to_string();
            let version = caps.get(2)
                .map(|m| m.as_str().trim_start_matches(&['=', '>', '<', '!', '~'][..]))
                .unwrap_or("*")
                .to_string();
            (name, version)
        } else {
            (dep_str.to_string(), "*".to_string())
        }
    }
}
