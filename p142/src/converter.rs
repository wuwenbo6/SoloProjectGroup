use crate::ddl::DDLConverter;
use crate::dml::DMLConverter;
use crate::report::{ConversionReport, Incompatibility};
use crate::stored_proc::StoredProcConverter;
use regex::Regex;

pub struct SQLConverter {
    ddl_converter: DDLConverter,
    dml_converter: DMLConverter,
    sp_converter: StoredProcConverter,
}

impl SQLConverter {
    pub fn new() -> Self {
        Self {
            ddl_converter: DDLConverter::new(),
            dml_converter: DMLConverter::new(),
            sp_converter: StoredProcConverter::new(),
        }
    }

    pub fn convert_sql(&self, input: &str, report: &mut ConversionReport) -> String {
        let statements = self.split_statements(input);
        report.total_statements = statements.len();

        let mut converted = Vec::new();

        for stmt in statements {
            let conv_stmt = self.convert_statement(&stmt, report);
            converted.push(conv_stmt);
            report.converted_statements += 1;
        }

        converted.join(";\n\n")
    }

    fn split_statements(&self, input: &str) -> Vec<String> {
        let mut statements = Vec::new();
        let mut current = String::new();
        let mut in_string = false;
        let mut string_char = ' ';
        let mut in_comment = false;

        for c in input.chars() {
            match c {
                '\'' if !in_comment => {
                    if in_string && string_char == '\'' {
                        in_string = false;
                    } else if !in_string {
                        in_string = true;
                        string_char = '\'';
                    }
                    current.push(c);
                }
                '"' if !in_comment => {
                    if in_string && string_char == '"' {
                        in_string = false;
                    } else if !in_string {
                        in_string = true;
                        string_char = '"';
                    }
                    current.push(c);
                }
                ';' if !in_string && !in_comment => {
                    let trimmed = current.trim();
                    if !trimmed.is_empty() {
                        statements.push(trimmed.to_string());
                    }
                    current.clear();
                }
                '-' if !in_string && !in_comment => {
                    if current.ends_with('-') {
                        in_comment = true;
                        current.pop();
                    } else {
                        current.push(c);
                    }
                }
                '\n' if in_comment => {
                    in_comment = false;
                }
                _ if !in_comment => {
                    current.push(c);
                }
                _ => {}
            }
        }

        let trimmed = current.trim();
        if !trimmed.is_empty() {
            statements.push(trimmed.to_string());
        }

        statements
    }

    fn convert_statement(&self, stmt: &str, report: &mut ConversionReport) -> String {
        let upper_stmt = stmt.to_uppercase();

        if upper_stmt.starts_with("CREATE TABLE") {
            self.ddl_converter.convert_create_table(stmt, report)
        } else if upper_stmt.starts_with("CREATE INDEX") {
            self.ddl_converter.convert_create_index(stmt, report)
        } else if upper_stmt.starts_with("CREATE SEQUENCE") {
            self.ddl_converter.convert_create_sequence(stmt, report)
        } else if upper_stmt.starts_with("CREATE TRIGGER") || upper_stmt.starts_with("CREATE OR REPLACE TRIGGER") {
            self.ddl_converter.convert_create_trigger(stmt, report)
        } else if upper_stmt.starts_with("SELECT") {
            self.dml_converter.convert_select(stmt, report)
        } else if upper_stmt.starts_with("INSERT") {
            self.dml_converter.convert_insert(stmt, report)
        } else if upper_stmt.starts_with("UPDATE") {
            self.dml_converter.convert_update(stmt, report)
        } else if upper_stmt.starts_with("DELETE") {
            self.dml_converter.convert_delete(stmt, report)
        } else if upper_stmt.starts_with("CREATE PROCEDURE") || upper_stmt.starts_with("CREATE OR REPLACE PROCEDURE") {
            self.sp_converter.convert_procedure(stmt, report)
        } else {
            report.add_incompatibility(
                Incompatibility::medium(
                    0,
                    "Unknown Statement",
                    &stmt[..std::cmp::min(50, stmt.len())],
                    "Statement type not recognized, passed through unchanged"
                )
            );
            stmt.to_string()
        }
    }
}
