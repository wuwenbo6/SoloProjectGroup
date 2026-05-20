use crate::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecognitionLog {
    pub id: String,
    pub timestamp: u64,
    pub image_path: String,
    pub image_hash: String,
    pub recognition_result: String,
    pub corrected_result: Option<String>,
    pub is_corrected: bool,
    pub confidence: f32,
    pub character_logs: Vec<CharacterLog>,
    pub model_version: Option<String>,
    pub processing_time_ms: u64,
    pub error_type: Option<RecognitionErrorType>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterLog {
    pub original_char: char,
    pub recognized_char: char,
    pub corrected_char: Option<char>,
    pub confidence: f32,
    pub position_x: u32,
    pub position_y: u32,
    pub width: u32,
    pub height: u32,
    pub is_fuzzy_match: bool,
    pub fuzzy_method: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum RecognitionErrorType {
    Misrecognition,
    MissedCharacter,
    FuzzyMatchError,
    LayoutError,
    VariantCharError,
    Unknown,
}

impl RecognitionErrorType {
    pub fn to_string(&self) -> &'static str {
        match self {
            RecognitionErrorType::Misrecognition => "识别错误",
            RecognitionErrorType::MissedCharacter => "漏识别",
            RecognitionErrorType::FuzzyMatchError => "模糊匹配错误",
            RecognitionErrorType::LayoutError => "版式错误",
            RecognitionErrorType::VariantCharError => "异体字识别错误",
            RecognitionErrorType::Unknown => "未知错误",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecognitionStatistics {
    pub total_recognitions: u64,
    pub total_corrections: u64,
    pub average_confidence: f32,
    pub error_distribution: HashMap<String, u64>,
    pub most_misrecognized_chars: Vec<(char, u64)>,
    pub total_processing_time_ms: u64,
}

pub struct RecognitionLogger {
    log_dir: PathBuf,
    logs: Vec<RecognitionLog>,
    max_logs: usize,
}

impl RecognitionLogger {
    pub fn new(base_dir: Option<&Path>) -> Result<Self> {
        let log_dir = if let Some(dir) = base_dir {
            dir.join("logs")
        } else {
            dirs::home_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join(".abt")
                .join("logs")
        };

        std::fs::create_dir_all(&log_dir)?;

        let mut logger = Self {
            log_dir,
            logs: Vec::new(),
            max_logs: 1000,
        };

        logger.load_logs()?;
        Ok(logger)
    }

    fn load_logs(&mut self) -> Result<()> {
        let log_file = self.log_dir.join("recognition_logs.json");
        if log_file.exists() {
            let content = std::fs::read_to_string(&log_file)?;
            let logs: Vec<RecognitionLog> = serde_json::from_str(&content)
                .map_err(|e| crate::Error::LogError(format!("加载日志失败: {}", e)))?;
            self.logs = logs;
        }
        Ok(())
    }

    fn save_logs(&self) -> Result<()> {
        let log_file = self.log_dir.join("recognition_logs.json");
        let json = serde_json::to_string_pretty(&self.logs)
            .map_err(|e| crate::Error::LogError(format!("保存日志失败: {}", e)))?;
        std::fs::write(&log_file, json)?;
        Ok(())
    }

    pub fn log_recognition(&mut self, log: RecognitionLog) -> Result<()> {
        self.logs.push(log);

        if self.logs.len() > self.max_logs {
            self.logs = self.logs.iter()
                .skip(self.logs.len() - self.max_logs)
                .cloned()
                .collect();
        }

        self.save_logs()?;
        Ok(())
    }

    pub fn create_log(
        &self,
        image_path: &Path,
        recognition_result: String,
        confidence: f32,
        character_logs: Vec<CharacterLog>,
        model_version: Option<String>,
        processing_time_ms: u64,
    ) -> RecognitionLog {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        RecognitionLog {
            id: format!("log_{}_{}", timestamp, rand::random::<u32>()),
            timestamp,
            image_path: image_path.to_string_lossy().to_string(),
            image_hash: format!("hash_{}", timestamp),
            recognition_result,
            corrected_result: None,
            is_corrected: false,
            confidence,
            character_logs,
            model_version,
            processing_time_ms,
            error_type: None,
            notes: None,
        }
    }

    pub fn create_character_log(
        &self,
        original_char: char,
        recognized_char: char,
        confidence: f32,
        position_x: u32,
        position_y: u32,
        width: u32,
        height: u32,
        is_fuzzy_match: bool,
        fuzzy_method: Option<String>,
    ) -> CharacterLog {
        CharacterLog {
            original_char,
            recognized_char,
            corrected_char: None,
            confidence,
            position_x,
            position_y,
            width,
            height,
            is_fuzzy_match,
            fuzzy_method,
        }
    }

    pub fn mark_corrected(&mut self, log_id: &str, corrected_result: String, corrections: Vec<(usize, char)>) -> Result<()> {
        if let Some(log) = self.logs.iter_mut().find(|l| l.id == log_id) {
            log.corrected_result = Some(corrected_result);
            log.is_corrected = true;

            for (char_idx, corrected_char) in corrections {
                if let Some(char_log) = log.character_logs.get_mut(char_idx) {
                    char_log.corrected_char = Some(corrected_char);
                }
            }

            self.save_logs()?;
        }
        Ok(())
    }

    pub fn get_logs(&self, limit: Option<usize>) -> Vec<&RecognitionLog> {
        let mut logs: Vec<_> = self.logs.iter().collect();
        logs.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        
        if let Some(limit) = limit {
            logs.truncate(limit);
        }
        
        logs
    }

    pub fn get_error_logs(&self, error_type: Option<RecognitionErrorType>) -> Vec<&RecognitionLog> {
        self.logs.iter()
            .filter(|log| {
                if let Some(et) = error_type {
                    log.error_type == Some(et)
                } else {
                    log.error_type.is_some()
                }
            })
            .collect()
    }

    pub fn get_corrected_logs(&self) -> Vec<&RecognitionLog> {
        self.logs.iter()
            .filter(|log| log.is_corrected)
            .collect()
    }

    pub fn get_statistics(&self) -> RecognitionStatistics {
        let total_recognitions = self.logs.len() as u64;
        let total_corrections = self.logs.iter().filter(|l| l.is_corrected).count() as u64;
        
        let avg_confidence = if !self.logs.is_empty() {
            self.logs.iter().map(|l| l.confidence).sum::<f32>() / self.logs.len() as f32
        } else {
            0.0
        };

        let mut error_distribution = HashMap::new();
        for log in &self.logs {
            if let Some(error_type) = log.error_type {
                *error_distribution
                    .entry(error_type.to_string().to_string())
                    .or_insert(0u64) += 1;
            }
        }

        let mut char_count = HashMap::new();
        for log in &self.logs {
            for char_log in &log.character_logs {
                if char_log.corrected_char.is_some() {
                    *char_count.entry(char_log.recognized_char).or_insert(0u64) += 1;
                }
            }
        }

        let mut most_misrecognized: Vec<_> = char_count.into_iter().collect();
        most_misrecognized.sort_by(|a, b| b.1.cmp(&a.1));
        most_misrecognized.truncate(10);

        let total_processing_time = self.logs.iter().map(|l| l.processing_time_ms).sum();

        RecognitionStatistics {
            total_recognitions,
            total_corrections,
            average_confidence: avg_confidence,
            error_distribution,
            most_misrecognized_chars: most_misrecognized,
            total_processing_time_ms: total_processing_time,
        }
    }

    pub fn export_logs(&self, output_path: &Path, format: &str) -> Result<()> {
        match format.to_lowercase().as_str() {
            "json" => {
                let json = serde_json::to_string_pretty(&self.logs)
                    .map_err(|e| crate::Error::LogError(format!("导出JSON失败: {}", e)))?;
                std::fs::write(output_path, json)?;
            }
            "csv" => {
                let mut wtr = csv::Writer::from_path(output_path)
                    .map_err(|e| crate::Error::LogError(format!("创建CSV文件失败: {}", e)))?;
                
                for log in &self.logs {
                    wtr.write_record(&[
                        &log.id,
                        &log.timestamp.to_string(),
                        &log.image_path,
                        &log.recognition_result,
                        &log.corrected_result.clone().unwrap_or_default(),
                        &log.confidence.to_string(),
                        &log.is_corrected.to_string(),
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

    pub fn clear_old_logs(&mut self, older_than_days: u64) -> Result<usize> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let cutoff = now - (older_than_days * 24 * 60 * 60);

        let original_len = self.logs.len();
        self.logs.retain(|log| log.timestamp >= cutoff);
        let removed = original_len - self.logs.len();

        self.save_logs()?;
        Ok(removed)
    }

    pub fn export_training_data(&self, output_path: &Path) -> Result<()> {
        let corrected_logs = self.get_corrected_logs();
        let mut training_data = Vec::new();

        for log in corrected_logs {
            if let (Some(corrected), Some(_model)) = (&log.corrected_result, &log.model_version) {
                training_data.push(serde_json::json!({
                    "original": log.recognition_result,
                    "corrected": corrected,
                    "image_path": log.image_path,
                    "confidence": log.confidence,
                }));
            }
        }

        let json = serde_json::to_string_pretty(&training_data)
            .map_err(|e| crate::Error::LogError(format!("导出训练数据失败: {}", e)))?;
        std::fs::write(output_path, json)?;

        println!("导出训练数据: {} 条", training_data.len());
        Ok(())
    }

    pub fn get_log_dir(&self) -> &Path {
        &self.log_dir
    }
}
