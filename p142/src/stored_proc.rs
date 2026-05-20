use crate::report::{ConversionReport, Incompatibility};
use regex::Regex;

pub struct StoredProcConverter;

impl StoredProcConverter {
    pub fn new() -> Self {
        Self
    }

    pub fn convert_procedure(&self, sql: &str, report: &mut ConversionReport) -> String {
        let mut result = sql.to_string();

        result = self.convert_procedure_declaration(&result, report);
        result = self.convert_variable_declarations(&result, report);
        result = self.convert_cursor_declarations(&result, report);
        result = self.convert_condition_handlers(&result, report);
        result = self.convert_control_flow(&result, report);
        result = self.convert_cursor_operations(&result, report);

        result
    }

    fn convert_procedure_declaration(&self, sql: &str, report: &mut ConversionReport) -> String {
        let re = Regex::new(r"(?i)CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+(\w+)\s*\(([^)]*)\)\s*(?:LANGUAGE\s+SQL\s*)?").unwrap();
        let mut result = sql.to_string();

        if let Some(caps) = re.captures(sql) {
            let proc_name = &caps[1];
            let params = &caps[2];
            let original = caps[0].to_string();

            let pg_params = self.convert_procedure_params(params, report);

            let converted = format!(
                "CREATE OR REPLACE PROCEDURE {}()\nLANGUAGE plpgsql\nAS $$",
                proc_name
            );

            if !pg_params.is_empty() {
                report.add_incompatibility(
                    Incompatibility::high(
                        0,
                        "Procedure Parameters",
                        &original,
                        "Procedure parameters require manual conversion to PL/pgSQL format"
                    )
                    .with_suggestion("Review parameter types and direction (IN/OUT/INOUT)")
                );
            }

            result = result.replace(&original, &converted);
        }

        if result.contains("END @") || result.contains("END;") {
            result = result.replace("END @", "END;\n$$;");
            result = result.replace("END;", "END;\n$$;");
        }

        result
    }

    fn convert_procedure_params(&self, params: &str, _report: &mut ConversionReport) -> String {
        params.to_string()
    }

    fn convert_variable_declarations(&self, sql: &str, report: &mut ConversionReport) -> String {
        let re = Regex::new(r"(?i)(DECLARE|DECLARE\s+)(\w+)\s+(\w+(?:\s*\([^)]+\))?)").unwrap();
        let mut result = sql.to_string();

        for caps in re.captures_iter(sql) {
            let original = caps[0].to_string();
            let var_name = &caps[2];
            let var_type = &caps[3];

            let converted = format!("\nDECLARE\n    {} {};", var_name, var_type);

            result = result.replace(&original, &converted);

            report.add_incompatibility(
                Incompatibility::medium(
                    0,
                    "Variable Declaration",
                    &original,
                    "DB2 variable declaration converted to PL/pgSQL format"
                )
                .with_converted(&converted)
            );
        }

        result
    }

    fn convert_cursor_declarations(&self, sql: &str, report: &mut ConversionReport) -> String {
        let re_with_return = Regex::new(r"(?i)DECLARE\s+(\w+)\s+CURSOR\s+(?:WITH\s+RETURN(?:\s+TO\s+CALLER)?\s+)?FOR\s+(.+?)(?:;|\n|$)").unwrap();
        let re_without_return = Regex::new(r"(?i)DECLARE\s+(\w+)\s+CURSOR\s+(?:WITHOUT\s+RETURN\s+)?FOR\s+(.+?)(?:;|\n|$)").unwrap();
        let mut result = sql.to_string();

        for caps in re_with_return.captures_iter(sql) {
            let original = caps[0].to_string();
            let cursor_name = &caps[1];
            let query = &caps[2];

            let converted = format!(
                "\n-- DB2 WITH RETURN cursor: use RETURN QUERY instead in PostgreSQL\nDECLARE {} CURSOR FOR {};\n-- Note: To return result set, use: RETURN QUERY {};",
                cursor_name, query, query
            );

            result = result.replace(&original, &converted);

            report.add_incompatibility(
                Incompatibility::high(
                    0,
                    "Cursor WITH RETURN",
                    &original,
                    "DB2 WITH RETURN cursor requires different pattern in PostgreSQL"
                )
                .with_converted(&converted)
                .with_suggestion("In PostgreSQL procedures, use RETURN QUERY to return result sets, or use refcursor parameters")
            );
        }

        for caps in re_without_return.captures_iter(sql) {
            let original = caps[0].to_string();
            let cursor_name = &caps[1];
            let query = &caps[2];

            if result.contains(&original) {
                let converted = format!("\nDECLARE {} CURSOR FOR {};", cursor_name, query);

                result = result.replace(&original, &converted);

                report.add_incompatibility(
                    Incompatibility::info(
                        0,
                        "Cursor Declaration",
                        &original,
                        "DB2 cursor declaration converted to PL/pgSQL format"
                    )
                    .with_converted(&converted)
                );
            }
        }

        result
    }

    fn convert_condition_handlers(&self, sql: &str, report: &mut ConversionReport) -> String {
        let re = Regex::new(r"(?i)DECLARE\s+(CONTINUE|EXIT)\s+HANDLER\s+FOR\s+([^\s]+)\s+(.+?)(?:;|\n|$)").unwrap();
        let mut result = sql.to_string();

        for caps in re.captures_iter(sql) {
            let original = caps[0].to_string();
            let handler_type = &caps[1];
            let condition = &caps[2];
            let action = &caps[3];

            let pg_condition = match condition.to_uppercase().as_str() {
                "NOTFOUND" => "NOT FOUND",
                _ => condition,
            };

            let converted = format!(
                "EXCEPTION\n    WHEN {} THEN\n        {};",
                pg_condition, action
            );

            result = result.replace(&original, &converted);

            report.add_incompatibility(
                Incompatibility::high(
                    0,
                    "Condition Handler",
                    &original,
                    "DB2 condition handler converted to PL/pgSQL EXCEPTION block"
                )
                .with_converted(&converted)
                .with_suggestion("Review exception handling logic - PL/pgSQL structure differs from DB2")
            );
        }

        result
    }

    fn convert_control_flow(&self, sql: &str, report: &mut ConversionReport) -> String {
        let mut result = sql.to_string();

        result = result.replace("THEN SET", "THEN");
        result = result.replace("END IF;", "END IF;");
        result = result.replace("ELSEIF", "ELSIF");

        let re = Regex::new(r"(?i)SET\s+(\w+)\s*=\s*(.+?)(?:;|\n|$)").unwrap();
        for caps in re.captures_iter(sql) {
            let original = caps[0].to_string();
            let var_name = &caps[1];
            let value = &caps[2];
            let converted = format!("{} := {};", var_name, value);
            result = result.replace(&original, &converted);
        }

        let while_re = Regex::new(r"(?i)WHILE\s+(.+?)\s+DO").unwrap();
        if while_re.is_match(sql) {
            report.add_incompatibility(
                Incompatibility::info(
                    0,
                    "Control Flow",
                    "WHILE loop",
                    "WHILE loop syntax is compatible"
                )
            );
        }

        result
    }

    fn convert_cursor_operations(&self, sql: &str, report: &mut ConversionReport) -> String {
        let mut result = sql.to_string();

        let open_re = Regex::new(r"(?i)OPEN\s+(\w+)").unwrap();
        if open_re.is_match(sql) {
            report.add_incompatibility(
                Incompatibility::info(
                    0,
                    "Cursor Operation",
                    "OPEN",
                    "OPEN cursor syntax is compatible"
                )
            );
        }

        let close_re = Regex::new(r"(?i)CLOSE\s+(\w+)").unwrap();
        if close_re.is_match(sql) {
            report.add_incompatibility(
                Incompatibility::info(
                    0,
                    "Cursor Operation",
                    "CLOSE",
                    "CLOSE cursor syntax is compatible"
                )
            );
        }

        let fetch_re = Regex::new(r"(?i)FETCH\s+FROM\s+(\w+)\s+INTO\s+(.+?)(?:;|\n|$)").unwrap();
        for caps in fetch_re.captures_iter(sql) {
            let original = caps[0].to_string();
            let cursor_name = &caps[1];
            let vars = &caps[2];
            let converted = format!("FETCH {} INTO {};", cursor_name, vars);
            result = result.replace(&original, &converted);
        }

        result
    }
}
