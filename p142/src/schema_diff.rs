use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableSchema {
    pub name: String,
    pub columns: Vec<ColumnSchema>,
    pub primary_key: Option<Vec<String>>,
    pub indexes: Vec<IndexSchema>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnSchema {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
    pub default: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexSchema {
    pub name: String,
    pub columns: Vec<String>,
    pub unique: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SchemaDiffType {
    TableAdded,
    TableRemoved,
    ColumnAdded,
    ColumnRemoved,
    ColumnTypeChanged,
    ColumnNullabilityChanged,
    PrimaryKeyChanged,
    IndexAdded,
    IndexRemoved,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchemaDiff {
    pub diff_type: SchemaDiffType,
    pub table_name: String,
    pub column_name: Option<String>,
    pub old_value: Option<String>,
    pub new_value: Option<String>,
    pub migration_sql: Option<String>,
}

pub struct SchemaDiffer;

impl SchemaDiffer {
    pub fn new() -> Self {
        Self
    }

    pub fn compare_schemas(&self, old_schema: &[TableSchema], new_schema: &[TableSchema]) -> Vec<SchemaDiff> {
        let mut diffs = Vec::new();

        let old_tables: HashMap<_, _> = old_schema.iter().map(|t| (t.name.clone(), t)).collect();
        let new_tables: HashMap<_, _> = new_schema.iter().map(|t| (t.name.clone(), t)).collect();

        let old_table_names: HashSet<_> = old_tables.keys().collect();
        let new_table_names: HashSet<_> = new_tables.keys().collect();

        for table_name in new_table_names.difference(&old_table_names) {
            diffs.push(SchemaDiff {
                diff_type: SchemaDiffType::TableAdded,
                table_name: table_name.to_string(),
                column_name: None,
                old_value: None,
                new_value: Some(format!("Table {} added", table_name)),
                migration_sql: self.generate_create_table_sql(new_tables.get(table_name).unwrap()),
            });
        }

        for table_name in old_table_names.difference(&new_table_names) {
            diffs.push(SchemaDiff {
                diff_type: SchemaDiffType::TableRemoved,
                table_name: table_name.to_string(),
                column_name: None,
                old_value: Some(format!("Table {} removed", table_name)),
                new_value: None,
                migration_sql: Some(format!("DROP TABLE IF EXISTS {};", table_name)),
            });
        }

        for table_name in old_table_names.intersection(&new_table_names) {
            let old_table = old_tables.get(table_name).unwrap();
            let new_table = new_tables.get(table_name).unwrap();

            diffs.extend(self.compare_columns(old_table, new_table));
            diffs.extend(self.compare_primary_keys(old_table, new_table));
            diffs.extend(self.compare_indexes(old_table, new_table));
        }

        diffs
    }

    fn compare_columns(&self, old_table: &TableSchema, new_table: &TableSchema) -> Vec<SchemaDiff> {
        let mut diffs = Vec::new();

        let old_cols: HashMap<_, _> = old_table.columns.iter().map(|c| (c.name.clone(), c)).collect();
        let new_cols: HashMap<_, _> = new_table.columns.iter().map(|c| (c.name.clone(), c)).collect();

        let old_col_names: HashSet<_> = old_cols.keys().collect();
        let new_col_names: HashSet<_> = new_cols.keys().collect();

        for col_name in new_col_names.difference(&old_col_names) {
            let col = new_cols.get(col_name).unwrap();
            diffs.push(SchemaDiff {
                diff_type: SchemaDiffType::ColumnAdded,
                table_name: old_table.name.clone(),
                column_name: Some(col_name.to_string()),
                old_value: None,
                new_value: Some(format!("Column {} {} NULL", col.data_type, if col.nullable { "" } else { "NOT" })),
                migration_sql: Some(format!(
                    "ALTER TABLE {} ADD COLUMN {} {} {};",
                    old_table.name,
                    col_name,
                    col.data_type,
                    if col.nullable { "" } else { "NOT NULL" }
                )),
            });
        }

        for col_name in old_col_names.difference(&new_col_names) {
            diffs.push(SchemaDiff {
                diff_type: SchemaDiffType::ColumnRemoved,
                table_name: old_table.name.clone(),
                column_name: Some(col_name.to_string()),
                old_value: Some(format!("Column {} removed", col_name)),
                new_value: None,
                migration_sql: Some(format!("ALTER TABLE {} DROP COLUMN IF EXISTS {};", old_table.name, col_name)),
            });
        }

        for col_name in old_col_names.intersection(&new_col_names) {
            let old_col = old_cols.get(col_name).unwrap();
            let new_col = new_cols.get(col_name).unwrap();

            if old_col.data_type != new_col.data_type {
                diffs.push(SchemaDiff {
                    diff_type: SchemaDiffType::ColumnTypeChanged,
                    table_name: old_table.name.clone(),
                    column_name: Some(col_name.to_string()),
                    old_value: Some(old_col.data_type.clone()),
                    new_value: Some(new_col.data_type.clone()),
                    migration_sql: Some(format!(
                        "ALTER TABLE {} ALTER COLUMN {} TYPE {};",
                        old_table.name, col_name, new_col.data_type
                    )),
                });
            }

            if old_col.nullable != new_col.nullable {
                diffs.push(SchemaDiff {
                    diff_type: SchemaDiffType::ColumnNullabilityChanged,
                    table_name: old_table.name.clone(),
                    column_name: Some(col_name.to_string()),
                    old_value: Some(format!("NULLABLE: {}", old_col.nullable)),
                    new_value: Some(format!("NULLABLE: {}", new_col.nullable)),
                    migration_sql: Some(format!(
                        "ALTER TABLE {} ALTER COLUMN {} {} NOT NULL;",
                        old_table.name,
                        col_name,
                        if new_col.nullable { "DROP" } else { "SET" }
                    )),
                });
            }
        }

        diffs
    }

    fn compare_primary_keys(&self, old_table: &TableSchema, new_table: &TableSchema) -> Vec<SchemaDiff> {
        let mut diffs = Vec::new();

        if old_table.primary_key != new_table.primary_key {
            let mut migration_sql = String::new();
            if let Some(ref old_pk) = old_table.primary_key {
                migration_sql.push_str(&format!(
                    "ALTER TABLE {} DROP CONSTRAINT IF EXISTS {}_pkey;\n",
                    old_table.name, old_table.name
                ));
            }
            if let Some(ref new_pk) = new_table.primary_key {
                migration_sql.push_str(&format!(
                    "ALTER TABLE {} ADD PRIMARY KEY ({});",
                    old_table.name, new_pk.join(", ")
                ));
            }

            diffs.push(SchemaDiff {
                diff_type: SchemaDiffType::PrimaryKeyChanged,
                table_name: old_table.name.clone(),
                column_name: None,
                old_value: old_table.primary_key.as_ref().map(|pk| pk.join(", ")),
                new_value: new_table.primary_key.as_ref().map(|pk| pk.join(", ")),
                migration_sql: if migration_sql.is_empty() { None } else { Some(migration_sql) },
            });
        }

        diffs
    }

    fn compare_indexes(&self, old_table: &TableSchema, new_table: &TableSchema) -> Vec<SchemaDiff> {
        let mut diffs = Vec::new();

        let old_idx: HashMap<_, _> = old_table.indexes.iter().map(|i| (i.name.clone(), i)).collect();
        let new_idx: HashMap<_, _> = new_table.indexes.iter().map(|i| (i.name.clone(), i)).collect();

        let old_idx_names: HashSet<_> = old_idx.keys().collect();
        let new_idx_names: HashSet<_> = new_idx.keys().collect();

        for idx_name in new_idx_names.difference(&old_idx_names) {
            let idx = new_idx.get(idx_name).unwrap();
            diffs.push(SchemaDiff {
                diff_type: SchemaDiffType::IndexAdded,
                table_name: old_table.name.clone(),
                column_name: None,
                old_value: None,
                new_value: Some(format!("Index {} on ({})", idx_name, idx.columns.join(", "))),
                migration_sql: Some(format!(
                    "CREATE {}INDEX {} ON {} ({});",
                    if idx.unique { "UNIQUE " } else { "" },
                    idx_name,
                    old_table.name,
                    idx.columns.join(", ")
                )),
            });
        }

        for idx_name in old_idx_names.difference(&new_idx_names) {
            diffs.push(SchemaDiff {
                diff_type: SchemaDiffType::IndexRemoved,
                table_name: old_table.name.clone(),
                column_name: None,
                old_value: Some(format!("Index {} removed", idx_name)),
                new_value: None,
                migration_sql: Some(format!("DROP INDEX IF EXISTS {};", idx_name)),
            });
        }

        diffs
    }

    fn generate_create_table_sql(&self, table: &TableSchema) -> Option<String> {
        let mut sql = format!("CREATE TABLE {} (\n", table.name);

        let col_defs: Vec<String> = table.columns.iter().map(|c| {
            format!(
                "    {} {} {}",
                c.name,
                c.data_type,
                if c.nullable { "" } else { "NOT NULL" }
            )
        }).collect();

        sql.push_str(&col_defs.join(",\n"));

        if let Some(ref pk) = table.primary_key {
            sql.push_str(&format!(",\n    PRIMARY KEY ({})", pk.join(", ")));
        }

        sql.push_str("\n);");

        Some(sql)
    }

    pub fn generate_migration_script(&self, diffs: &[SchemaDiff]) -> String {
        let mut script = String::new();

        script.push_str("-- Generated migration script\n");
        script.push_str("-- ==========================\n\n");

        for diff in diffs {
            if let Some(ref sql) = diff.migration_sql {
                script.push_str(&format!("\n-- {:?} on {}\n", diff.diff_type, diff.table_name));
                script.push_str(sql);
                script.push('\n');
            }
        }

        script
    }
}
