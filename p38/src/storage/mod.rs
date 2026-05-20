use crate::preprocessing::PreprocessConfig;
use crate::recognition::{AccuracyLevel, OcrConfig};
use crate::transcription::OutputFormat;
use crate::Result;
use chrono::{DateTime, Local};
use rusqlite::{params, Connection, OptionalExtension};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, serde::Serialize)]
pub struct RecognitionRecord {
    pub id: i64,
    pub file_path: String,
    pub result_text: String,
    pub character_count: usize,
    pub processing_time_ms: u64,
    pub created_at: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AppConfig {
    pub preprocess: PreprocessConfig,
    pub ocr: OcrConfig,
    pub default_output_format: OutputFormat,
    pub output_directory: Option<String>,
    pub git_backup_enabled: bool,
    pub git_repository_path: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            preprocess: PreprocessConfig::default(),
            ocr: OcrConfig::default(),
            default_output_format: OutputFormat::Txt,
            output_directory: None,
            git_backup_enabled: false,
            git_repository_path: None,
        }
    }
}

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new(path: &Path) -> Result<Self> {
        let conn = Connection::open(path)?;
        let mut db = Self { conn };
        db.init_tables()?;
        Ok(db)
    }

    pub fn in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        let mut db = Self { conn };
        db.init_tables()?;
        Ok(db)
    }

    fn init_tables(&mut self) -> Result<()> {
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS recognition_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT NOT NULL,
                result_text TEXT NOT NULL,
                character_count INTEGER NOT NULL,
                processing_time_ms INTEGER NOT NULL,
                created_at TEXT NOT NULL
            )",
            [],
        )?;

        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )",
            [],
        )?;

        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS character_dictionary (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                character TEXT NOT NULL UNIQUE,
                is_variant BOOLEAN NOT NULL DEFAULT 0,
                standard_form TEXT,
                frequency INTEGER NOT NULL DEFAULT 0
            )",
            [],
        )?;

        Ok(())
    }

    pub fn insert_record(
        &mut self,
        file_path: &str,
        result_text: &str,
        character_count: usize,
        processing_time_ms: u64,
    ) -> Result<i64> {
        let now: DateTime<Local> = Local::now();
        let created_at = now.format("%Y-%m-%d %H:%M:%S").to_string();

        self.conn.execute(
            "INSERT INTO recognition_records 
             (file_path, result_text, character_count, processing_time_ms, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                file_path,
                result_text,
                character_count as i64,
                processing_time_ms as i64,
                created_at
            ],
        )?;

        Ok(self.conn.last_insert_rowid())
    }

    pub fn get_all_records(&self) -> Result<Vec<RecognitionRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, file_path, result_text, character_count, processing_time_ms, created_at
             FROM recognition_records
             ORDER BY created_at DESC",
        )?;

        let records = stmt.query_map([], |row| {
            Ok(RecognitionRecord {
                id: row.get(0)?,
                file_path: row.get(1)?,
                result_text: row.get(2)?,
                character_count: row.get::<_, i64>(3)? as usize,
                processing_time_ms: row.get::<_, i64>(4)? as u64,
                created_at: row.get(5)?,
            })
        })?;

        let mut result = Vec::new();
        for record in records {
            result.push(record?);
        }

        Ok(result)
    }

    pub fn get_record(&self, id: i64) -> Result<Option<RecognitionRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, file_path, result_text, character_count, processing_time_ms, created_at
             FROM recognition_records
             WHERE id = ?1",
        )?;

        let record = stmt.query_row(params![id], |row| {
            Ok(RecognitionRecord {
                id: row.get(0)?,
                file_path: row.get(1)?,
                result_text: row.get(2)?,
                character_count: row.get::<_, i64>(3)? as usize,
                processing_time_ms: row.get::<_, i64>(4)? as u64,
                created_at: row.get(5)?,
            })
        }).optional()?;

        Ok(record)
    }

    pub fn search_records(&self, query: &str) -> Result<Vec<RecognitionRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, file_path, result_text, character_count, processing_time_ms, created_at
             FROM recognition_records
             WHERE file_path LIKE ?1 OR result_text LIKE ?1
             ORDER BY created_at DESC",
        )?;

        let search_pattern = format!("%{}%", query);
        let records = stmt.query_map(params![search_pattern], |row| {
            Ok(RecognitionRecord {
                id: row.get(0)?,
                file_path: row.get(1)?,
                result_text: row.get(2)?,
                character_count: row.get::<_, i64>(3)? as usize,
                processing_time_ms: row.get::<_, i64>(4)? as u64,
                created_at: row.get(5)?,
            })
        })?;

        let mut result = Vec::new();
        for record in records {
            result.push(record?);
        }

        Ok(result)
    }

    pub fn delete_record(&mut self, id: i64) -> Result<bool> {
        let affected = self.conn.execute(
            "DELETE FROM recognition_records WHERE id = ?1",
            params![id],
        )?;
        Ok(affected > 0)
    }

    pub fn save_config(&mut self, config: &AppConfig) -> Result<()> {
        let json = serde_json::to_string(config)
            .map_err(|e| crate::Error::ConfigError(format!("序列化配置失败: {}", e)))?;

        self.conn.execute(
            "REPLACE INTO config (key, value) VALUES ('app_config', ?1)",
            params![json],
        )?;

        Ok(())
    }

    pub fn load_config(&self) -> Result<Option<AppConfig>> {
        let mut stmt = self.conn.prepare(
            "SELECT value FROM config WHERE key = 'app_config'",
        )?;

        let json: Option<String> = stmt.query_row([], |row| row.get(0)).optional()?;

        match json {
            Some(s) => {
                let config: AppConfig = serde_json::from_str(&s)
                    .map_err(|e| crate::Error::ConfigError(format!("反序列化配置失败: {}", e)))?;
                Ok(Some(config))
            }
            None => Ok(None),
        }
    }

    pub fn get_statistics(&self) -> Result<Statistics> {
        let total_records: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM recognition_records",
            [],
            |row| row.get(0),
        )?;

        let total_characters: i64 = self.conn.query_row(
            "SELECT COALESCE(SUM(character_count), 0) FROM recognition_records",
            [],
            |row| row.get(0),
        )?;

        let avg_processing_time: Option<f64> = self.conn.query_row(
            "SELECT AVG(processing_time_ms) FROM recognition_records",
            [],
            |row| row.get(0),
        )?;

        Ok(Statistics {
            total_records: total_records as usize,
            total_characters: total_characters as usize,
            avg_processing_time_ms: avg_processing_time.unwrap_or(0.0),
        })
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct Statistics {
    pub total_records: usize,
    pub total_characters: usize,
    pub avg_processing_time_ms: f64,
}

pub struct GitBackup {
    repo_path: PathBuf,
}

impl GitBackup {
    pub fn new(repo_path: &str) -> Result<Self> {
        Ok(Self {
            repo_path: PathBuf::from(repo_path),
        })
    }

    pub fn init_repo(&self) -> Result<()> {
        if !self.repo_path.exists() {
            std::fs::create_dir_all(&self.repo_path)
                .map_err(|e| crate::Error::GitError(format!("创建目录失败: {}", e)))?;
        }

        if !self.repo_path.is_dir() {
            return Err(crate::Error::GitError(format!(
                "路径不是目录: {}",
                self.repo_path.display()
            )));
        }

        let repo = match git2::Repository::open(&self.repo_path) {
            Ok(r) => r,
            Err(_) => {
                git2::Repository::init(&self.repo_path)
                    .map_err(|e| crate::Error::GitError(format!("初始化Git仓库失败: {}", e)))?
            }
        };
        
        let mut config = repo.config()
            .or_else(|_| git2::Config::open_default())
            .map_err(|e| crate::Error::GitError(format!("获取Git配置失败: {}", e)))?;
        
        let _ = config.set_str("user.name", "Ancient Book Transcriber");
        let _ = config.set_str("user.email", "transcriber@localhost");

        Self::ensure_gitignore(&self.repo_path)?;

        Ok(())
    }

    fn ensure_gitignore(repo_path: &Path) -> Result<()> {
        let gitignore_path = repo_path.join(".gitignore");
        if !gitignore_path.exists() {
            let content = "# 临时文件\n*.tmp\n*.swp\n*.log\n.DS_Store\nThumbs.db\n";
            std::fs::write(&gitignore_path, content)
                .map_err(|e| crate::Error::GitError(format!("创建.gitignore失败: {}", e)))?;
        }
        Ok(())
    }

    fn create_signature() -> Result<git2::Signature<'static>> {
        git2::Signature::now("Ancient Book Transcriber", "transcriber@localhost")
            .map_err(|e| crate::Error::GitError(format!("创建Git签名失败: {}", e)))
    }

    pub fn backup_file(&self, file_path: &Path, message: &str) -> Result<()> {
        if !file_path.exists() {
            return Err(crate::Error::GitError(format!(
                "源文件不存在: {}",
                file_path.display()
            )));
        }

        let repo = git2::Repository::open(&self.repo_path)
            .map_err(|e| crate::Error::GitError(format!("打开Git仓库失败: {}", e)))?;

        let file_name = file_path.file_name()
            .ok_or_else(|| crate::Error::GitError("无效的文件名".to_string()))?;
        
        let dest_path = self.repo_path.join(file_name);
        
        std::fs::copy(file_path, &dest_path)
            .map_err(|e| crate::Error::GitError(format!("复制文件失败: {}", e)))?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = std::fs::metadata(&dest_path)
                .map_err(|e| crate::Error::GitError(format!("获取文件权限失败: {}", e)))?
                .permissions();
            perms.set_mode(0o644);
            std::fs::set_permissions(&dest_path, perms)
                .map_err(|e| crate::Error::GitError(format!("设置文件权限失败: {}", e)))?;
        }

        let mut index = repo.index()
            .map_err(|e| crate::Error::GitError(format!("获取Git索引失败: {}", e)))?;
        
        let rel_path = dest_path.strip_prefix(&self.repo_path)
            .map_err(|_| crate::Error::GitError("路径转换失败".to_string()))?;
        
        index.add_path(rel_path)
            .map_err(|e| crate::Error::GitError(format!("添加文件到Git索引失败: {}", e)))?;
        
        index.write()
            .map_err(|e| crate::Error::GitError(format!("写入Git索引失败: {}", e)))?;

        let oid = index.write_tree()
            .map_err(|e| crate::Error::GitError(format!("写入Git树失败: {}", e)))?;
        
        let tree = repo.find_tree(oid)
            .map_err(|e| crate::Error::GitError(format!("查找Git树失败: {}", e)))?;

        let parent_commit = match repo.head() {
            Ok(head) => Some(head.peel_to_commit()
                .map_err(|e| crate::Error::GitError(format!("获取父提交失败: {}", e)))?),
            Err(_) => None,
        };

        let parents = parent_commit.as_ref().map(|c| vec![c]).unwrap_or_default();
        let signature = Self::create_signature()?;
        
        repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            message,
            &tree,
            &parents,
        ).map_err(|e| crate::Error::GitError(format!("创建Git提交失败: {}", e)))?;

        Ok(())
    }

    pub fn get_history(&self) -> Result<Vec<String>> {
        let repo = git2::Repository::open(&self.repo_path)
            .map_err(|e| crate::Error::GitError(format!("打开Git仓库失败: {}", e)))?;

        let mut revwalk = repo.revwalk()
            .map_err(|e| crate::Error::GitError(format!("创建Git遍历失败: {}", e)))?;
        
        if let Err(e) = revwalk.push_head() {
            if e.class() == git2::ErrorClass::Reference && e.code() == git2::ErrorCode::NotFound {
                return Ok(vec!["仓库暂无提交记录".to_string()]);
            }
            return Err(crate::Error::GitError(format!("推送HEAD失败: {}", e)));
        }

        let mut history = Vec::new();
        for oid in revwalk {
            let oid = oid.map_err(|e| crate::Error::GitError(format!("获取OID失败: {}", e)))?;
            let commit = repo.find_commit(oid)
                .map_err(|e| crate::Error::GitError(format!("查找提交失败: {}", e)))?;
            history.push(format!(
                "{} - {}",
                &oid.to_string()[..7],
                commit.message().unwrap_or("无消息")
            ));
        }

        Ok(history)
    }
}
