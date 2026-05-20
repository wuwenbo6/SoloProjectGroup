pub mod preprocessing;
pub mod recognition;
pub mod transcription;
pub mod storage;
pub mod cli;
pub mod char_converter;
pub mod model_manager;
pub mod recognition_log;
pub mod platform;
pub mod operation_log;

pub use preprocessing::{Preprocessor, PreprocessConfig};
pub use recognition::{OcrEngine, OcrConfig, OcrResult, AccuracyLevel};
pub use transcription::{Transcriber, TranscriptionConfig, OutputFormat, BatchResult};
pub use storage::{Database, AppConfig, GitBackup, Statistics};
pub use cli::App;
pub use char_converter::{CharConverter, SentencePunctuator, CharMapping};
pub use model_manager::{ModelManager, FuzzyRecognizer, ModelInfo, FuzzyRecognitionConfig, FuzzyMatchLevel, CharFeatures, FuzzyMatchResult, CandidateChar, UpdateStatus};
pub use recognition_log::{RecognitionLogger, RecognitionLog, CharacterLog, RecognitionErrorType, RecognitionStatistics};
pub use platform::{get_app_home, get_models_dir, get_logs_dir, get_cache_dir, get_config_path, get_database_path, ensure_dir_exists, init_app_directories, get_os_name, get_cpu_count, format_size, expand_tilde};
pub use operation_log::{OperationLogger, OperationLogEntry, OperationType, OperationStatus, OperationStatistics, OperationTimer};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("图像处理错误: {0}")]
    ImageError(String),
    
    #[error("OCR识别错误: {0}")]
    OcrError(String),
    
    #[error("数据库错误: {0}")]
    DatabaseError(#[from] rusqlite::Error),
    
    #[error("IO错误: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("转录错误: {0}")]
    TranscriptionError(String),
    
    #[error("Git错误: {0}")]
    GitError(String),
    
    #[error("配置错误: {0}")]
    ConfigError(String),
    
    #[error("模型管理错误: {0}")]
    ModelError(String),
    
    #[error("日志错误: {0}")]
    LogError(String),
    
    #[error("操作日志错误: {0}")]
    OperationLogError(String),
}

pub type Result<T> = std::result::Result<T, Error>;
