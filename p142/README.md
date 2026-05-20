# DB2 to PostgreSQL SQL Migration Tool

A Rust CLI tool for migrating DB2 SQL scripts to PostgreSQL-compatible syntax.

## Features

- **DDL Conversion**
  - Table creation with data type mapping
  - IDENTITY columns converted to SERIAL
  - Index conversion
  - Sequence conversion
  - Trigger conversion with REFERENCING OLD/NEW AS handling

- **DML Conversion**
  - SELECT/INSERT/UPDATE/DELETE statements
  - NVL → COALESCE
  - FETCH FIRST → LIMIT
  - CURRENT DATE → CURRENT_DATE
  - Isolation level handling

- **Stored Procedure Conversion**
  - Cursor declarations (WITH RETURN / WITHOUT RETURN)
  - WITH RETURN cursor: generates comments for RETURN QUERY pattern
  - Condition handlers (EXCEPTION blocks)
  - Variable declarations
  - Control flow conversion

- **Trigger Conversion**
  - REFERENCING OLD AS alias / NEW AS alias → PostgreSQL OLD/NEW direct access
  - Automatic alias replacement in trigger body
  - SIGNAL SQLSTATE → RAISE EXCEPTION
  - Triggers split into PostgreSQL trigger + function pattern

- **Migration Report**
  - Detailed incompatibility reporting
  - Text and JSON output formats
  - Type mapping summary

- **Incremental Migration**
  - Schema comparison (JSON format)
  - Generate ALTER TABLE scripts
  - Add/remove columns, indexes, tables

- **Data Validation**
  - Row count comparison queries
  - Checksum generation for data integrity
  - Support for both DB2 and PostgreSQL syntax
  - Table list extraction from DDL

- **Bulk Data Load**
  - pg_bulkload configuration generation
  - Parallel loading support
  - COPY command alternative
  - Pre-load and post-load operations (truncate, disable triggers)
  - Parallel execution plan with shell script

- **Rollback Generation**
  - Automatic rollback script generation
  - Reverse order execution
  - Safe operations: DROP TABLE, DROP INDEX, DROP SEQUENCE, DROP PROCEDURE, DROP TRIGGER
  - Warning for unsafe operations: ALTER TABLE, UPDATE, DELETE, DROP objects
  - Transaction safety wrapper

## Installation

```bash
cargo build --release
```

## Usage

### Convert SQL Script

```bash
# Convert and print to stdout
db2pg convert -i examples/sample_db2.sql

# Convert and save to file
db2pg convert -i examples/sample_db2.sql -o output.sql

# Convert with report
db2pg convert -i examples/sample_db2.sql -r report.txt

# Convert with JSON report
db2pg convert -i examples/sample_db2.sql -r report.json --json

# Convert and generate rollback script
db2pg convert -i examples/sample_db2.sql -o output.sql --rollback rollback.sql
```

### Generate Migration Report

```bash
# Text report
db2pg report -i examples/sample_db2.sql

# JSON report
db2pg report -i examples/sample_db2.sql -o report.json --json
```

### Schema Diff (Incremental Migration)

```bash
# Compare two schemas
db2pg diff -o examples/old_schema.json -n examples/new_schema.json

# Save migration script
db2pg diff -o examples/old_schema.json -n examples/new_schema.json -m migration.sql

# Generate migration and rollback scripts
db2pg diff -o examples/old_schema.json -n examples/new_schema.json -m migration.sql --rollback rollback.sql
```

### Data Validation

```bash
# Generate validation queries from a DDL file
db2pg validate -i examples/sample_db2.sql

# Generate validation for specific tables
db2pg validate -t employees,departments,salaries

# With specific schema
db2pg validate -t employees -s public -o validation.sql

# Save to output file
db2pg validate -i examples/sample_db2.sql -o validation_queries.sql
```

### Bulk Data Load

```bash
# Generate pg_bulkload script for a single table
db2pg bulkload -t employees -f employees_export.csv

# With parallel workers
db2pg bulkload -t employees -f employees_export.csv -w 8

# With truncate option
db2pg bulkload -t employees -f employees_export.csv --truncate --disable-triggers

# Generate parallel load plan for multiple tables
db2pg bulkload -t employees -f employees_export.csv -p employees,departments,salaries -w 8

# Save to output file
db2pg bulkload -t employees -f employees_export.csv -o bulk_load.sql
```

### Rollback Script Generation

```bash
# Generate rollback for a migration script
db2pg rollback -i migration.sql -o rollback_script.sql

# Print rollback to stdout
db2pg rollback -i migration.sql
```

## Data Type Mappings

| DB2 Type | PostgreSQL Type | Notes |
|----------|-----------------|-------|
| DATE | TIMESTAMP | DB2 DATE includes time |
| TIME | TIME | |
| TIMESTAMP | TIMESTAMP | |
| VARCHAR | VARCHAR | |
| CHAR | CHAR | |
| CLOB | TEXT | |
| BLOB | BYTEA | |
| INTEGER | INTEGER | |
| INT | INTEGER | |
| SMALLINT | SMALLINT | |
| BIGINT | BIGINT | |
| DECIMAL | NUMERIC | |
| DEC | NUMERIC | |
| NUMERIC | NUMERIC | |
| REAL | REAL | |
| DOUBLE | DOUBLE PRECISION | |
| FLOAT | DOUBLE PRECISION | |
| BOOLEAN | BOOLEAN | |
| XML | XML | |
| GRAPHIC | VARCHAR | |
| VARGRAPHIC | VARCHAR | |
| ROWID | TID | May need review |

## Project Structure

```
src/
├── cli.rs           # CLI argument parsing
├── converter.rs     # Main SQL converter
├── ddl.rs           # DDL statement conversion
├── dml.rs           # DML statement conversion
├── lib.rs           # Library exports
├── main.rs          # Entry point
├── report.rs        # Migration report generation
├── schema_diff.rs   # Schema comparison
├── stored_proc.rs   # Stored procedure conversion
└── type_mapping.rs  # Data type mappings
```

## Examples

See `examples/` directory for sample DB2 SQL files and schema JSON files.
