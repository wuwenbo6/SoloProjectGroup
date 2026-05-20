use crate::{Dependency, Language, Parser};
use anyhow::Result;
use std::fs;
use std::path::Path;

#[derive(Default)]
pub struct JavascriptParser;

impl Parser for JavascriptParser {
    fn parse(&self, path: &Path) -> Result<Vec<Dependency>> {
        let filename = path.file_name().and_then(|f| f.to_str()).unwrap_or("");
        
        match filename {
            "package-lock.json" => self.parse_package_lock_json(path),
            _ => Ok(Vec::new()),
        }
    }

    fn language(&self) -> Language {
        Language::JavaScript
    }
}

impl JavascriptParser {
    fn parse_package_lock_json(&self, path: &Path) -> Result<Vec<Dependency>> {
        let content = fs::read_to_string(path)?;
        let parsed: serde_json::Value = serde_json::from_str(&content)?;
        
        let mut dependencies = Vec::new();
        
        if let Some(packages) = parsed.get("packages").and_then(|p| p.as_object()) {
            for (pkg_path, pkg_info) in packages {
                if pkg_path.is_empty() {
                    continue;
                }
                
                let name = pkg_path.strip_prefix("node_modules/")
                    .unwrap_or(pkg_path)
                    .to_string();
                
                let version = pkg_info.get("version")
                    .and_then(|v| v.as_str())
                    .unwrap_or("*")
                    .to_string();
                
                let mut sub_deps = Vec::new();
                
                if let Some(deps) = pkg_info.get("dependencies").and_then(|d| d.as_object()) {
                    for (dep_name, dep_version) in deps {
                        let version_str = dep_version.as_str().unwrap_or("*")
                            .trim_start_matches(&['^', '~', '=', '>', '<'][..])
                            .to_string();
                        
                        sub_deps.push(Dependency {
                            name: dep_name.clone(),
                            version: version_str,
                            language: Language::JavaScript,
                            dependencies: Vec::new(),
                        });
                    }
                }
                
                dependencies.push(Dependency {
                    name,
                    version,
                    language: Language::JavaScript,
                    dependencies: sub_deps,
                });
            }
        }
        
        if let Some(deps) = parsed.get("dependencies").and_then(|d| d.as_object()) {
            for (name, dep_info) in deps {
                let version = dep_info.get("version")
                    .and_then(|v| v.as_str())
                    .unwrap_or("*")
                    .to_string();
                
                let mut sub_deps = Vec::new();
                
                if let Some(nested_deps) = dep_info.get("dependencies").and_then(|d| d.as_object()) {
                    sub_deps.extend(self.parse_nested_dependencies(nested_deps));
                }
                
                dependencies.push(Dependency {
                    name: name.clone(),
                    version,
                    language: Language::JavaScript,
                    dependencies: sub_deps,
                });
            }
        }
        
        Ok(dependencies)
    }

    fn parse_nested_dependencies(&self, deps: &serde_json::Map<String, serde_json::Value>) -> Vec<Dependency> {
        let mut dependencies = Vec::new();
        
        for (name, dep_info) in deps {
            let version = dep_info.get("version")
                .and_then(|v| v.as_str())
                .unwrap_or("*")
                .to_string();
            
            let mut sub_deps = Vec::new();
            
            if let Some(nested_deps) = dep_info.get("dependencies").and_then(|d| d.as_object()) {
                sub_deps.extend(self.parse_nested_dependencies(nested_deps));
            }
            
            dependencies.push(Dependency {
                name: name.clone(),
                version,
                language: Language::JavaScript,
                dependencies: sub_deps,
            });
        }
        
        dependencies
    }
}
