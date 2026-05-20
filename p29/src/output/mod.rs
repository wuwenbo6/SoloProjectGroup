use crate::graph::{DependencyGraph, NodeData};
use crate::vulnerability::Vulnerability;
use crate::license::LicenseInfo;
use crate::fix_suggestion::FixSuggestion;
use petgraph::visit::EdgeRef;
use std::collections::HashMap;

#[derive(Debug, serde::Serialize)]
pub struct ScanResult {
    pub total_dependencies: usize,
    pub total_vulnerabilities: usize,
    pub total_gpl_violations: usize,
    pub dependencies: Vec<DependencyWithVulns>,
    pub fix_suggestions: Vec<FixSuggestion>,
}

#[derive(Debug, serde::Serialize)]
pub struct DependencyWithVulns {
    pub name: String,
    pub version: String,
    pub language: String,
    pub license: String,
    pub is_gpl_violation: bool,
    pub vulnerabilities: Vec<Vulnerability>,
}

pub struct OutputGenerator;

impl OutputGenerator {
    pub fn to_json(
        graph: &DependencyGraph, 
        vulns_map: &HashMap<String, Vec<Vulnerability>>,
        license_map: &HashMap<String, LicenseInfo>,
        fix_suggestions: &[FixSuggestion],
    ) -> String {
        let dependencies: Vec<DependencyWithVulns> = graph
            .get_all_nodes()
            .iter()
            .map(|node| {
                let key = format!("{}:{}:{}", node.name, node.version, node.language);
                let vulns = vulns_map.get(&key).cloned().unwrap_or_default();
                let license_info = license_map.get(&key);
                DependencyWithVulns {
                    name: node.name.clone(),
                    version: node.version.clone(),
                    language: node.language.clone(),
                    license: license_info.map(|l| l.license.clone()).unwrap_or_else(|| "Unknown".to_string()),
                    is_gpl_violation: license_info.map(|l| l.is_gpl_violation).unwrap_or(false),
                    vulnerabilities: vulns,
                }
            })
            .collect();

        let total_vulns = vulns_map.values().map(|v| v.len()).sum();
        let total_gpl = license_map.values().filter(|l| l.is_gpl_violation).count();

        let result = ScanResult {
            total_dependencies: graph.node_count(),
            total_vulnerabilities: total_vulns,
            total_gpl_violations: total_gpl,
            dependencies,
            fix_suggestions: fix_suggestions.to_vec(),
        };

        serde_json::to_string_pretty(&result).unwrap_or_else(|_| "{}".to_string())
    }

    pub fn to_graphviz(
        graph: &DependencyGraph, 
        vulns_map: &HashMap<String, Vec<Vulnerability>>,
        license_map: &HashMap<String, LicenseInfo>,
    ) -> String {
        let mut output = String::from("digraph dependencies {\n");
        output.push_str("    node [shape=box, style=filled];\n");
        output.push_str("    rankdir=TB;\n\n");

        for (key, node) in &graph.node_map {
            let node_data = &graph.graph[*node];
            let has_vulns = vulns_map.contains_key(key);
            let has_gpl = license_map.get(key).map(|l| l.is_gpl_violation).unwrap_or(false);
            
            let color = if has_gpl {
                "purple"
            } else if has_vulns {
                let vulns = vulns_map.get(key).unwrap();
                let max_severity = vulns.iter()
                    .map(|v| &v.severity)
                    .max_by_key(|s| match s.as_str() {
                        "CRITICAL" => 4,
                        "HIGH" => 3,
                        "MEDIUM" => 2,
                        "LOW" => 1,
                        _ => 0,
                    })
                    .unwrap();
                
                match max_severity.as_str() {
                    "CRITICAL" => "red",
                    "HIGH" => "orange",
                    "MEDIUM" => "yellow",
                    "LOW" => "lightblue",
                    _ => "white",
                }
            } else {
                "lightgreen"
            };

            let license = license_map.get(key).map(|l| l.license.as_str()).unwrap_or("Unknown");
            let label = format!("{}|{}\\n{}\\n{}", 
                node_data.name, 
                node_data.version, 
                node_data.language,
                license
            );
            
            output.push_str(&format!(
                "    \"{}\" [label=\"{}\", fillcolor=\"{}\"];\n",
                key, label, color
            ));
        }

        output.push('\n');

        for edge in graph.graph.edge_references() {
            let source = &graph.graph[edge.source()];
            let target = &graph.graph[edge.target()];
            let source_key = format!("{}:{}:{}", source.name, source.version, source.language);
            let target_key = format!("{}:{}:{}", target.name, target.version, target.language);
            
            output.push_str(&format!(
                "    \"{}\" -> \"{}\";\n",
                source_key, target_key
            ));
        }

        output.push_str("\n    subgraph legend {\n");
        output.push_str("        rank=min;\n");
        output.push_str("        node [shape=plaintext];\n");
        output.push_str("        legend [label=<<table border=\"0\" cellpadding=\"2\" cellspacing=\"0\">\n");
        output.push_str("            <tr><td align=\"left\" bgcolor=\"lightgreen\">No Issues</td></tr>\n");
        output.push_str("            <tr><td align=\"left\" bgcolor=\"purple\">GPL License</td></tr>\n");
        output.push_str("            <tr><td align=\"left\" bgcolor=\"lightblue\">Low Vulnerability</td></tr>\n");
        output.push_str("            <tr><td align=\"left\" bgcolor=\"yellow\">Medium Vulnerability</td></tr>\n");
        output.push_str("            <tr><td align=\"left\" bgcolor=\"orange\">High Vulnerability</td></tr>\n");
        output.push_str("            <tr><td align=\"left\" bgcolor=\"red\">Critical Vulnerability</td></tr>\n");
        output.push_str("        </table>>];\n");
        output.push_str("    }\n");

        output.push('}');
        output
    }

    pub fn to_text(
        graph: &DependencyGraph, 
        vulns_map: &HashMap<String, Vec<Vulnerability>>,
        license_map: &HashMap<String, LicenseInfo>,
        fix_suggestions: &[FixSuggestion],
    ) -> String {
        let mut output = String::new();
        
        output.push_str("Dependency Scan Report\n");
        output.push_str("======================\n\n");
        output.push_str(&format!("Total Dependencies: {}\n", graph.node_count()));
        output.push_str(&format!("Total Edges: {}\n", graph.edge_count()));
        output.push_str(&format!("Vulnerable Packages: {}\n", vulns_map.len()));
        output.push_str(&format!("GPL License Violations: {}\n\n", 
            license_map.values().filter(|l| l.is_gpl_violation).count()));

        let gpl_violations: Vec<_> = license_map.values().filter(|l| l.is_gpl_violation).collect();
        if !gpl_violations.is_empty() {
            output.push_str("GPL License Violations Found:\n");
            output.push_str("-----------------------------\n\n");

            for lic in gpl_violations {
                output.push_str(&format!(
                    "Package: {} (v{})\n  License: {}\n\n",
                    lic.package_name, lic.version, lic.license
                ));
            }
        }

        if !vulns_map.is_empty() {
            output.push_str("Vulnerabilities Found:\n");
            output.push_str("----------------------\n\n");

            for (key, vulns) in vulns_map {
                let parts: Vec<&str> = key.split(':').collect();
                if parts.len() >= 3 {
                    output.push_str(&format!("Package: {} ({} {})\n", parts[0], parts[2], parts[1]));
                    for vuln in vulns {
                        output.push_str(&format!(
                            "  - [{}] {}: {}\n",
                            vuln.severity, vuln.cve_id, vuln.description
                        ));
                    }
                    output.push('\n');
                }
            }
        }

        if !fix_suggestions.is_empty() {
            output.push_str("Fix Suggestions:\n");
            output.push_str("----------------\n\n");

            for suggestion in fix_suggestions {
                output.push_str(&format!("Package: {}\n", suggestion.package_name));
                output.push_str(&format!("Current: {}\n", suggestion.current_version));
                output.push_str(&format!("Suggested: {}\n", suggestion.suggested_version));
                output.push_str(&format!("Command: {}\n", suggestion.upgrade_command));
                output.push_str(&format!(
                    "Fixes: {}\n\n",
                    suggestion.vulnerabilities_fixed.join(", ")
                ));
            }
        }

        output.push_str("All Dependencies:\n");
        output.push_str("-----------------\n\n");

        for node in graph.get_all_nodes() {
            let key = format!("{}:{}:{}", node.name, node.version, node.language);
            let license = license_map.get(&key).map(|l| l.license.as_str()).unwrap_or("Unknown");
            output.push_str(&format!("- {} ({} {}) [{}]\n", node.name, node.language, node.version, license));
        }

        output
    }
}
