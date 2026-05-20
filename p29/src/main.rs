use clap::Parser;
use dep_scanner::graph::DependencyGraph;
use dep_scanner::output::OutputGenerator;
use dep_scanner::parsers::get_parser_for_file;
use dep_scanner::vulnerability::{VulnerabilityDatabase, VulnerabilityScanResult};
use dep_scanner::license::{LicenseChecker, LicenseScanResult};
use dep_scanner::fix_suggestion::FixSuggester;
use std::path::PathBuf;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Cli {
    #[arg(short, long, value_name = "FILE")]
    file: PathBuf,

    #[arg(short, long, value_enum, default_value_t = OutputFormat::Text)]
    format: OutputFormat,

    #[arg(short, long, value_name = "FILE")]
    output: Option<PathBuf>,

    #[arg(long, value_name = "DB_FILE")]
    db: Option<PathBuf>,

    #[arg(long)]
    init_db: bool,

    #[arg(long)]
    no_license_check: bool,

    #[arg(long, help = "Low memory mode: process and discard nodes immediately, reduces output details")]
    low_memory: bool,
}

#[derive(clap::ValueEnum, Clone, Debug)]
enum OutputFormat {
    Text,
    Json,
    Graphviz,
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    if cli.init_db {
        let db_path = cli.db.unwrap_or_else(|| PathBuf::from("cve.db"));
        let db = VulnerabilityDatabase::new(&db_path)?;
        db.add_sample_data()?;
        println!("Database initialized at: {}", db_path.display());
        return Ok(());
    }

    if !cli.file.exists() {
        anyhow::bail!("File not found: {}", cli.file.display());
    }

    let parser = get_parser_for_file(&cli.file)
        .ok_or_else(|| anyhow::anyhow!("Unsupported file type. Supported: requirements.txt, pyproject.toml, package-lock.json, pom.xml"))?;

    println!("Parsing {}...", cli.file.display());
    let dependencies = parser.parse(&cli.file)?;
    println!("Found {} top-level dependencies", dependencies.len());

    let mut graph = DependencyGraph::new();
    graph.build(&dependencies);
    println!(
        "Built dependency graph with {} nodes and {} edges",
        graph.node_count(),
        graph.edge_count()
    );

    let db_path = cli.db.unwrap_or_else(|| PathBuf::from("cve.db"));
    let db = if db_path.exists() {
        VulnerabilityDatabase::new(&db_path)?
    } else {
        println!("No CVE database found, using in-memory database with sample data");
        let db = VulnerabilityDatabase::new_in_memory()?;
        db.add_sample_data()?;
        db
    };

    println!("Scanning for vulnerabilities (streaming mode)...");
    let vuln_result = db.scan_streaming(&graph, |node, vulns| {
        println!("Found {} vulnerabilities for {} ({})", vulns.len(), node.name, node.version);
    })?;

    let license_result = if !cli.no_license_check {
        println!("Checking licenses (streaming mode)...");
        let mut license_checker = LicenseChecker::new()?;
        let result = license_checker.scan_streaming(&graph, |node, info| {
            println!("GPL violation detected: {} {} - {}", node.name, node.version, info.license);
        })?;
        result
    } else {
        LicenseScanResult::new()
    };

    println!("Generating fix suggestions...");
    let mut fix_suggester = FixSuggester::new();
    let mut fix_suggestions = Vec::new();
    
    for (key, vulns) in &vuln_result.vulnerable_packages {
        let parts: Vec<&str> = key.split(':').collect();
        if parts.len() >= 3 {
            let node_data = dep_scanner::graph::NodeData {
                name: parts[0].to_string(),
                version: parts[1].to_string(),
                language: parts[2].to_string(),
            };
            
            match fix_suggester.generate_fix_suggestion(&node_data, vulns) {
                Ok(suggestion) => {
                    println!(
                        "Suggestion: upgrade {} {} -> {}",
                        suggestion.package_name,
                        suggestion.current_version,
                        suggestion.suggested_version
                    );
                    fix_suggestions.push(suggestion);
                }
                Err(e) => {
                    eprintln!("Failed to generate fix suggestion for {}: {}", parts[0], e);
                }
            }
        }
    }

    let output = match cli.format {
        OutputFormat::Text => OutputGenerator::to_text(&graph, &vuln_result.vulnerable_packages, &license_result.licenses, &fix_suggestions),
        OutputFormat::Json => OutputGenerator::to_json(&graph, &vuln_result.vulnerable_packages, &license_result.licenses, &fix_suggestions),
        OutputFormat::Graphviz => OutputGenerator::to_graphviz(&graph, &vuln_result.vulnerable_packages, &license_result.licenses),
    };

    if let Some(output_path) = cli.output {
        std::fs::write(&output_path, output)?;
        println!("Output written to: {}", output_path.display());
    } else {
        println!("\n{}", output);
    }

    Ok(())
}
