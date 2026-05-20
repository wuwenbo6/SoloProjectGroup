use crate::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationLogEntry {
    pub id: String,
    pub timestamp: u64,
    pub operation_type: OperationType,
    pub status: OperationStatus,
    pub input_path: Option<String>,
    pub output_path: Option<String>,
    pub duration_ms: u64,
    pub error_message: Option<String>,
    pub user_agent: Option<String>,
    pub pid: u32,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum OperationType {
    Recognize,
    BatchRecognize,
    ConvertVariant,
    AddPunctuation,
    Export,
    GitBackup,
    ModelInstall,
    ModelUpdate,
    ConfigChange,
    Interactive,
    Other,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum OperationStatus {
    Success,
    Failed,
    Cancelled,
    InProgress,
}

impl OperationType {
    pub fn to_string(&self) -> &'static str {
        match self {
            OperationType::Recognize => "recognize",
            OperationType::BatchRecognize => "batch_recognize",
            OperationType::ConvertVariant => "convert_variant",
            OperationType::AddPunctuation => "add_punctuation",
            OperationType::Export => "export",
            OperationType::GitBackup => "git_backup",
            OperationType::ModelInstall => "model_install",
            OperationType::ModelUpdate => "model_update",
            OperationType::ConfigChange => "config_change",
            OperationType::Interactive => "interactive",
            OperationType::Other => "other",
        }
    }
}

pub struct OperationLogger {
    log_file: PathBuf,
    buffer: Mutex<Vec<OperationLogEntry>>,
    max_buffer_size: usize,
    enabled: bool,
}

impl OperationLogger {
    pub fn new(log_file: PathBuf) -> Self {
        Self {
            log_file,
            buffer: Mutex::new(Vec::new()),
            max_buffer_size: 100,
            enabled: true,
        }
    }

    pub fn default() -> Result<Self> {
        let log_dir = crate::platform::get_logs_dir();
        crate::platform::ensure_dir_exists(&log_dir)?;
        let log_file = log_dir.join("operations.jsonl");
        Ok(Self::new(log_file))
    }

    pub fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    pub fn log(&self, entry: OperationLogEntry) -> Result<()> {
        if !self.enabled {
            return Ok(());
        }

        let mut buffer = self.buffer.lock().unwrap();
        buffer.push(entry);

        if buffer.len() >= self.max_buffer_size {
            self.flush_buffer(&buffer)?;
            buffer.clear();
        }

        Ok(())
    }

    pub fn log_operation(
        &self,
        operation_type: OperationType,
        status: OperationStatus,
        input_path: Option<&str>,
        output_path: Option<&str>,
        duration_ms: u64,
        error_message: Option<String>,
    ) -> Result<()> {
        use std::time::SystemTime;

        let entry = OperationLogEntry {
            id: format!("op_{}_{}", SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs(), rand::random::<u32>()),
            timestamp: SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs(),
            operation_type,
            status,
            input_path: input_path.map(|s| s.to_string()),
            output_path: output_path.map(|s| s.to_string()),
            duration_ms,
            error_message,
            user_agent: Some(format!("abt/{}", env!("CARGO_PKG_VERSION"))),
            pid: std::process::id(),
        };

        self.log(entry)
    }

    fn flush_buffer(&self, buffer: &[OperationLogEntry]) -> Result<()> {
        use std::io::Write;

        if buffer.is_empty() {
            return Ok(());
        }

        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.log_file)?;

        for entry in buffer {
            let line = serde_json::to_string(entry)?;
            writeln!(file, "{}", line)?;
        }

        Ok(())
    }

    pub fn flush(&self) -> Result<()> {
        let mut buffer = self.buffer.lock().unwrap();
        if !buffer.is_empty() {
            self.flush_buffer(&buffer)?;
            buffer.clear();
        }
        Ok(())
    }

    pub fn get_logs(&self, limit: Option<usize>) -> Result<Vec<OperationLogEntry>> {
        self.flush()?;

        let mut logs = Vec::new();

        if !self.log_file.exists() {
            return Ok(logs);
        }

        let content = std::fs::read_to_string(&self.log_file)?;
        for line in content.lines() {
            if let Ok(entry) = serde_json::from_str::<OperationLogEntry>(line) {
                logs.push(entry);
            }
        }

        logs.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

        if let Some(limit) = limit {
            logs.truncate(limit);
        }

        Ok(logs)
    }

    pub fn get_logs_by_type(&self, operation_type: OperationType, limit: Option<usize>) -> Result<Vec<OperationLogEntry>> {
        let logs = self.get_logs(None)?;
        let mut filtered: Vec<_> = logs.into_iter()
            .filter(|log| log.operation_type as u8 == operation_type as u8)
            .collect();

        if let Some(limit) = limit {
            filtered.truncate(limit);
        }

        Ok(filtered)
    }

    pub fn get_logs_by_status(&self, status: OperationStatus, limit: Option<usize>) -> Result<Vec<OperationLogEntry>> {
        let logs = self.get_logs(None)?;
        let mut filtered: Vec<_> = logs.into_iter()
            .filter(|log| log.status as u8 == status as u8)
            .collect();

        if let Some(limit) = limit {
            filtered.truncate(limit);
        }

        Ok(filtered)
    }

    pub fn get_statistics(&self) -> Result<OperationStatistics> {
        let logs = self.get_logs(None)?;

        let mut stats = OperationStatistics::default();

        for log in &logs {
            stats.total_operations += 1;

            match log.status {
                OperationStatus::Success => stats.successful_operations += 1,
                OperationStatus::Failed => stats.failed_operations += 1,
                OperationStatus::Cancelled => stats.cancelled_operations += 1,
                OperationStatus::InProgress => stats.in_progress_operations += 1,
            }

            stats.total_duration_ms += log.duration_ms;

            let type_count = stats.operation_type_counts
                .entry(log.operation_type.to_string().to_string())
                .or_insert(0);
            *type_count += 1;
        }

        if stats.total_operations > 0 {
            stats.average_duration_ms = stats.total_duration_ms / stats.total_operations;
            stats.success_rate = stats.successful_operations as f32 / stats.total_operations as f32;
        }

        Ok(stats)
    }

    pub fn clear_old_logs(&self, days: u64) -> Result<usize> {
        self.flush()?;

        let logs = self.get_logs(None)?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let cutoff = now - (days * 24 * 60 * 60);

        let kept_logs: Vec<_> = logs.into_iter()
            .filter(|log| log.timestamp >= cutoff)
            .collect();

        let removed = logs.len() - kept_logs.len();

        if removed > 0 {
            use std::io::Write;
            let mut file = std::fs::File::create(&self.log_file)?;
            for entry in kept_logs {
                let line = serde_json::to_string(&entry)?;
                writeln!(file, "{}", line)?;
            }
        }

        Ok(removed)
    }

    pub fn export_logs(&self, output_path: &std::path::Path, format: &str) -> Result<()> {
        let logs = self.get_logs(None)?;

        match format.to_lowercase().as_str() {
            "json" => {
                let json = serde_json::to_string_pretty(&logs)?;
                std::fs::write(output_path, json)?;
            }
            "csv" => {
                let mut wtr = csv::Writer::from_path(output_path)?;
                for log in logs {
                    wtr.write_record(&[
                        &log.id,
                        &log.timestamp.to_string(),
                        log.operation_type.to_string(),
                        &format!("{:?}", log.status),
                        log.input_path.as_deref().unwrap_or(""),
                        log.output_path.as_deref().unwrap_or(""),
                        &log.duration_ms.to_string(),
                        log.error_message.as_deref().unwrap_or(""),
                    ])?;
                }
                wtr.flush()?;
            }
            _ => {
                return Err(crate::Error::LogError(format!("不支持的导出格式: {}", format)));
            }
        }

        Ok(())
    }
}

impl Drop for OperationLogger {
    fn drop(&mut self) {
        let _ = self.flush();
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OperationStatistics {
    pub total_operations: u64,
    pub successful_operations: u64,
    pub failed_operations: u64,
    pub cancelled_operations: u64,
    pub in_progress_operations: u64,
    pub average_duration_ms: u64,
    pub total_duration_ms: u64,
    pub success_rate: f32,
    pub operation_type_counts: std::collections::HashMap<String, u64>,
}

pub struct OperationTimer<'a> {
    logger: &'a OperationLogger,
    operation_type: OperationType,
    start: std::time::Instant,
    input_path: Option<String>,
    output_path: Option<String>,
}

impl<'a> OperationTimer<'a> {
    pub fn new(logger: &'a OperationLogger, operation_type: OperationType) -> Self {
        Self {
            logger,
            operation_type,
            start: std::time::Instant::now(),
            input_path: None,
            output_path: None,
        }
    }

    pub fn input_path(mut self, path: &str) -> Self {
        self.input_path = Some(path.to_string());
        self
    }

    pub fn output_path(mut self, path: &str) -> Self {
        self.output_path = Some(path.to_string());
        self
    }

    pub fn finish(self, status: OperationStatus, error: Option<String>) -> Result<()> {
        let duration_ms = self.start.elapsed().as_millis() as u64;
        self.logger.log_operation(
            self.operation_type,
            status,
            self.input_path.as_deref(),
            self.output_path.as_deref(),
            duration_ms,
            error,
        )
    }

    pub fn success(self) -> Result<()> {
        self.finish(OperationStatus::Success, None)
    }

    pub fn fail(self, error: String) -> Result<()> {
        self.finish(OperationStatus::Failed, Some(error))
    }
}
