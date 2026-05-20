use crate::report::ConversionReport;
use regex::Regex;
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct TableValidation {
    pub table_name: String,
    pub source_row_count: Option<u64>,
    pub target_row_count: Option<u64>,
    pub source_checksum: Option<String>,
    pub target_checksum: Option<String>,
    pub columns: Vec<String>,
}

impl TableValidation {
    pub fn new(table_name: &str) -> Self {
        Self {
            table_name: table_name.to_string(),
            source_row_count: None,
            target_row_count: None,
            source_checksum: None,
            target_checksum: None,
            columns: Vec::new(),
        }
    }

    pub fn row_count_match(&self) -> Option<bool> {
        match (self.source_row_count, self.target_row_count) {
            (Some(s), Some(t)) => Some(s == t),
            _ => None,
        }
    }

    pub fn checksum_match(&self) -> Option<bool> {
        match (&self.source_checksum, &self.target_checksum) {
            (Some(s), Some(t)) => Some(s == t),
            _ => None,
        }
    }
}

pub struct DataValidator {
    tables: Vec<TableValidation>,
}

impl DataValidator {
    pub fn new() -> Self {
        Self { tables: Vec::new() }
    }

    pub fn extract_tables_from_ddl(&mut self, ddl: &str) {
        let re = Regex::new(r"(?i)CREATE\s+TABLE\s+(\w+)").unwrap();
        for caps in re.captures_iter(ddl) {
            let table_name = &caps[1];
            self.tables.push(TableValidation::new(table_name));
        }
    }

    pub fn generate_row_count_query(&self, table_name: &str, db_type: &str) -> String {
        match db_type.to_uppercase().as_str() {
            "DB2" => format!("SELECT COUNT(*) AS row_count FROM {};", table_name),
            "PG" | "POSTGRESQL" => format!("SELECT COUNT(*) AS row_count FROM {};", table_name),
            _ => format!("SELECT COUNT(*) AS row_count FROM {};", table_name),
        }
    }

    pub fn generate_checksum_query(&self, table_name: &str, columns: &[String], db_type: &str) -> String {
        let col_expr = if columns.is_empty() {
            "*".to_string()
        } else {
            columns.join(" || '|' || ")
        };

        match db_type.to_uppercase().as_str() {
            "DB2" => format!(
                "SELECT HEX(MD5({})) AS checksum FROM {};",
                col_expr, table_name
            ),
            "PG" | "POSTGRESQL" => format!(
                "SELECT MD5({}) AS checksum FROM {};",
                col_expr, table_name
            ),
            _ => format!(
                "SELECT MD5({}) AS checksum FROM {};",
                col_expr, table_name
            ),
        }
    }

    pub fn generate_full_checksum_query(&self, table_name: &str, columns: &[String], db_type: &str) -> String {
        let col_expr = if columns.is_empty() {
            "*".to_string()
        } else {
            columns.join(" || '|' || ")
        };

        match db_type.to_uppercase().as_str() {
            "DB2" => format!(
                "SELECT COUNT(*) AS row_count, HEX(MD5({})) AS checksum FROM {};",
                col_expr, table_name
            ),
            "PG" | "POSTGRESQL" => format!(
                "SELECT COUNT(*) AS row_count, MD5({}) AS checksum FROM {};",
                col_expr, table_name
            ),
            _ => format!(
                "SELECT COUNT(*) AS row_count, MD5({}) AS checksum FROM {};",
                col_expr, table_name
            ),
        }
    }

    pub fn generate_validation_script(&self, schema_name: Option<&str>) -> String {
        let mut script = String::new();

        script.push_str("-- ========================================\n");
        script.push_str("-- Data Validation Script\n");
        script.push_str("-- ========================================\n\n");

        script.push_str("-- 1. Source (DB2) Validation Queries\n");
        script.push_str("-- ----------------------------------------\n");
        for table in &self.tables {
            let full_name = if let Some(schema) = schema_name {
                format!("{}.{}", schema, table.table_name)
            } else {
                table.table_name.clone()
            };
            script.push_str(&format!("-- Table: {}\n", full_name));
            script.push_str(&self.generate_full_checksum_query(&full_name, &table.columns, "DB2"));
            script.push_str("\n\n");
        }

        script.push_str("-- 2. Target (PostgreSQL) Validation Queries\n");
        script.push_str("-- ----------------------------------------\n");
        for table in &self.tables {
            let full_name = if let Some(schema) = schema_name {
                format!("{}.{}", schema, table.table_name)
            } else {
                table.table_name.clone()
            };
            script.push_str(&format!("-- Table: {}\n", full_name));
            script.push_str(&self.generate_full_checksum_query(&full_name, &table.columns, "PG"));
            script.push_str("\n\n");
        }

        script.push_str("-- 3. Validation Comparison Report\n");
        script.push_str("-- ----------------------------------------\n");
        script.push_str("-- Run the above queries on both databases and compare:\n");
        script.push_str("-- - row_count: Must match exactly\n");
        script.push_str("-- - checksum: Must match exactly (if using same algorithm)\n\n");

        script.push_str("-- 4. Data Sampling (for debugging mismatches)\n");
        script.push_str("-- ----------------------------------------\n");
        for table in &self.tables {
            script.push_str(&format!("-- SELECT * FROM {} ORDER BY 1 LIMIT 10;\n", table.table_name));
        }

        script
    }

    pub fn add_table(&mut self, table: TableValidation) {
        self.tables.push(table);
    }

    pub fn tables(&self) -> &[TableValidation] {
        &self.tables
    }
}

pub fn generate_validation_report(
    validations: &[TableValidation],
    report: &mut ConversionReport,
) -> String {
    let mut output = String::new();

    output.push_str("=== Data Validation Report ===\n\n");

    let mut total_tables = 0;
    let mut matched_rows = 0;
    let mut matched_checksums = 0;
    let mut mismatched = Vec::new();

    for validation in validations {
        total_tables += 1;

        output.push_str(&format!("Table: {}\n", validation.table_name));
        output.push_str(&format!(
            "  Source Rows: {}\n",
            validation
                .source_row_count
                .map_or("N/A".to_string(), |n| n.to_string())
        ));
        output.push_str(&format!(
            "  Target Rows: {}\n",
            validation
                .target_row_count
                .map_or("N/A".to_string(), |n| n.to_string())
        ));
        output.push_str(&format!(
            "  Row Count Match: {}\n",
            validation
                .row_count_match()
                .map_or("N/A".to_string(), |b| if b { "✓ YES" } else { "✗ NO" }.to_string())
        ));

        if let Some(false) = validation.row_count_match() {
            mismatched.push(format!("{}: row count mismatch", validation.table_name));
        } else if validation.row_count_match() == Some(true) {
            matched_rows += 1;
        }

        output.push_str(&format!(
            "  Source Checksum: {}\n",
            validation
                .source_checksum
                .as_ref()
                .map_or("N/A", |s| s.as_str())
        ));
        output.push_str(&format!(
            "  Target Checksum: {}\n",
            validation
                .target_checksum
                .as_ref()
                .map_or("N/A", |s| s.as_str())
        ));
        output.push_str(&format!(
            "  Checksum Match: {}\n\n",
            validation
                .checksum_match()
                .map_or("N/A".to_string(), |b| if b { "✓ YES" } else { "✗ NO" }.to_string())
        ));

        if let Some(false) = validation.checksum_match() {
            mismatched.push(format!("{}: checksum mismatch", validation.table_name));
        } else if validation.checksum_match() == Some(true) {
            matched_checksums += 1;
        }
    }

    output.push_str("--- Summary ---\n");
    output.push_str(&format!("Total Tables: {}\n", total_tables));
    output.push_str(&format!("Row Count Matches: {}/{}\n", matched_rows, total_tables));
    output.push_str(&format!(
        "Checksum Matches: {}/{}\n",
        matched_checksums, total_tables
    ));

    if !mismatched.is_empty() {
        output.push_str("\n--- Issues Found ---\n");
        for issue in mismatched {
            output.push_str(&format!("  ✗ {}\n", issue));
        }
    } else {
        output.push_str("\n  ✓ All validations passed!\n");
    }

    output
}
