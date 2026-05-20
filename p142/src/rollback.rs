use crate::converter::SQLConverter;
use regex::Regex;
use std::collections::HashSet;

#[derive(Debug, Clone)]
pub enum MigrationType {
    CreateTable,
    DropTable,
    AlterTable,
    CreateIndex,
    DropIndex,
    CreateSequence,
    DropSequence,
    CreateProcedure,
    DropProcedure,
    CreateTrigger,
    DropTrigger,
    InsertData,
    UpdateData,
    DeleteData,
    Unknown,
}

#[derive(Debug, Clone)]
pub struct MigrationStep {
    pub original_sql: String,
    pub rollback_sql: String,
    pub migration_type: MigrationType,
    pub object_name: String,
    pub safe: bool,
}

pub struct RollbackGenerator {
    steps: Vec<MigrationStep>,
    created_objects: HashSet<String>,
    dropped_objects: HashSet<String>,
}

impl RollbackGenerator {
    pub fn new() -> Self {
        Self {
            steps: Vec::new(),
            created_objects: HashSet::new(),
            dropped_objects: HashSet::new(),
        }
    }

    pub fn analyze_migration(&mut self, migration_sql: &str) {
        let statements = self.split_statements(migration_sql);

        for stmt in statements {
            let step = self.analyze_statement(&stmt);
            self.steps.push(step);
        }
    }

    fn split_statements(&self, sql: &str) -> Vec<String> {
        let mut statements = Vec::new();
        let mut current = String::new();
        let mut in_string = false;

        for c in sql.chars() {
            match c {
                '\'' => {
                    in_string = !in_string;
                    current.push(c);
                }
                ';' if !in_string => {
                    let trimmed = current.trim();
                    if !trimmed.is_empty()
                        && !trimmed.starts_with("--")
                        && !trimmed.starts_with("/*")
                    {
                        statements.push(trimmed.to_string());
                    }
                    current.clear();
                }
                _ => {
                    current.push(c);
                }
            }
        }

        let trimmed = current.trim();
        if !trimmed.is_empty() && !trimmed.starts_with("--") && !trimmed.starts_with("/*") {
            statements.push(trimmed.to_string());
        }

        statements
    }

    fn analyze_statement(&self, stmt: &str) -> MigrationStep {
        let upper = stmt.to_uppercase();

        if upper.starts_with("CREATE TABLE") {
            self.analyze_create_table(stmt)
        } else if upper.starts_with("DROP TABLE") {
            self.analyze_drop_table(stmt)
        } else if upper.starts_with("ALTER TABLE") {
            self.analyze_alter_table(stmt)
        } else if upper.starts_with("CREATE INDEX") {
            self.analyze_create_index(stmt)
        } else if upper.starts_with("DROP INDEX") {
            self.analyze_drop_index(stmt)
        } else if upper.starts_with("CREATE SEQUENCE") {
            self.analyze_create_sequence(stmt)
        } else if upper.starts_with("DROP SEQUENCE") {
            self.analyze_drop_sequence(stmt)
        } else if upper.starts_with("CREATE OR REPLACE PROCEDURE")
            || upper.starts_with("CREATE PROCEDURE")
        {
            self.analyze_create_procedure(stmt)
        } else if upper.starts_with("DROP PROCEDURE") {
            self.analyze_drop_procedure(stmt)
        } else if upper.starts_with("CREATE OR REPLACE TRIGGER")
            || upper.starts_with("CREATE TRIGGER")
        {
            self.analyze_create_trigger(stmt)
        } else if upper.starts_with("DROP TRIGGER") {
            self.analyze_drop_trigger(stmt)
        } else if upper.starts_with("INSERT INTO") {
            self.analyze_insert(stmt)
        } else if upper.starts_with("UPDATE") {
            self.analyze_update(stmt)
        } else if upper.starts_with("DELETE FROM") {
            self.analyze_delete(stmt)
        } else {
            MigrationStep {
                original_sql: stmt.to_string(),
                rollback_sql: format!("-- WARNING: Cannot auto-generate rollback for:\n-- {}\n-- Manual rollback required", stmt),
                migration_type: MigrationType::Unknown,
                object_name: "unknown".to_string(),
                safe: false,
            }
        }
    }

    fn analyze_create_table(&self, stmt: &str) -> MigrationStep {
        let re = Regex::new(r"(?i)CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)").unwrap();
        let table_name = re
            .captures(stmt)
            .and_then(|c| c.get(1))
            .map_or("unknown", |m| m.as_str());

        MigrationStep {
            original_sql: stmt.to_string(),
            rollback_sql: format!("DROP TABLE IF EXISTS {} CASCADE;", table_name),
            migration_type: MigrationType::CreateTable,
            object_name: table_name.to_string(),
            safe: true,
        }
    }

    fn analyze_drop_table(&self, stmt: &str) -> MigrationStep {
        let re = Regex::new(r"(?i)DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)").unwrap();
        let table_name = re
            .captures(stmt)
            .and_then(|c| c.get(1))
            .map_or("unknown", |m| m.as_str());

        MigrationStep {
            original_sql: stmt.to_string(),
            rollback_sql: format!(
                "-- WARNING: Cannot restore dropped table {}. Restore from backup.",
                table_name
            ),
            migration_type: MigrationType::DropTable,
            object_name: table_name.to_string(),
            safe: false,
        }
    }

    fn analyze_alter_table(&self, stmt: &str) -> MigrationStep {
        let re = Regex::new(r"(?i)ALTER\s+TABLE\s+(\w+)").unwrap();
        let table_name = re
            .captures(stmt)
            .and_then(|c| c.get(1))
            .map_or("unknown", |m| m.as_str());

        let upper = stmt.to_uppercase();
        let rollback_sql = if upper.contains("ADD COLUMN") {
            if let Some(caps) = Regex::new(r"(?i)ADD\s+(?:COLUMN\s+)?(\w+)").unwrap().captures(stmt)
            {
                format!(
                    "ALTER TABLE {} DROP COLUMN IF EXISTS {} CASCADE;",
                    table_name,
                    caps[1].to_string()
                )
            } else {
                format!(
                    "-- WARNING: Could not extract column name from ALTER TABLE ADD:\n-- {}",
                    stmt
                )
            }
        } else if upper.contains("DROP COLUMN") {
            if let Some(caps) =
                Regex::new(r"(?i)DROP\s+(?:COLUMN\s+)?(\w+)").unwrap().captures(stmt)
            {
                format!(
                    "-- WARNING: Cannot restore dropped column {} on {}. Restore from backup.",
                    caps[1].to_string(),
                    table_name
                )
            } else {
                format!("-- WARNING: Could not extract column name from ALTER TABLE DROP:\n-- {}", stmt)
            }
        } else if upper.contains("ALTER COLUMN") && upper.contains("TYPE") {
            if let Some(caps) =
                Regex::new(r"(?i)ALTER\s+(?:COLUMN\s+)?(\w+)\s+TYPE\s+(\w+)")
                    .unwrap()
                    .captures(stmt)
            {
                format!(
                    "-- WARNING: Cannot safely rollback column type change: {} {} TYPE {}\n-- Consider original data type",
                    table_name,
                    caps[1].to_string(),
                    caps[2].to_string()
                )
            } else {
                format!("-- WARNING: Could not parse ALTER TABLE ALTER COLUMN TYPE:\n-- {}", stmt)
            }
        } else if upper.contains("RENAME COLUMN") {
            if let Some(caps) = Regex::new(r"(?i)RENAME\s+(?:COLUMN\s+)?(\w+)\s+TO\s+(\w+)")
                .unwrap()
                .captures(stmt)
            {
                format!(
                    "ALTER TABLE {} RENAME COLUMN {} TO {};",
                    table_name,
                    caps[2].to_string(),
                    caps[1].to_string()
                )
            } else {
                format!("-- WARNING: Could not parse ALTER TABLE RENAME COLUMN:\n-- {}", stmt)
            }
        } else {
            format!("-- WARNING: Cannot auto-generate rollback for ALTER TABLE:\n-- {}\n-- Manual review required", stmt)
        };

        MigrationStep {
            original_sql: stmt.to_string(),
            rollback_sql,
            migration_type: MigrationType::AlterTable,
            object_name: table_name.to_string(),
            safe: false,
        }
    }

    fn analyze_create_index(&self, stmt: &str) -> MigrationStep {
        let re = Regex::new(r"(?i)CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)").unwrap();
        let index_name = re
            .captures(stmt)
            .and_then(|c| c.get(1))
            .map_or("unknown", |m| m.as_str());

        MigrationStep {
            original_sql: stmt.to_string(),
            rollback_sql: format!("DROP INDEX IF EXISTS {};", index_name),
            migration_type: MigrationType::CreateIndex,
            object_name: index_name.to_string(),
            safe: true,
        }
    }

    fn analyze_drop_index(&self, stmt: &str) -> MigrationStep {
        let re = Regex::new(r"(?i)DROP\s+INDEX\s+(?:IF\s+EXISTS\s+)?(\w+)").unwrap();
        let index_name = re
            .captures(stmt)
            .and_then(|c| c.get(1))
            .map_or("unknown", |m| m.as_str());

        MigrationStep {
            original_sql: stmt.to_string(),
            rollback_sql: format!(
                "-- WARNING: Cannot restore dropped index {}. Recreate from original DDL.",
                index_name
            ),
            migration_type: MigrationType::DropIndex,
            object_name: index_name.to_string(),
            safe: false,
        }
    }

    fn analyze_create_sequence(&self, stmt: &str) -> MigrationStep {
        let re =
            Regex::new(r"(?i)CREATE\s+SEQUENCE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)").unwrap();
        let seq_name = re
            .captures(stmt)
            .and_then(|c| c.get(1))
            .map_or("unknown", |m| m.as_str());

        MigrationStep {
            original_sql: stmt.to_string(),
            rollback_sql: format!("DROP SEQUENCE IF EXISTS {} CASCADE;", seq_name),
            migration_type: MigrationType::CreateSequence,
            object_name: seq_name.to_string(),
            safe: true,
        }
    }

    fn analyze_drop_sequence(&self, stmt: &str) -> MigrationStep {
        let re = Regex::new(r"(?i)DROP\s+SEQUENCE\s+(?:IF\s+EXISTS\s+)?(\w+)").unwrap();
        let seq_name = re
            .captures(stmt)
            .and_then(|c| c.get(1))
            .map_or("unknown", |m| m.as_str());

        MigrationStep {
            original_sql: stmt.to_string(),
            rollback_sql: format!(
                "-- WARNING: Cannot restore dropped sequence {}. Recreate from original DDL.",
                seq_name
            ),
            migration_type: MigrationType::DropSequence,
            object_name: seq_name.to_string(),
            safe: false,
        }
    }

    fn analyze_create_procedure(&self, stmt: &str) -> MigrationStep {
        let re = Regex::new(r"(?i)CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+(\w+)").unwrap();
        let proc_name = re
            .captures(stmt)
            .and_then(|c| c.get(1))
            .map_or("unknown", |m| m.as_str());

        MigrationStep {
            original_sql: stmt.to_string(),
            rollback_sql: format!("DROP PROCEDURE IF EXISTS {} CASCADE;", proc_name),
            migration_type: MigrationType::CreateProcedure,
            object_name: proc_name.to_string(),
            safe: true,
        }
    }

    fn analyze_drop_procedure(&self, stmt: &str) -> MigrationStep {
        let re = Regex::new(r"(?i)DROP\s+PROCEDURE\s+(?:IF\s+EXISTS\s+)?(\w+)").unwrap();
        let proc_name = re
            .captures(stmt)
            .and_then(|c| c.get(1))
            .map_or("unknown", |m| m.as_str());

        MigrationStep {
            original_sql: stmt.to_string(),
            rollback_sql: format!(
                "-- WARNING: Cannot restore dropped procedure {}. Recreate from original DDL.",
                proc_name
            ),
            migration_type: MigrationType::DropProcedure,
            object_name: proc_name.to_string(),
            safe: false,
        }
    }

    fn analyze_create_trigger(&self, stmt: &str) -> MigrationStep {
        let re = Regex::new(r"(?i)CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+(\w+)").unwrap();
        let trigger_name = re
            .captures(stmt)
            .and_then(|c| c.get(1))
            .map_or("unknown", |m| m.as_str());

        let table_re = Regex::new(r"(?i)ON\s+(\w+)").unwrap();
        let table_name = table_re
            .captures(stmt)
            .and_then(|c| c.get(1))
            .map_or("the_table_name", |m| m.as_str());

        MigrationStep {
            original_sql: stmt.to_string(),
            rollback_sql: format!("DROP TRIGGER IF EXISTS {} ON {} CASCADE;", trigger_name, table_name),
            migration_type: MigrationType::CreateTrigger,
            object_name: trigger_name.to_string(),
            safe: true,
        }
    }

    fn analyze_drop_trigger(&self, stmt: &str) -> MigrationStep {
        let re = Regex::new(r"(?i)DROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?(\w+)").unwrap();
        let trigger_name = re
            .captures(stmt)
            .and_then(|c| c.get(1))
            .map_or("unknown", |m| m.as_str());

        MigrationStep {
            original_sql: stmt.to_string(),
            rollback_sql: format!(
                "-- WARNING: Cannot restore dropped trigger {}. Recreate from original DDL.",
                trigger_name
            ),
            migration_type: MigrationType::DropTrigger,
            object_name: trigger_name.to_string(),
            safe: false,
        }
    }

    fn analyze_insert(&self, stmt: &str) -> MigrationStep {
        let re = Regex::new(r"(?i)INSERT\s+INTO\s+(\w+)").unwrap();
        let table_name = re
            .captures(stmt)
            .and_then(|c| c.get(1))
            .map_or("unknown", |m| m.as_str());

        MigrationStep {
            original_sql: stmt.to_string(),
            rollback_sql: format!(
                "-- WARNING: Cannot auto-rollback INSERT into {}. Use DELETE with appropriate WHERE clause.",
                table_name
            ),
            migration_type: MigrationType::InsertData,
            object_name: table_name.to_string(),
            safe: false,
        }
    }

    fn analyze_update(&self, stmt: &str) -> MigrationStep {
        let re = Regex::new(r"(?i)UPDATE\s+(\w+)").unwrap();
        let table_name = re
            .captures(stmt)
            .and_then(|c| c.get(1))
            .map_or("unknown", |m| m.as_str());

        MigrationStep {
            original_sql: stmt.to_string(),
            rollback_sql: format!(
                "-- WARNING: Cannot auto-rollback UPDATE on {}. Restore from backup.",
                table_name
            ),
            migration_type: MigrationType::UpdateData,
            object_name: table_name.to_string(),
            safe: false,
        }
    }

    fn analyze_delete(&self, stmt: &str) -> MigrationStep {
        let re = Regex::new(r"(?i)DELETE\s+FROM\s+(\w+)").unwrap();
        let table_name = re
            .captures(stmt)
            .and_then(|c| c.get(1))
            .map_or("unknown", |m| m.as_str());

        MigrationStep {
            original_sql: stmt.to_string(),
            rollback_sql: format!(
                "-- WARNING: Cannot auto-rollback DELETE from {}. Restore from backup.",
                table_name
            ),
            migration_type: MigrationType::DeleteData,
            object_name: table_name.to_string(),
            safe: false,
        }
    }

    pub fn generate_rollback_script(&self) -> String {
        let mut script = String::new();

        script.push_str("-- ========================================\n");
        script.push_str("-- AUTO-GENERATED ROLLBACK SCRIPT\n");
        script.push_str("-- Generated by: db2pg migration tool\n");
        script.push_str("-- WARNING: Review carefully before execution!\n");
        script.push_str("-- ========================================\n\n");

        script.push_str("-- Transaction safety\n");
        script.push_str("BEGIN;\n\n");

        script.push_str("-- ========================================\n");
        script.push_str("-- ROLLBACK STEPS (in reverse order)\n");
        script.push_str("-- ========================================\n\n");

        let mut safe_count = 0;
        let mut unsafe_count = 0;

        for step in self.steps.iter().rev() {
            if step.safe {
                safe_count += 1;
            } else {
                unsafe_count += 1;
            }

            script.push_str(&format!("-- Object: {} ({:?})\n", step.object_name, step.migration_type));
            if step.safe {
                script.push_str(&format!("-- Status: ✓ SAFE (auto-generated)\n"));
            } else {
                script.push_str(&format!("-- Status: ⚠ UNSAFE (requires manual review)\n"));
            }
            script.push_str(&step.rollback_sql);
            script.push_str("\n\n");
        }

        script.push_str("-- ========================================\n");
        script.push_str("-- SUMMARY\n");
        script.push_str("-- ========================================\n");
        script.push_str(&format!("-- Total rollback steps: {}\n", self.steps.len()));
        script.push_str(&format!("-- Safe auto-generated: {}\n", safe_count));
        script.push_str(&format!("-- Requires manual review: {}\n", unsafe_count));
        script.push_str("\n-- END OF ROLLBACK SCRIPT\n");
        script.push_str("COMMIT;\n");

        script
    }

    pub fn steps(&self) -> &[MigrationStep] {
        &self.steps
    }
}

pub fn generate_restore_point(name: &str) -> String {
    format!(
        "-- Create restore point: {}\nSELECT pg_create_restore_point('{}');\n",
        name, name
    )
}
