use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IncompatibilitySeverity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Incompatibility {
    pub line_number: usize,
    pub severity: IncompatibilitySeverity,
    pub category: String,
    pub original: String,
    pub converted: Option<String>,
    pub description: String,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversionReport {
    pub input_file: String,
    pub output_file: Option<String>,
    pub total_statements: usize,
    pub converted_statements: usize,
    pub incompatibilities: Vec<Incompatibility>,
    pub type_mappings: HashMap<String, String>,
    pub summary: ReportSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportSummary {
    pub critical_count: usize,
    pub high_count: usize,
    pub medium_count: usize,
    pub low_count: usize,
    pub info_count: usize,
}

impl ConversionReport {
    pub fn new(input_file: &str) -> Self {
        Self {
            input_file: input_file.to_string(),
            output_file: None,
            total_statements: 0,
            converted_statements: 0,
            incompatibilities: Vec::new(),
            type_mappings: HashMap::new(),
            summary: ReportSummary {
                critical_count: 0,
                high_count: 0,
                medium_count: 0,
                low_count: 0,
                info_count: 0,
            },
        }
    }

    pub fn add_incompatibility(&mut self, incompat: Incompatibility) {
        match incompat.severity {
            IncompatibilitySeverity::Critical => self.summary.critical_count += 1,
            IncompatibilitySeverity::High => self.summary.high_count += 1,
            IncompatibilitySeverity::Medium => self.summary.medium_count += 1,
            IncompatibilitySeverity::Low => self.summary.low_count += 1,
            IncompatibilitySeverity::Info => self.summary.info_count += 1,
        }
        self.incompatibilities.push(incompat);
    }

    pub fn add_type_mapping(&mut self, db2_type: &str, pg_type: &str) {
        self.type_mappings.insert(db2_type.to_string(), pg_type.to_string());
    }

    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(self)
    }

    pub fn to_text(&self) -> String {
        let mut output = String::new();
        
        output.push_str(&format!("=== DB2 to PostgreSQL Conversion Report ===\n\n"));
        output.push_str(&format!("Input File: {}\n", self.input_file));
        if let Some(ref out) = self.output_file {
            output.push_str(&format!("Output File: {}\n", out));
        }
        output.push_str(&format!("\nTotal Statements: {}\n", self.total_statements));
        output.push_str(&format!("Converted Statements: {}\n\n", self.converted_statements));
        
        output.push_str(&format!("--- Summary ---\n"));
        output.push_str(&format!("Critical Issues: {}\n", self.summary.critical_count));
        output.push_str(&format!("High Priority Issues: {}\n", self.summary.high_count));
        output.push_str(&format!("Medium Priority Issues: {}\n", self.summary.medium_count));
        output.push_str(&format!("Low Priority Issues: {}\n", self.summary.low_count));
        output.push_str(&format!("Info Notes: {}\n\n", self.summary.info_count));
        
        if !self.type_mappings.is_empty() {
            output.push_str(&format!("--- Type Mappings ---\n"));
            for (db2, pg) in &self.type_mappings {
                output.push_str(&format!("  {} -> {}\n", db2, pg));
            }
            output.push_str("\n");
        }
        
        if !self.incompatibilities.is_empty() {
            output.push_str(&format!("--- Incompatibilities ---\n\n"));
            for (i, incompat) in self.incompatibilities.iter().enumerate() {
                let severity = match incompat.severity {
                    IncompatibilitySeverity::Critical => "CRITICAL",
                    IncompatibilitySeverity::High => "HIGH",
                    IncompatibilitySeverity::Medium => "MEDIUM",
                    IncompatibilitySeverity::Low => "LOW",
                    IncompatibilitySeverity::Info => "INFO",
                };
                
                output.push_str(&format!("[{}] #{} - Line {}\n", severity, i + 1, incompat.line_number));
                output.push_str(&format!("  Category: {}\n", incompat.category));
                output.push_str(&format!("  Original: {}\n", incompat.original));
                if let Some(ref conv) = incompat.converted {
                    output.push_str(&format!("  Converted: {}\n", conv));
                }
                output.push_str(&format!("  Description: {}\n", incompat.description));
                if let Some(ref sugg) = incompat.suggestion {
                    output.push_str(&format!("  Suggestion: {}\n", sugg));
                }
                output.push_str("\n");
            }
        }
        
        output.push_str(&format!("=== End of Report ===\n"));
        output
    }
}

impl Incompatibility {
    pub fn critical(line: usize, category: &str, original: &str, description: &str) -> Self {
        Self {
            line_number: line,
            severity: IncompatibilitySeverity::Critical,
            category: category.to_string(),
            original: original.to_string(),
            converted: None,
            description: description.to_string(),
            suggestion: None,
        }
    }

    pub fn high(line: usize, category: &str, original: &str, description: &str) -> Self {
        Self {
            line_number: line,
            severity: IncompatibilitySeverity::High,
            category: category.to_string(),
            original: original.to_string(),
            converted: None,
            description: description.to_string(),
            suggestion: None,
        }
    }

    pub fn medium(line: usize, category: &str, original: &str, description: &str) -> Self {
        Self {
            line_number: line,
            severity: IncompatibilitySeverity::Medium,
            category: category.to_string(),
            original: original.to_string(),
            converted: None,
            description: description.to_string(),
            suggestion: None,
        }
    }

    pub fn info(line: usize, category: &str, original: &str, description: &str) -> Self {
        Self {
            line_number: line,
            severity: IncompatibilitySeverity::Info,
            category: category.to_string(),
            original: original.to_string(),
            converted: None,
            description: description.to_string(),
            suggestion: None,
        }
    }

    pub fn with_converted(mut self, converted: &str) -> Self {
        self.converted = Some(converted.to_string());
        self
    }

    pub fn with_suggestion(mut self, suggestion: &str) -> Self {
        self.suggestion = Some(suggestion.to_string());
        self
    }
}
