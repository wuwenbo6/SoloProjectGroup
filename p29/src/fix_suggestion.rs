use crate::graph::NodeData;
use crate::vulnerability::Vulnerability;
use anyhow::Result;
use semver::{Version, VersionReq};
use std::collections::HashMap;

#[derive(Debug, Clone, serde::Serialize)]
pub struct FixSuggestion {
    pub package_name: String,
    pub current_version: String,
    pub suggested_version: String,
    pub upgrade_command: String,
    pub language: String,
    pub vulnerabilities_fixed: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct FixReport {
    pub suggestions: Vec<FixSuggestion>,
    pub total_fixable: usize,
    pub total_vulnerabilities: usize,
}

pub struct FixSuggester {
    version_cache: HashMap<String, Vec<String>>,
}

impl FixSuggester {
    pub fn new() -> Self {
        Self {
            version_cache: HashMap::new(),
        }
    }

    pub fn generate_fix_suggestion(
        &mut self,
        node: &NodeData,
        vulnerabilities: &[Vulnerability],
    ) -> Result<FixSuggestion> {
        let suggested_version = self.find_safe_version(node)?;
        let upgrade_command = self.generate_upgrade_command(node, &suggested_version);
        let vulnerabilities_fixed = vulnerabilities.iter().map(|v| v.cve_id.clone()).collect();

        Ok(FixSuggestion {
            package_name: node.name.clone(),
            current_version: node.version.clone(),
            suggested_version,
            upgrade_command,
            language: node.language.clone(),
            vulnerabilities_fixed,
        })
    }

    fn find_safe_version(&mut self, node: &NodeData) -> Result<String> {
        let versions = self.get_available_versions(node)?;
        
        let current_version = Version::parse(&node.version).ok();
        
        let mut valid_versions = Vec::new();
        for v in &versions {
            if let Ok(ver) = Version::parse(v) {
                if let Some(ref current) = current_version {
                    if &ver > current {
                        valid_versions.push(ver);
                    }
                } else {
                    valid_versions.push(ver);
                }
            }
        }
        
        valid_versions.sort();
        
        if let Some(suggested) = valid_versions.first() {
            Ok(suggested.to_string())
        } else if !versions.is_empty() {
            Ok(versions[0].clone())
        } else {
            Ok("latest".to_string())
        }
    }

    fn get_available_versions(&mut self, node: &NodeData) -> Result<Vec<String>> {
        let cache_key = format!("{}:{}", node.name, node.language);
        
        if let Some(cached) = self.version_cache.get(&cache_key) {
            return Ok(cached.clone());
        }

        let versions = match node.language.as_str() {
            "Python" => self.get_pypi_versions(&node.name),
            "JavaScript" => self.get_npm_versions(&node.name),
            "Java" => self.get_maven_versions(&node.name),
            _ => Ok(vec!["latest".to_string()]),
        }?;

        self.version_cache.insert(cache_key, versions.clone());
        Ok(versions)
    }

    fn get_pypi_versions(&self, package: &str) -> Result<Vec<String>> {
        let url = format!("https://pypi.org/pypi/{}/json", package);
        
        match reqwest::blocking::get(&url) {
            Ok(resp) => {
                if resp.status().is_success() {
                    let json: serde_json::Value = resp.json()?;
                    
                    let mut versions = Vec::new();
                    if let Some(releases) = json.get("releases").and_then(|r| r.as_object()) {
                        for version in releases.keys() {
                            if !version.contains("rc") && !version.contains("beta") && !version.contains("alpha") {
                                versions.push(version.clone());
                            }
                        }
                    }
                    
                    versions.sort_by(|a, b| {
                        Version::parse(a)
                            .and_then(|va| Version::parse(b).map(|vb| va.cmp(&vb)))
                            .unwrap_or(std::cmp::Ordering::Equal)
                    });
                    
                    Ok(versions)
                } else {
                    Ok(vec!["latest".to_string()])
                }
            }
            Err(_) => Ok(vec!["latest".to_string()]),
        }
    }

    fn get_npm_versions(&self, package: &str) -> Result<Vec<String>> {
        let url = format!("https://registry.npmjs.org/{}", package);
        
        match reqwest::blocking::get(&url) {
            Ok(resp) => {
                if resp.status().is_success() {
                    let json: serde_json::Value = resp.json()?;
                    
                    let mut versions = Vec::new();
                    if let Some(vers) = json.get("versions").and_then(|v| v.as_object()) {
                        for version in vers.keys() {
                            if !version.contains("rc") && !version.contains("beta") && !version.contains("alpha") {
                                versions.push(version.clone());
                            }
                        }
                    }
                    
                    versions.sort_by(|a, b| {
                        Version::parse(a)
                            .and_then(|va| Version::parse(b).map(|vb| va.cmp(&vb)))
                            .unwrap_or(std::cmp::Ordering::Equal)
                    });
                    
                    Ok(versions)
                } else {
                    Ok(vec!["latest".to_string()])
                }
            }
            Err(_) => Ok(vec!["latest".to_string()]),
        }
    }

    fn get_maven_versions(&self, package: &str) -> Result<Vec<String>> {
        let parts: Vec<&str> = package.split(':').collect();
        if parts.len() < 2 {
            return Ok(vec!["latest".to_string()]);
        }
        
        let group_id = parts[0];
        let artifact_id = parts[1];
        
        let search_url = format!(
            "https://search.maven.org/solrsearch/select?q=g:{}+AND+a:{}&core=gav&rows=20&wt=json",
            group_id, artifact_id
        );
        
        match reqwest::blocking::get(&search_url) {
            Ok(resp) => {
                if resp.status().is_success() {
                    let json: serde_json::Value = resp.json()?;
                    
                    let mut versions = Vec::new();
                    if let Some(docs) = json
                        .get("response")
                        .and_then(|r| r.get("docs"))
                        .and_then(|d| d.as_array())
                    {
                        for doc in docs {
                            if let Some(v) = doc.get("v").and_then(|v| v.as_str()) {
                                if !v.contains("rc") && !v.contains("beta") && !v.contains("alpha") {
                                    versions.push(v.to_string());
                                }
                            }
                        }
                    }
                    
                    Ok(versions)
                } else {
                    Ok(vec!["latest".to_string()])
                }
            }
            Err(_) => Ok(vec!["latest".to_string()]),
        }
    }

    fn generate_upgrade_command(&self, node: &NodeData, suggested_version: &str) -> String {
        match node.language.as_str() {
            "Python" => format!("pip install {}=={}", node.name, suggested_version),
            "JavaScript" => format!("npm install {}@{}", node.name, suggested_version),
            "Java" => {
                let parts: Vec<&str> = node.name.split(':').collect();
                if parts.len() >= 2 {
                    format!(
                        "Update pom.xml: <{}.version>{}</{}.version>",
                        parts[1].replace('-', "."),
                        suggested_version,
                        parts[1].replace('-', ".")
                    )
                } else {
                    format!("Update {} version to {} in pom.xml", node.name, suggested_version)
                }
            }
            _ => format!("upgrade {} to version {}", node.name, suggested_version),
        }
    }
}

impl Default for FixSuggester {
    fn default() -> Self {
        Self::new()
    }
}
