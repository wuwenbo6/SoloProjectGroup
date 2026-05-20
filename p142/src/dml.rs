use crate::report::{ConversionReport, Incompatibility};
use regex::Regex;

pub struct DMLConverter;

impl DMLConverter {
    pub fn new() -> Self {
        Self
    }

    pub fn convert_select(&self, sql: &str, report: &mut ConversionReport) -> String {
        let mut result = sql.to_string();

        result = self.convert_concat(&result, report);
        result = self.convert_date_functions(&result, report);
        result = self.convert_nvl(&result, report);
        result = self.convert_limit_fetch(&result, report);
        result = self.convert_with_ur(&result, report);

        result
    }

    pub fn convert_insert(&self, sql: &str, report: &mut ConversionReport) -> String {
        let mut result = sql.to_string();

        result = self.convert_select(&result, report);

        result
    }

    pub fn convert_update(&self, sql: &str, report: &mut ConversionReport) -> String {
        let mut result = sql.to_string();

        result = self.convert_select(&result, report);

        result
    }

    pub fn convert_delete(&self, sql: &str, report: &mut ConversionReport) -> String {
        let mut result = sql.to_string();

        result = self.convert_select(&result, report);

        result
    }

    fn convert_concat(&self, sql: &str, report: &mut ConversionReport) -> String {
        let re = Regex::new(r"(?i)CONCAT\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)").unwrap();
        let mut result = sql.to_string();

        for caps in re.captures_iter(sql) {
            let original = &caps[0];
            let a = &caps[1];
            let b = &caps[2];
            let converted = format!("{} || {}", a, b);
            result = result.replace(original, &converted);

            report.add_incompatibility(
                Incompatibility::info(
                    0,
                    "Function",
                    original,
                    "CONCAT function converted to PostgreSQL || operator"
                )
                .with_converted(&converted)
            );
        }

        result
    }

    fn convert_date_functions(&self, sql: &str, report: &mut ConversionReport) -> String {
        let mut result = sql.to_string();

        result = result.replace("CURRENT DATE", "CURRENT_DATE");
        result = result.replace("CURRENT TIME", "CURRENT_TIME");
        result = result.replace("CURRENT TIMESTAMP", "CURRENT_TIMESTAMP");

        let date_re = Regex::new(r"(?i)CURRENT\s+DATE").unwrap();
        if date_re.is_match(sql) {
            report.add_incompatibility(
                Incompatibility::info(
                    0,
                    "Date Function",
                    "CURRENT DATE",
                    "DB2 CURRENT DATE converted to PostgreSQL CURRENT_DATE"
                )
                .with_converted("CURRENT_DATE")
            );
        }

        result
    }

    fn convert_nvl(&self, sql: &str, report: &mut ConversionReport) -> String {
        let re = Regex::new(r"(?i)NVL\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)").unwrap();
        let mut result = sql.to_string();

        for caps in re.captures_iter(sql) {
            let original = &caps[0];
            let expr = &caps[1];
            let default = &caps[2];
            let converted = format!("COALESCE({}, {})", expr, default);
            result = result.replace(original, &converted);

            report.add_incompatibility(
                Incompatibility::info(
                    0,
                    "Function",
                    original,
                    "NVL function converted to PostgreSQL COALESCE"
                )
                .with_converted(&converted)
            );
        }

        result
    }

    fn convert_limit_fetch(&self, sql: &str, report: &mut ConversionReport) -> String {
        let re = Regex::new(r"(?i)FETCH\s+FIRST\s+(\d+)\s+ROWS?\s+ONLY").unwrap();
        let mut result = sql.to_string();

        for caps in re.captures_iter(sql) {
            let original = &caps[0];
            let n = &caps[1];
            let converted = format!("LIMIT {}", n);
            result = result.replace(original, &converted);

            report.add_incompatibility(
                Incompatibility::info(
                    0,
                    "Pagination",
                    original,
                    "FETCH FIRST clause converted to PostgreSQL LIMIT"
                )
                .with_converted(&converted)
            );
        }

        result
    }

    fn convert_with_ur(&self, sql: &str, report: &mut ConversionReport) -> String {
        let mut result = sql.to_string();

        if result.contains("WITH UR") || result.contains("WITH RR") || 
           result.contains("WITH CS") || result.contains("WITH RS") {
            
            report.add_incompatibility(
                Incompatibility::medium(
                    0,
                    "Isolation Level",
                    "WITH UR/RR/CS/RS",
                    "DB2 isolation level clause removed - PostgreSQL uses SET TRANSACTION ISOLATION LEVEL"
                )
                .with_suggestion("Use BEGIN ISOLATION LEVEL ... or SET TRANSACTION ISOLATION LEVEL")
            );

            result = Regex::new(r"(?i)\s+WITH\s+(UR|RR|CS|RS)\b").unwrap()
                .replace_all(&result, "")
                .to_string();
        }

        result
    }
}
