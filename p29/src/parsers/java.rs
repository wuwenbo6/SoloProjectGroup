use crate::{Dependency, Language, Parser};
use anyhow::Result;
use quick_xml::events::Event;
use quick_xml::Reader;
use std::collections::HashMap;
use std::fs;
use std::path::Path;

#[derive(Default)]
pub struct JavaParser;

impl Parser for JavaParser {
    fn parse(&self, path: &Path) -> Result<Vec<Dependency>> {
        let filename = path.file_name().and_then(|f| f.to_str()).unwrap_or("");
        
        match filename {
            "pom.xml" => self.parse_pom_xml(path),
            _ => Ok(Vec::new()),
        }
    }

    fn language(&self) -> Language {
        Language::Java
    }
}

impl JavaParser {
    fn parse_pom_xml(&self, path: &Path) -> Result<Vec<Dependency>> {
        let content = fs::read_to_string(path)?;
        let mut reader = Reader::from_str(&content);
        reader.trim_text(true);
        
        let mut dependencies = Vec::new();
        let mut properties: HashMap<String, String> = HashMap::new();
        let mut buf = Vec::new();
        
        let mut current_depth = 0;
        let mut in_dependencies = false;
        let mut in_dependency = false;
        let mut in_properties = false;
        
        let mut current_group_id = String::new();
        let mut current_artifact_id = String::new();
        let mut current_version = String::new();
        let mut current_prop_name = String::new();
        let mut current_prop_value = String::new();
        
        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(e)) => {
                    current_depth += 1;
                    let name = e.name().as_ref();
                    
                    match name {
                        b"dependencies" => {
                            in_dependencies = true;
                        }
                        b"dependency" if in_dependencies => {
                            in_dependency = true;
                            current_group_id.clear();
                            current_artifact_id.clear();
                            current_version.clear();
                        }
                        b"properties" => {
                            in_properties = true;
                        }
                        b"groupId" if in_dependency => {}
                        b"artifactId" if in_dependency => {}
                        b"version" if in_dependency => {}
                        _ if in_properties && name != b"properties" => {
                            current_prop_name = String::from_utf8_lossy(name).to_string();
                            current_prop_value.clear();
                        }
                        _ => {}
                    }
                }
                Ok(Event::Text(e)) => {
                    let text = e.unescape().unwrap_or_default().to_string();
                    
                    if in_dependency {
                        let mut peek_buf = Vec::new();
                        if let Ok(Event::End(end_e)) = reader.peek_event_into(&mut peek_buf) {
                            match end_e.name().as_ref() {
                                b"groupId" => current_group_id = text.clone(),
                                b"artifactId" => current_artifact_id = text.clone(),
                                b"version" => current_version = text.clone(),
                                _ => {}
                            }
                        }
                    } else if in_properties && !current_prop_name.is_empty() {
                        current_prop_value = text;
                    }
                }
                Ok(Event::End(e)) => {
                    current_depth -= 1;
                    let name = e.name().as_ref();
                    
                    match name {
                        b"dependencies" => {
                            in_dependencies = false;
                        }
                        b"dependency" if in_dependencies => {
                            in_dependency = false;
                            
                            if !current_group_id.is_empty() && !current_artifact_id.is_empty() {
                                let version = if current_version.starts_with("${") && current_version.ends_with("}") {
                                    let prop_key = &current_version[2..current_version.len() - 1];
                                    properties.get(prop_key).cloned().unwrap_or_else(|| current_version.clone())
                                } else {
                                    current_version.clone()
                                };
                                
                                dependencies.push(Dependency {
                                    name: format!("{}:{}", current_group_id, current_artifact_id),
                                    version: if version.is_empty() { "*".to_string() } else { version },
                                    language: Language::Java,
                                    dependencies: Vec::new(),
                                });
                            }
                        }
                        b"properties" => {
                            in_properties = false;
                        }
                        prop_name if in_properties && !current_prop_name.is_empty() => {
                            if prop_name == current_prop_name.as_bytes() {
                                properties.insert(current_prop_name.clone(), current_prop_value.clone());
                                current_prop_name.clear();
                                current_prop_value.clear();
                            }
                        }
                        _ => {}
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => eprintln!("Error parsing XML: {}", e),
                _ => {}
            }
            buf.clear();
        }
        
        Ok(dependencies)
    }
}
