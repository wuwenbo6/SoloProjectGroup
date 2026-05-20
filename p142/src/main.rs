mod cli;
mod converter;
mod ddl;
mod dml;
mod report;
mod schema_diff;
mod stored_proc;
mod type_mapping;
mod data_validation;
mod bulk_load;
mod rollback;

use cli::{Cli, Commands};
use converter::SQLConverter;
use report::ConversionReport;
use schema_diff::SchemaDiffer;
use data_validation::DataValidator;
use bulk_load::{BulkLoadConfig, BulkLoadGenerator, LoadFormat};
use rollback::RollbackGenerator;
use std::fs;

fn main() {
    let cli = Cli::parse();

    match cli.command {
        Commands::Convert { input, output, report, json, rollback_output } => {
            handle_convert(&input, output.as_ref(), report.as_ref(), json, rollback_output.as_ref());
        }
        Commands::Report { input, output, json } => {
            handle_report(&input, output.as_ref(), json);
        }
        Commands::Diff { old, new, output, rollback_output } => {
            handle_diff(&old, &new, output.as_ref(), rollback_output.as_ref());
        }
        Commands::Validate { input, output, schema, tables } => {
            handle_validate(input.as_ref(), output.as_ref(), schema.as_ref(), tables.as_ref());
        }
        Commands::Bulkload { output, table, input_file, workers, format, tables, truncate, disable_triggers, disable_indexes } => {
            handle_bulkload(output.as_ref(), &table, &input_file, workers, format.as_ref(), tables.as_ref(), truncate, disable_triggers, disable_indexes);
        }
        Commands::Rollback { input, output } => {
            handle_rollback(&input, output.as_ref());
        }
    }
}

fn handle_convert(input: &std::path::Path, output: Option<&std::path::Path>, report_path: Option<&std::path::Path>, json: bool, rollback_output: Option<&std::path::Path>) {
    let input_sql = fs::read_to_string(input).expect("Failed to read input file");

    let mut report = ConversionReport::new(input.to_str().unwrap_or("unknown"));
    let converter = SQLConverter::new();
    let output_sql = converter.convert_sql(&input_sql, &mut report);

    if let Some(out_path) = output {
        fs::write(out_path, &output_sql).expect("Failed to write output file");
        println!("Converted SQL written to: {}", out_path.display());
    } else {
        println!("\n=== Converted SQL ===\n");
        println!("{}", output_sql);
    }

    let report_content = if json {
        serde_json::to_string_pretty(&report).expect("Failed to serialize report")
    } else {
        report.to_text()
    };

    if let Some(rpt_path) = report_path {
        fs::write(rpt_path, &report_content).expect("Failed to write report file");
        println!("\nReport written to: {}", rpt_path.display());
    } else {
        println!("\n=== Migration Report ===\n");
        println!("{}", report_content);
    }

    if let Some(rb_path) = rollback_output {
        let mut rollback_gen = RollbackGenerator::new();
        rollback_gen.analyze_migration(&output_sql);
        let rollback_script = rollback_gen.generate_rollback_script();
        fs::write(rb_path, &rollback_script).expect("Failed to write rollback script");
        println!("\nRollback script written to: {}", rb_path.display());
    }
}

fn handle_report(input: &std::path::Path, output: Option<&std::path::Path>, json: bool) {
    let input_sql = fs::read_to_string(input).expect("Failed to read input file");

    let mut report = ConversionReport::new(input.to_str().unwrap_or("unknown"));
    let converter = SQLConverter::new();
    let _ = converter.convert_sql(&input_sql, &mut report);

    let report_content = if json {
        serde_json::to_string_pretty(&report).expect("Failed to serialize report")
    } else {
        report.to_text()
    };

    if let Some(out_path) = output {
        fs::write(out_path, &report_content).expect("Failed to write report file");
        println!("Report written to: {}", out_path.display());
    } else {
        println!("{}", report_content);
    }
}

fn handle_diff(old_path: &std::path::Path, new_path: &std::path::Path, output: Option<&std::path::Path>, rollback_output: Option<&std::path::Path>) {
    let old_json = fs::read_to_string(old_path).expect("Failed to read old schema file");
    let new_json = fs::read_to_string(new_path).expect("Failed to read new schema file");

    let old_schema: Vec<schema_diff::TableSchema> = serde_json::from_str(&old_json).expect("Failed to parse old schema");
    let new_schema: Vec<schema_diff::TableSchema> = serde_json::from_str(&new_json).expect("Failed to parse new schema");

    let differ = SchemaDiffer::new();
    let diffs = differ.compare_schemas(&old_schema, &new_schema);
    let migration_script = differ.generate_migration_script(&diffs);

    if let Some(out_path) = output {
        fs::write(out_path, &migration_script).expect("Failed to write migration script");
        println!("Migration script written to: {}", out_path.display());
    } else {
        println!("\n=== Incremental Migration Script ===\n");
        println!("{}", migration_script);
    }

    if let Some(rb_path) = rollback_output {
        let mut rollback_gen = RollbackGenerator::new();
        rollback_gen.analyze_migration(&migration_script);
        let rollback_script = rollback_gen.generate_rollback_script();
        fs::write(rb_path, &rollback_script).expect("Failed to write rollback script");
        println!("\nRollback script written to: {}", rb_path.display());
    }
}

fn handle_validate(input: Option<&std::path::Path>, output: Option<&std::path::Path>, schema: Option<&String>, tables: Option<&Vec<String>>) {
    let mut validator = DataValidator::new();

    if let Some(in_path) = input {
        let input_sql = fs::read_to_string(in_path).expect("Failed to read input file");
        validator.extract_tables_from_ddl(&input_sql);
    } else if let Some(tbl_list) = tables {
        for tbl in tbl_list {
            validator.add_table(data_validation::TableValidation::new(tbl));
        }
    }

    let validation_script = validator.generate_validation_script(schema.map(|s| s.as_str()));

    if let Some(out_path) = output {
        fs::write(out_path, &validation_script).expect("Failed to write validation script");
        println!("Validation script written to: {}", out_path.display());
    } else {
        println!("\n=== Data Validation Script ===\n");
        println!("{}", validation_script);
    }
}

fn handle_bulkload(output: Option<&std::path::Path>, table: &str, input_file: &str, workers: u32, format: Option<&String>, tables: Option<&Vec<String>>, truncate: bool, disable_triggers: bool, disable_indexes: bool) {
    let generator = BulkLoadGenerator::new();

    let load_format = match format.map(|s| s.to_uppercase().as_str()) {
        Some("CSV") => LoadFormat::CSV,
        Some("TSV") => LoadFormat::TSV,
        Some("FIXED") => LoadFormat::Fixed,
        Some("BINARY") => LoadFormat::Binary,
        _ => LoadFormat::CSV,
    };

    let config = BulkLoadConfig {
        table_name: table.to_string(),
        input_file: input_file.to_string(),
        format: load_format,
        delimiter: ',',
        null_string: "\\N".to_string(),
        skip_rows: 0,
        parallel_workers: workers,
        batch_size: 10000,
        columns: Vec::new(),
        truncate,
        disable_triggers,
        disable_indexes,
    };

    let mut full_script = String::new();
    full_script.push_str(&generator.generate_pg_bulkload_script(&config));

    if let Some(tbl_list) = tables {
        if !tbl_list.is_empty() {
            full_script.push_str("\n\n");
            full_script.push_str(&generator.generate_parallel_load_plan(tbl_list, workers));
        }
    }

    if let Some(out_path) = output {
        fs::write(out_path, &full_script).expect("Failed to write bulk load script");
        println!("Bulk load script written to: {}", out_path.display());
    } else {
        println!("\n=== Bulk Data Load Script ===\n");
        println!("{}", full_script);
    }
}

fn handle_rollback(input: &std::path::Path, output: Option<&std::path::Path>) {
    let migration_sql = fs::read_to_string(input).expect("Failed to read migration file");

    let mut rollback_gen = RollbackGenerator::new();
    rollback_gen.analyze_migration(&migration_sql);
    let rollback_script = rollback_gen.generate_rollback_script();

    if let Some(out_path) = output {
        fs::write(out_path, &rollback_script).expect("Failed to write rollback script");
        println!("Rollback script written to: {}", out_path.display());
    } else {
        println!("\n=== Rollback Script ===\n");
        println!("{}", rollback_script);
    }
}
