use clap::{Parser, Subcommand};
use std::path::PathBuf;

#[derive(Debug, Parser)]
#[command(name = "db2pg")]
#[command(about = "DB2 to PostgreSQL SQL migration tool", long_about = None)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Debug, Subcommand)]
pub enum Commands {
    #[command(about = "Convert DB2 SQL to PostgreSQL SQL")]
    Convert {
        #[arg(short, long)]
        input: PathBuf,

        #[arg(short, long)]
        output: Option<PathBuf>,

        #[arg(short, long)]
        report: Option<PathBuf>,

        #[arg(short, long)]
        json: bool,

        #[arg(long = "rollback")]
        rollback_output: Option<PathBuf>,
    },

    #[command(about = "Generate migration report without converting")]
    Report {
        #[arg(short, long)]
        input: PathBuf,

        #[arg(short, long)]
        output: Option<PathBuf>,

        #[arg(short, long)]
        json: bool,
    },

    #[command(about = "Compare two schemas and generate incremental migration")]
    Diff {
        #[arg(short = 'o', long = "old")]
        old: PathBuf,

        #[arg(short = 'n', long = "new")]
        new: PathBuf,

        #[arg(short, long)]
        output: Option<PathBuf>,

        #[arg(long = "rollback")]
        rollback_output: Option<PathBuf>,
    },

    #[command(about = "Generate data validation queries (row count, checksum)")]
    Validate {
        #[arg(short, long)]
        input: Option<PathBuf>,

        #[arg(short, long)]
        output: Option<PathBuf>,

        #[arg(short, long)]
        schema: Option<String>,

        #[arg(short, long, num_args = 1.., value_delimiter = ',')]
        tables: Option<Vec<String>>,
    },

    #[command(about = "Generate bulk data load scripts (pg_bulkload, COPY)")]
    Bulkload {
        #[arg(short, long)]
        output: Option<PathBuf>,

        #[arg(short, long)]
        table: String,

        #[arg(short = 'f', long)]
        input_file: String,

        #[arg(short = 'w', long, default_value_t = 4)]
        workers: u32,

        #[arg(short = 'm', long)]
        format: Option<String>,

        #[arg(short = 'p', long, num_args = 1.., value_delimiter = ',')]
        tables: Option<Vec<String>>,

        #[arg(long)]
        truncate: bool,

        #[arg(long)]
        disable_triggers: bool,

        #[arg(long)]
        disable_indexes: bool,
    },

    #[command(about = "Generate rollback script for a migration")]
    Rollback {
        #[arg(short, long)]
        input: PathBuf,

        #[arg(short, long)]
        output: Option<PathBuf>,
    },
}
