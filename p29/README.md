# Dependency Scanner

A CLI tool built with Rust for scanning dependencies across multiple languages, building dependency graphs, and detecting known vulnerabilities from a local CVE SQLite database.

## Features

- **Multi-language Support**:
  - Python: `requirements.txt`, `pyproject.toml`
  - JavaScript: `package-lock.json`
  - Java: `pom.xml`

- **Dependency Graph**: Builds complete recursive dependency graphs using petgraph

- **Vulnerability Detection**: Queries a local SQLite CVE database with semver version matching

- **Multiple Output Formats**:
  - Text (human-readable report)
  - JSON (structured data)
  - Graphviz DOT (visual dependency graph)

## Project Structure

```
.
├── Cargo.toml
├── src/
│   ├── main.rs           # CLI entry point
│   ├── lib.rs            # Library exports
│   ├── parsers/          # Language-specific parsers
│   │   ├── mod.rs
│   │   ├── python.rs
│   │   ├── javascript.rs
│   │   └── java.rs
│   ├── graph/            # Dependency graph builder
│   │   └── mod.rs
│   ├── vulnerability/    # CVE database and matching
│   │   └── mod.rs
│   └── output/           # Output generators
│       └── mod.rs
└── examples/             # Test dependency files
```

## Usage

### Build the project

```bash
cargo build --release
```

### Initialize CVE Database

```bash
# Initialize with sample data
cargo run -- --init-db

# Initialize custom database location
cargo run -- --init-db --db my-cve.db
```

### Scan Dependencies

```bash
# Basic scan (text output)
cargo run -- --file examples/requirements.txt

# JSON output
cargo run -- --file examples/requirements.txt --format json

# Graphviz output (for visualization)
cargo run -- --file examples/requirements.txt --format graphviz --output deps.dot
dot -Tpng deps.dot -o deps.png

# With custom CVE database
cargo run -- --file examples/requirements.txt --db my-cve.db

# Skip license check
cargo run -- --file examples/requirements.txt --no-license-check
```

### Command Line Options

```
USAGE:
    dep-scanner [OPTIONS]

OPTIONS:
    -f, --file <FILE>        Dependency file to scan
    -o, --output <FILE>      Output file path
        --db <DB_FILE>       Path to CVE database file
        --init-db            Initialize CVE database with sample data
        --no-license-check   Skip license compliance check
        --low-memory         Low memory mode for large projects (500+ dependencies)
    -h, --help               Print help information
    -V, --version            Print version information
```

## Features

### Memory Optimization

The scanner uses streaming processing by default to minimize memory usage:
- **Streaming node iteration**: Process one dependency at a time, discard immediately after processing
- **Result aggregation**: Only store vulnerable packages and GPL violations, not all package metadata
- **Cache optimization**: Minimal caching for license lookups

Memory footprint comparison (500 dependencies):
- Before: ~2GB (storing all dependency metadata)
- After: ~50-100MB (streaming processing)

Use `--low-memory` flag for projects with 1000+ dependencies for additional optimizations.

### License Compliance Check

The scanner automatically checks licenses for all dependencies and detects GPL-family licenses:
- Python packages: PyPI API
- JavaScript packages: npm registry API
- Java packages: Maven Central POM parsing

GPL-family licenses detected:
- GPL-1, GPL-2, GPL-3
- LGPL (Lesser General Public License)
- AGPL (Affero General Public License)

### Automated Fix Suggestions

The scanner automatically generates upgrade suggestions for vulnerable packages:

**Python (pip):**
```
pip install package==1.2.3
```

**JavaScript (npm):**
```
npm install package@1.2.3
```

**Java (Maven):**
```
Update pom.xml: <package.version>1.2.3</package.version>
```

Features:
- Queries available versions from official package registries
- Suggests the smallest version upgrade that fixes vulnerabilities
- Filters out pre-release/RC versions
- Lists the CVE IDs that will be fixed by the upgrade
- Caches version lookups for performance

## Color Legend for Graphviz

- 🟢 **Light Green**: No issues
- 🟣 **Purple**: GPL license violation
- 🔵 **Light Blue**: Low severity vulnerability
- 🟡 **Yellow**: Medium severity vulnerability
- 🟠 **Orange**: High severity vulnerability
- 🔴 **Red**: Critical severity vulnerability
