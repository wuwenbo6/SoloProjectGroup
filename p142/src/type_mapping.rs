use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct TypeMapping {
    db2_type: String,
    pg_type: String,
    needs_cast: bool,
    note: Option<String>,
}

impl TypeMapping {
    pub fn new(db2_type: &str, pg_type: &str) -> Self {
        Self {
            db2_type: db2_type.to_string(),
            pg_type: pg_type.to_string(),
            needs_cast: false,
            note: None,
        }
    }

    pub fn with_cast(mut self) -> Self {
        self.needs_cast = true;
        self
    }

    pub fn with_note(mut self, note: &str) -> Self {
        self.note = Some(note.to_string());
        self
    }

    pub fn pg_type(&self) -> &str {
        &self.pg_type
    }

    pub fn needs_cast(&self) -> bool {
        self.needs_cast
    }

    pub fn note(&self) -> Option<&String> {
        self.note.as_ref()
    }
}

pub fn build_type_mappings() -> HashMap<String, TypeMapping> {
    let mut mappings = HashMap::new();

    mappings.insert(
        "DATE".to_string(),
        TypeMapping::new("DATE", "TIMESTAMP")
            .with_note("DB2 DATE includes time, PostgreSQL DATE does not")
    );

    mappings.insert(
        "TIME".to_string(),
        TypeMapping::new("TIME", "TIME")
    );

    mappings.insert(
        "TIMESTAMP".to_string(),
        TypeMapping::new("TIMESTAMP", "TIMESTAMP")
    );

    mappings.insert(
        "VARCHAR".to_string(),
        TypeMapping::new("VARCHAR", "VARCHAR")
    );

    mappings.insert(
        "CHAR".to_string(),
        TypeMapping::new("CHAR", "CHAR")
    );

    mappings.insert(
        "CHARACTER".to_string(),
        TypeMapping::new("CHARACTER", "CHAR")
    );

    mappings.insert(
        "CLOB".to_string(),
        TypeMapping::new("CLOB", "TEXT")
    );

    mappings.insert(
        "BLOB".to_string(),
        TypeMapping::new("BLOB", "BYTEA")
    );

    mappings.insert(
        "INTEGER".to_string(),
        TypeMapping::new("INTEGER", "INTEGER")
    );

    mappings.insert(
        "INT".to_string(),
        TypeMapping::new("INT", "INTEGER")
    );

    mappings.insert(
        "SMALLINT".to_string(),
        TypeMapping::new("SMALLINT", "SMALLINT")
    );

    mappings.insert(
        "BIGINT".to_string(),
        TypeMapping::new("BIGINT", "BIGINT")
    );

    mappings.insert(
        "DECIMAL".to_string(),
        TypeMapping::new("DECIMAL", "NUMERIC")
    );

    mappings.insert(
        "DEC".to_string(),
        TypeMapping::new("DEC", "NUMERIC")
    );

    mappings.insert(
        "NUMERIC".to_string(),
        TypeMapping::new("NUMERIC", "NUMERIC")
    );

    mappings.insert(
        "REAL".to_string(),
        TypeMapping::new("REAL", "REAL")
    );

    mappings.insert(
        "DOUBLE".to_string(),
        TypeMapping::new("DOUBLE", "DOUBLE PRECISION")
    );

    mappings.insert(
        "FLOAT".to_string(),
        TypeMapping::new("FLOAT", "DOUBLE PRECISION")
    );

    mappings.insert(
        "BOOLEAN".to_string(),
        TypeMapping::new("BOOLEAN", "BOOLEAN")
    );

    mappings.insert(
        "XML".to_string(),
        TypeMapping::new("XML", "XML")
    );

    mappings.insert(
        "GRAPHIC".to_string(),
        TypeMapping::new("GRAPHIC", "VARCHAR")
            .with_note("DB2 GRAPHIC converted to VARCHAR with appropriate encoding")
    );

    mappings.insert(
        "VARGRAPHIC".to_string(),
        TypeMapping::new("VARGRAPHIC", "VARCHAR")
            .with_note("DB2 VARGRAPHIC converted to VARCHAR")
    );

    mappings.insert(
        "DBCLOB".to_string(),
        TypeMapping::new("DBCLOB", "TEXT")
            .with_note("DB2 DBCLOB converted to TEXT")
    );

    mappings.insert(
        "ROWID".to_string(),
        TypeMapping::new("ROWID", "TID")
            .with_note("DB2 ROWID mapped to PostgreSQL TID, may need review")
    );

    mappings
}

pub fn map_type(db2_type: &str, mappings: &HashMap<String, TypeMapping>) -> TypeMapping {
    let upper_type = db2_type.to_uppercase();
    
    if let Some(mapping) = mappings.get(&upper_type) {
        return mapping.clone();
    }

    for (key, mapping) in mappings {
        if upper_type.starts_with(key) {
            let mut result = mapping.clone();
            result.db2_type = db2_type.to_string();
            return result;
        }
    }

    TypeMapping::new(db2_type, db2_type)
        .with_note("Unmapped type, manual review required")
}

pub fn extract_type_with_params(db2_type: &str) -> (String, Option<String>) {
    let re = regex::Regex::new(r"^([A-Za-z]+)\s*\(([^)]+)\)").unwrap();
    if let Some(caps) = re.captures(db2_type) {
        let base_type = caps[1].to_string().to_uppercase();
        let params = caps[2].to_string();
        (base_type, Some(params))
    } else {
        (db2_type.to_string().to_uppercase(), None)
    }
}
