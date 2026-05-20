use crate::graph::{DependencyGraph, NodeData};
use anyhow::Result;
use regex::Regex;
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, serde::Serialize)]
pub struct LicenseInfo {
    pub package_name: String,
    pub version: String,
    pub license: String,
    pub is_gpl_violation: bool,
}

pub struct LicenseScanResult {
    pub licenses: HashMap<String, LicenseInfo>,
    pub gpl_violations: usize,
    pub total_scanned: usize,
}

impl LicenseScanResult {
    pub fn new() -> Self {
        Self {
            licenses: HashMap::new(),
            gpl_violations: 0,
            total_scanned: 0,
        }
    }

    pub fn add(&mut self, node_key: String, info: LicenseInfo) {
        if info.is_gpl_violation {
            self.gpl_violations += 1;
        }
        self.licenses.insert(node_key, info);
        self.total_scanned += 1;
    }
}

impl Default for LicenseScanResult {
    fn default() -> Self {
        Self::new()
    }
}

pub struct LicenseChecker {
    gpl_patterns: Vec<Regex>,
    cache: HashMap<String, String>,
}

impl LicenseChecker {
    pub fn new() -> Result<Self> {
        let gpl_patterns = vec![
            Regex::new(r"(?i)GPL-?[123]")?,
            Regex::new(r"(?i)GPL-?[123]\.0")?,
            Regex::new(r"(?i)AGPL")?,
            Regex::new(r"(?i)Lesser General Public License")?,
            Regex::new(r"(?i)GNU General Public License")?,
        ];

        Ok(Self {
            gpl_patterns,
            cache: std::collections::HashMap::new(),
        })
    }

    pub fn is_gpl_license(&self, license: &str) -> bool {
        self.gpl_patterns.iter().any(|p| p.is_match(license))
    }

    pub fn check_licenses(&mut self, nodes: &[&NodeData]) -> Result<Vec<LicenseInfo>> {
        let mut results = Vec::new();
        let mut checked = HashSet::new();

        for node in nodes {
            let key = format!("{}:{}:{}", node.name, node.version, node.language);
            if checked.contains(&key) {
                continue;
            }
            checked.insert(key.clone());

            let license = self.get_license(node)?;
            let is_gpl = self.is_gpl_license(&license);

            results.push(LicenseInfo {
                package_name: node.name.clone(),
                version: node.version.clone(),
                license,
                is_gpl_violation: is_gpl,
            });
        }

        Ok(results)
    }

    pub fn scan_streaming<F>(&mut self, graph: &DependencyGraph, mut callback: F) -> Result<LicenseScanResult>
    where
        F: FnMut(&NodeData, &LicenseInfo),
    {
        let mut result = LicenseScanResult::new();
        let mut checked = HashSet::new();

        for node in graph.iter_nodes() {
            let key = node.key();
            if checked.contains(&key) {
                continue;
            }
            checked.insert(key.clone());

            let license = self.get_license(node)?;
            let is_gpl = self.is_gpl_license(&license);

            let info = LicenseInfo {
                package_name: node.name.clone(),
                version: node.version.clone(),
                license,
                is_gpl_violation: is_gpl,
            };

            if is_gpl {
                callback(node, &info);
            }

            result.add(key, info);
        }

        Ok(result)
    }

    fn get_license(&mut self, node: &NodeData) -> Result<String> {
        let cache_key = format!("{}:{}", node.name, node.version);
        
        if let Some(cached) = self.cache.get(&cache_key) {
            return Ok(cached.clone());
        }

        let license = match node.language.as_str() {
            "Python" => self.get_pypi_license(&node.name, &node.version),
            "JavaScript" => self.get_npm_license(&node.name, &node.version),
            "Java" => self.get_maven_license(&node.name, &node.version),
            _ => Ok("Unknown".to_string()),
        }?;

        self.cache.insert(cache_key, license.clone());
        Ok(license)
    }

    fn get_pypi_license(&self, name: &str, version: &str) -> Result<String> {
        let url = format!("https://pypi.org/pypi/{}/{}/json", name, version);
        
        match reqwest::blocking::get(&url) {
            Ok(resp) => {
                if resp.status().is_success() {
                    let json: serde_json::Value = resp.json()?;
                    
                    if let Some(license) = json
                        .get("info")
                        .and_then(|i| i.get("license"))
                        .and_then(|l| l.as_str())
                    {
                        if license.is_empty() || license == "UNKNOWN" {
                            Ok("Unknown".to_string())
                        } else {
                            Ok(license.to_string())
                        }
                    } else {
                        Ok("Unknown".to_string())
                    }
                } else {
                    self.get_pypi_latest(name)
                }
            }
            Err(_) => self.get_pypi_latest(name),
        }
    }

    fn get_pypi_latest(&self, name: &str) -> Result<String> {
        let url = format!("https://pypi.org/pypi/{}/json", name);
        
        match reqwest::blocking::get(&url) {
            Ok(resp) => {
                if resp.status().is_success() {
                    let json: serde_json::Value = resp.json()?;
                    
                    if let Some(license) = json
                        .get("info")
                        .and_then(|i| i.get("license"))
                        .and_then(|l| l.as_str())
                    {
                        if license.is_empty() || license == "UNKNOWN" {
                            Ok("Unknown".to_string())
                        } else {
                            Ok(license.to_string())
                        }
                    } else {
                        Ok("Unknown".to_string())
                    }
                } else {
                    Ok("Unknown".to_string())
                }
            }
            Err(_) => Ok("Unknown".to_string()),
        }
    }

    fn get_npm_license(&self, name: &str, version: &str) -> Result<String> {
        let url = format!("https://registry.npmjs.org/{}/{}", name, version);
        
        match reqwest::blocking::get(&url) {
            Ok(resp) => {
                if resp.status().is_success() {
                    let json: serde_json::Value = resp.json()?;
                    
                    if let Some(license) = json.get("license") {
                        match license {
                            serde_json::Value::String(s) => Ok(s.clone()),
                            serde_json::Value::Object(o) => {
                                if let Some(license_type) = o.get("type").and_then(|t| t.as_str()) {
                                    Ok(license_type.to_string())
                                } else {
                                    Ok("Unknown".to_string())
                                }
                            }
                            _ => Ok("Unknown".to_string()),
                        }
                    } else {
                        self.get_npm_latest(name)
                    }
                } else {
                    self.get_npm_latest(name)
                }
            }
            Err(_) => self.get_npm_latest(name),
        }
    }

    fn get_npm_latest(&self, name: &str) -> Result<String> {
        let url = format!("https://registry.npmjs.org/{}", name);
        
        match reqwest::blocking::get(&url) {
            Ok(resp) => {
                if resp.status().is_success() {
                    let json: serde_json::Value = resp.json()?;
                    
                    if let Some(license) = json
                        .get("latest")
                        .and_then(|l| l.as_str())
                    {
                        Ok(license.to_string())
                    } else if let Some(license) = json.get("license") {
                        match license {
                            serde_json::Value::String(s) => Ok(s.clone()),
                            _ => Ok("Unknown".to_string()),
                        }
                    } else {
                        Ok("Unknown".to_string())
                    }
                } else {
                    Ok("Unknown".to_string())
                }
            }
            Err(_) => Ok("Unknown".to_string()),
        }
    }

    fn get_maven_license(&self, name: &str, _version: &str) -> Result<String> {
        let parts: Vec<&str> = name.split(':').collect();
        if parts.len() < 2 {
            return Ok("Unknown".to_string());
        }
        
        let group_id = parts[0];
        let artifact_id = parts[1];
        
        let search_url = format!(
            "https://search.maven.org/solrsearch/select?q=g:{}+AND+a:{}&rows=1&wt=json",
            group_id, artifact_id
        );
        
        match reqwest::blocking::get(&search_url) {
            Ok(resp) => {
                if resp.status().is_success() {
                    let json: serde_json::Value = resp.json()?;
                    
                    if let Some(version) = json
                        .get("response")
                        .and_then(|r| r.get("docs"))
                        .and_then(|d| d.as_array())
                        .and_then(|arr| arr.first())
                        .and_then(|doc| doc.get("latestVersion"))
                        .and_then(|v| v.as_str())
                    {
                        self.get_maven_pom_license(group_id, artifact_id, version)
                    } else {
                        Ok("Unknown".to_string())
                    }
                } else {
                    Ok("Unknown".to_string())
                }
            }
            Err(_) => Ok("Unknown".to_string()),
        }
    }

    fn get_maven_pom_license(&self, group_id: &str, artifact_id: &str, version: &str) -> Result<String> {
        let group_path = group_id.replace('.', "/");
        let url = format!(
            "https://repo1.maven.org/maven2/{}/{}/{}/{}-{}.pom",
            group_path, artifact_id, version, artifact_id, version
        );
        
        match reqwest::blocking::get(&url) {
            Ok(resp) => {
                if resp.status().is_success() {
                    let content = resp.text()?;
                    self.extract_license_from_pom(&content)
                } else {
                    Ok("Unknown".to_string())
                }
            }
            Err(_) => Ok("Unknown".to_string()),
        }
    }

    fn extract_license_from_pom(&self, content: &str) -> Result<String> {
        let mut reader = quick_xml::Reader::from_str(content);
        let mut buf = Vec::new();
        let mut in_licenses = false;
        let mut in_license = false;
        let mut in_name = false;
        let mut current_license = String::new();

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(quick_xml::events::Event::Start(e)) => {
                    match e.name().as_ref() {
                        b"licenses" => in_licenses = true,
                        b"license" if in_licenses => in_license = true,
                        b"name" if in_license => in_name = true,
                        _ => {}
                    }
                }
                Ok(quick_xml::events::Event::Text(e)) => {
                    if in_name {
                        if let Ok(text) = e.unescape() {
                            current_license.push_str(&text);
                        }
                    }
                }
                Ok(quick_xml::events::Event::End(e)) => {
                    match e.name().as_ref() {
                        b"licenses" => in_licenses = false,
                        b"license" if in_licenses => {
                            in_license = false;
                            if !current_license.is_empty() {
                                return Ok(current_license);
                            }
                        }
                        b"name" if in_license => in_name = false,
                        _ => {}
                    }
                }
                Ok(quick_xml::events::Event::Eof) => break,
                _ => {}
            }
            buf.clear();
        }

        Ok(if current_license.is_empty() { "Unknown".to_string() } else { current_license })
    }
}

impl Default for LicenseChecker {
    fn default() -> Self {
        Self::new().unwrap_or_else(|_| Self {
            gpl_patterns: Vec::new(),
            cache: std::collections::HashMap::new(),
        })
    }
}
