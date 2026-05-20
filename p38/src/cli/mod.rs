use crate::preprocessing::Preprocessor;
use crate::recognition::{AccuracyLevel, OcrConfig, OcrEngine, OcrResult};
use crate::storage::{AppConfig, Database, GitBackup};
use crate::transcription::{OutputFormat, TranscriptionConfig, Transcriber};
use crate::Result;
use clap::{CommandFactory, Parser, Subcommand, ValueEnum};
use dialoguer::{Confirm, Input, MultiSelect, Select};
use indicatif::{ProgressBar, ProgressStyle};
use std::path::{Path, PathBuf};

fn normalize_path(path: &Path) -> Result<PathBuf> {
    let path_str = path.to_string_lossy();
    
    if path_str.starts_with('~') {
        if let Some(home) = dirs::home_dir() {
            if path_str == "~" {
                return Ok(home);
            }
            if path_str.starts_with("~/") {
                let relative = &path_str[2..];
                return Ok(home.join(relative));
            }
        }
    }
    
    let canonical = std::fs::canonicalize(path)
        .or_else(|_| {
            if path.is_relative() {
                Ok(std::env::current_dir()?.join(path))
            } else {
                Ok(path.to_path_buf())
            }
        })?;
    
    Ok(canonical)
}

fn validate_file_exists(path: &Path) -> Result<()> {
    if !path.exists() {
        return Err(crate::Error::ImageError(format!(
            "文件不存在: {}",
            path.display()
        )));
    }
    
    if !path.is_file() {
        return Err(crate::Error::ImageError(format!(
            "不是有效的文件: {}",
            path.display()
        )));
    }
    
    let metadata = std::fs::metadata(path)
        .map_err(|e| crate::Error::ImageError(format!("无法访问文件: {}", e)))?;
    
    if metadata.len() == 0 {
        return Err(crate::Error::ImageError(format!(
            "文件为空: {}",
            path.display()
        )));
    }
    
    Ok(())
}

#[derive(Debug, Clone, ValueEnum)]
pub enum CliOutputFormat {
    Txt,
    Pdf,
    Json,
    Markdown,
    Csv,
    Html,
}

#[derive(Debug, Clone, ValueEnum)]
pub enum CliAccuracy {
    Low,
    Medium,
    High,
}

#[derive(Debug, Parser)]
#[command(name = "abt")]
#[command(about = "古籍刻本数字化转录命令行工具 (Ancient Book Transcriber)", long_about = None)]
#[command(version = "1.0.0")]
pub struct Cli {
    #[arg(short, long, help = "配置文件路径")]
    pub config: Option<PathBuf>,
    
    #[arg(short, long, help = "启用详细输出")]
    pub verbose: bool,
    
    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Debug, Subcommand)]
pub enum Commands {
    #[command(about = "识别古籍刻本图像")]
    Recognize {
        #[arg(short, long, help = "输入图像路径")]
        input: PathBuf,
        
        #[arg(short, long, help = "输出文件路径")]
        output: Option<PathBuf>,
        
        #[arg(short, long, value_enum, default_value_t = CliOutputFormat::Txt, help = "输出格式")]
        format: CliOutputFormat,
        
        #[arg(short, long, value_enum, default_value_t = CliAccuracy::Medium, help = "识别精度")]
        accuracy: CliAccuracy,
        
        #[arg(long, help = "不转换异体字")]
        no_variants: bool,
        
        #[arg(long, help = "转换为简体字")]
        simplified: bool,
        
        #[arg(long, help = "自动添加标点符号")]
        punctuate: bool,
        
        #[arg(long, help = "保存到历史记录")]
        save: bool,
        
        #[arg(long, help = "保留原始版式")]
        no_layout: bool,
        
        #[arg(long, help = "包含置信度信息")]
        confidence: bool,
        
        #[arg(long, help = "字体大小 (PDF)")]
        font_size: Option<f32>,
        
        #[arg(long, help = "页面边距 (PDF)")]
        margin: Option<f32>,
    },
    
    #[command(about = "批量识别古籍刻本图像")]
    Batch {
        #[arg(short, long, help = "输入目录路径")]
        input_dir: PathBuf,
        
        #[arg(short, long, help = "输出目录路径")]
        output_dir: Option<PathBuf>,
        
        #[arg(short, long, value_enum, default_value_t = CliOutputFormat::Txt, help = "输出格式")]
        format: CliOutputFormat,
        
        #[arg(long, help = "包含置信度信息")]
        confidence: bool,
    },
    
    #[command(about = "交互式模式")]
    Interactive,
    
    #[command(about = "查看识别历史记录")]
    History {
        #[arg(short, long, help = "显示最近N条记录")]
        limit: Option<usize>,
        
        #[arg(short, long, help = "搜索关键词")]
        search: Option<String>,
    },
    
    #[command(about = "查看识别统计")]
    Stats,
    
    #[command(about = "配置管理")]
    Config {
        #[command(subcommand)]
        action: ConfigAction,
    },
    
    #[command(about = "Git备份管理")]
    Git {
        #[command(subcommand)]
        action: GitAction,
    },
    
    #[command(about = "异体字转换工具")]
    Variant {
        #[command(subcommand)]
        action: VariantAction,
    },
    
    #[command(about = "文本处理工具")]
    Text {
        #[command(subcommand)]
        action: TextAction,
    },
    
    #[command(about = "生成自动补全脚本")]
    Completions {
        #[arg(value_enum)]
        shell: clap_complete::Shell,
    },
    
    #[command(about = "模型管理")]
    Model {
        #[command(subcommand)]
        action: ModelAction,
    },
    
    #[command(about = "识别日志管理")]
    Log {
        #[command(subcommand)]
        action: LogAction,
    },
}

#[derive(Debug, Subcommand)]
pub enum ModelAction {
    #[command(about = "列出可用模型")]
    List,
    
    #[command(about = "列出已安装模型")]
    Installed,
    
    #[command(about = "安装模型")]
    Install {
        #[arg(help = "模型名称")]
        name: String,
    },
    
    #[command(about = "卸载模型")]
    Uninstall {
        #[arg(help = "模型名称")]
        name: String,
    },
    
    #[command(about = "激活模型")]
    Activate {
        #[arg(help = "模型名称")]
        name: String,
    },
    
    #[command(about = "增量更新模型")]
    Update {
        #[arg(help = "模型名称")]
        name: String,
    },
    
    #[command(about = "检查模型更新")]
    Check,
}

#[derive(Debug, Subcommand)]
pub enum LogAction {
    #[command(about = "查看识别日志")]
    List {
        #[arg(short, long, help = "显示最近N条记录")]
        limit: Option<usize>,
    },
    
    #[command(about = "查看错误日志")]
    Errors {
        #[arg(short, long, help = "限制显示数量")]
        limit: Option<usize>,
    },
    
    #[command(about = "查看识别统计")]
    Stats,
    
    #[command(about = "导出日志")]
    Export {
        #[arg(short, long, help = "输出路径")]
        output: PathBuf,
        
        #[arg(short, long, default_value_t = String::from("json"), help = "输出格式 (json/csv)")]
        format: String,
    },
    
    #[command(about = "清理旧日志")]
    Clean {
        #[arg(short, long, default_value_t = 30, help = "保留最近N天的日志")]
        days: u64,
    },
    
    #[command(about = "导出训练数据")]
    ExportTraining {
        #[arg(short, long, help = "输出路径")]
        output: PathBuf,
    },
}

#[derive(Debug, Subcommand)]
pub enum ConfigAction {
    #[command(about = "显示当前配置")]
    Show,
    
    #[command(about = "重置为默认配置")]
    Reset,
    
    #[command(about = "设置默认输出格式")]
    SetFormat {
        #[arg(value_enum)]
        format: CliOutputFormat,
    },
    
    #[command(about = "设置默认精度")]
    SetAccuracy {
        #[arg(value_enum)]
        accuracy: CliAccuracy,
    },
}

#[derive(Debug, Subcommand)]
pub enum GitAction {
    #[command(about = "初始化Git仓库")]
    Init {
        #[arg(help = "仓库路径")]
        path: Option<PathBuf>,
    },
    
    #[command(about = "查看备份历史")]
    History,
    
    #[command(about = "启用Git备份")]
    Enable,
    
    #[command(about = "禁用Git备份")]
    Disable,
}

#[derive(Debug, Subcommand)]
pub enum VariantAction {
    #[command(about = "查看异体字对照表")]
    List,
    
    #[command(about = "转换文本中的异体字")]
    Convert {
        #[arg(short, long, help = "输入文本文件")]
        input: PathBuf,
        
        #[arg(short, long, help = "输出文件路径")]
        output: Option<PathBuf>,
        
        #[arg(long, help = "同时转换为简体字")]
        simplified: bool,
    },
}

#[derive(Debug, Subcommand)]
pub enum TextAction {
    #[command(about = "添加标点符号")]
    Punctuate {
        #[arg(short, long, help = "输入文本文件")]
        input: PathBuf,
        
        #[arg(short, long, help = "输出文件路径")]
        output: Option<PathBuf>,
    },
    
    #[command(about = "查找替换")]
    Replace {
        #[arg(short, long, help = "输入文本文件")]
        input: PathBuf,
        
        #[arg(short, long, help = "输出文件路径")]
        output: Option<PathBuf>,
        
        #[arg(short, long, help = "查找文本")]
        find: String,
        
        #[arg(short, long, help = "替换文本")]
        replace: String,
    },
    
    #[command(about = "字符统计")]
    Stats {
        #[arg(short, long, help = "输入文本文件")]
        input: PathBuf,
    },
}

pub struct App {
    cli: Cli,
    db: Database,
    config: AppConfig,
}

impl App {
    pub fn new() -> Result<Self> {
        let cli = Cli::parse();
        
        let db_path = if let Some(config_path) = &cli.config {
            config_path.parent().unwrap_or_else(|| std::path::Path::new("."))
                .join("abt.db")
        } else {
            dirs::home_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join(".abt")
                .join("abt.db")
        };
        
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        
        let mut db = Database::new(&db_path)?;
        let config = db.load_config()?.unwrap_or_default();
        
        Ok(Self { cli, db, config })
    }

    pub fn run(&mut self) -> Result<()> {
        match &self.cli.command {
            Commands::Recognize {
                input,
                output,
                format,
                accuracy,
                no_variants,
                simplified,
                punctuate,
                save,
                no_layout,
                confidence,
                font_size,
                margin,
            } => self.recognize(input, output, format, accuracy, no_variants, simplified, punctuate, save, no_layout, confidence, font_size, margin),
            
            Commands::Batch { input_dir, output_dir, format, confidence } => self.batch_recognize(input_dir, output_dir, format, confidence),
            
            Commands::Interactive => self.interactive_mode(),
            
            Commands::History { limit, search } => self.show_history(*limit, search.as_deref()),
            
            Commands::Stats => self.show_stats(),
            
            Commands::Config { action } => self.handle_config(action),
            
            Commands::Git { action } => self.handle_git(action),
            
            Commands::Variant { action } => self.handle_variant(action),
            
            Commands::Text { action } => self.handle_text(action),
            
            Commands::Completions { shell } => self.generate_completions(*shell),
            
            Commands::Model { action } => self.handle_model(action),
            
            Commands::Log { action } => self.handle_log(action),
        }
    }

    #[allow(clippy::too_many_arguments)]
    fn recognize(
        &mut self,
        input: &PathBuf,
        output: &Option<PathBuf>,
        format: &CliOutputFormat,
        accuracy: &CliAccuracy,
        no_variants: &bool,
        simplified: &bool,
        punctuate: &bool,
        save: &bool,
        no_layout: &bool,
        confidence: &bool,
        font_size: &Option<f32>,
        margin: &Option<f32>,
    ) -> Result<()> {
        let input_path = normalize_path(input)?;
        validate_file_exists(&input_path)?;
        
        let valid_extensions = ["jpg", "jpeg", "png", "bmp", "tiff", "tif"];
        if let Some(ext) = input_path.extension().and_then(|e| e.to_str()) {
            if !valid_extensions.contains(&ext.to_lowercase().as_str()) {
                return Err(crate::Error::ImageError(format!(
                    "不支持的文件格式: {}. 支持的格式: jpg, jpeg, png, bmp, tiff",
                    ext
                )));
            }
        }
        
        let pb = ProgressBar::new(4);
        pb.set_style(ProgressStyle::default_bar()
            .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {pos}/{len} {msg}")
            .unwrap()
            .progress_chars("#>-"));

        pb.set_message("图像预处理...");
        let preprocessor = Preprocessor::new(self.config.preprocess.clone());
        pb.inc(1);

        pb.set_message("OCR识别...");
        let ocr_config = OcrConfig {
            accuracy: match accuracy {
                CliAccuracy::Low => AccuracyLevel::Low,
                CliAccuracy::Medium => AccuracyLevel::Medium,
                CliAccuracy::High => AccuracyLevel::High,
            },
            support_variants: !no_variants,
            support_ancient: self.config.ocr.support_ancient,
            model_path: self.config.ocr.model_path.clone(),
        };
        let ocr_engine = OcrEngine::new(ocr_config)?;
        let result = ocr_engine.recognize_file(&input_path, &preprocessor)?;
        pb.inc(1);

        let output_path = output.clone().unwrap_or_else(|| {
            let mut path = input_path.clone();
            let ext = match format {
                CliOutputFormat::Txt => "txt",
                CliOutputFormat::Pdf => "pdf",
                CliOutputFormat::Json => "json",
                CliOutputFormat::Markdown => "md",
                CliOutputFormat::Csv => "csv",
                CliOutputFormat::Html => "html",
            };
            path.set_extension(ext);
            path
        });

        pb.set_message(format!("转录为{}...", output_path.display()));
        let transcribe_config = TranscriptionConfig {
            output_format: match format {
                CliOutputFormat::Txt => OutputFormat::Txt,
                CliOutputFormat::Pdf => OutputFormat::Pdf,
                CliOutputFormat::Json => OutputFormat::Json,
                CliOutputFormat::Markdown => OutputFormat::Markdown,
                CliOutputFormat::Csv => OutputFormat::Csv,
                CliOutputFormat::Html => OutputFormat::Html,
            },
            include_metadata: self.config.ocr.support_ancient,
            include_confidence: *confidence,
            preserve_layout: !no_layout,
            line_spacing: 1.5,
            convert_to_simplified: *simplified,
            convert_to_standard: !no_variants,
            auto_punctuate: *punctuate,
            font_size: font_size.unwrap_or(14.0),
            margin: margin.unwrap_or(20.0),
        };
        let transcriber = Transcriber::new(transcribe_config);
        transcriber.transcribe(&result, &output_path)?;
        pb.inc(1);

        if *save {
            pb.set_message("保存记录...");
            self.db.insert_record(
                &input_path.to_string_lossy(),
                &result.text,
                result.total_characters,
                result.processing_time_ms,
            )?;
            pb.inc(1);
        }

        if self.config.git_backup_enabled {
            if let Some(repo_path) = &self.config.git_repository_path {
                let backup = GitBackup::new(repo_path)?;
                backup.backup_file(&output_path, &format!("转录: {}", input_path.display()))?;
            }
        }

        pb.finish_with_message(format!("完成! 输出文件: {}", output_path.display()));
        
        if self.cli.verbose {
            println!("\n识别统计:");
            println!("  总字符数: {}", result.total_characters);
            println!("  处理时间: {} ms", result.processing_time_ms);
            println!("  平均置信度: {:.1}%", 
                if result.characters.is_empty() { 0.0 } else {
                    result.characters.iter().map(|c| c.confidence).sum::<f32>() 
                    / result.characters.len() as f32 * 100.0
                }
            );
        }

        Ok(())
    }

    fn batch_recognize(
        &mut self,
        input_dir: &PathBuf,
        output_dir: &Option<PathBuf>,
        format: &CliOutputFormat,
        confidence: &bool,
    ) -> Result<()> {
        let input_path = normalize_path(input_dir)?;
        
        if !input_path.is_dir() {
            return Err(crate::Error::ImageError(format!(
                "不是有效的目录: {}",
                input_path.display()
            )));
        }

        let output_path = output_dir.clone().unwrap_or_else(|| input_path.join("output"));
        std::fs::create_dir_all(&output_path)?;

        let mut image_files = Vec::new();
        for entry in std::fs::read_dir(&input_path)? {
            let entry = entry?;
            let path = entry.path();
            
            if path.is_file() {
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    if ["jpg", "jpeg", "png", "bmp", "tiff", "tif"].contains(&ext.to_lowercase().as_str()) {
                        image_files.push(path);
                    }
                }
            }
        }

        if image_files.is_empty() {
            println!("目录中没有找到图像文件");
            return Ok(());
        }

        println!("找到 {} 个图像文件", image_files.len());

        let pb = ProgressBar::new(image_files.len() as u64);
        pb.set_style(ProgressStyle::default_bar()
            .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {pos}/{len} {msg}")
            .unwrap()
            .progress_chars("#>-"));

        let preprocessor = Preprocessor::new(self.config.preprocess.clone());
        let ocr_engine = OcrEngine::new(self.config.ocr.clone())?;
        let transcriber_config = TranscriptionConfig {
            output_format: match format {
                CliOutputFormat::Txt => OutputFormat::Txt,
                CliOutputFormat::Pdf => OutputFormat::Pdf,
                CliOutputFormat::Json => OutputFormat::Json,
                CliOutputFormat::Markdown => OutputFormat::Markdown,
                CliOutputFormat::Csv => OutputFormat::Csv,
                CliOutputFormat::Html => OutputFormat::Html,
            },
            include_metadata: true,
            include_confidence: *confidence,
            preserve_layout: true,
            line_spacing: 1.5,
            convert_to_simplified: false,
            convert_to_standard: true,
            auto_punctuate: false,
            font_size: 14.0,
            margin: 20.0,
        };
        let transcriber = Transcriber::new(transcriber_config);

        let mut successful = 0;
        let mut failed = 0;

        for image_file in &image_files {
            pb.set_message(format!("处理: {}", image_file.file_name().unwrap_or_default().to_string_lossy()));
            
            match ocr_engine.recognize_file(image_file, &preprocessor) {
                Ok(result) => {
                    let file_stem = image_file.file_stem().and_then(|s| s.to_str()).unwrap_or("output");
                    let ext = match format {
                        CliOutputFormat::Txt => "txt",
                        CliOutputFormat::Pdf => "pdf",
                        CliOutputFormat::Json => "json",
                        CliOutputFormat::Markdown => "md",
                        CliOutputFormat::Csv => "csv",
                        CliOutputFormat::Html => "html",
                    };
                    let output_file = output_path.join(format!("{}.{}", file_stem, ext));
                    
                    if transcriber.transcribe(&result, &output_file).is_ok() {
                        successful += 1;
                    } else {
                        failed += 1;
                    }
                }
                Err(_) => {
                    failed += 1;
                }
            }
            
            pb.inc(1);
        }

        pb.finish_with_message("批量处理完成");
        
        println!("\n处理结果:");
        println!("  成功: {} 个文件", successful);
        println!("  失败: {} 个文件", failed);
        println!("  输出目录: {}", output_path.display());

        Ok(())
    }

    fn interactive_mode(&mut self) -> Result<()> {
        println!("=== 古籍刻本转录工具 - 交互式模式 ===");
        
        loop {
            let items = vec![
                "识别图像",
                "批量识别",
                "查看历史记录",
                "查看统计信息",
                "异体字转换",
                "文本处理",
                "配置管理",
                "Git备份",
                "退出",
            ];
            
            let selection = Select::new()
                .with_prompt("请选择操作")
                .items(&items)
                .default(0)
                .interact()?;
            
            match selection {
                0 => self.interactive_recognize()?,
                1 => self.interactive_batch()?,
                2 => self.show_history(Some(10), None)?,
                3 => self.show_stats()?,
                4 => self.interactive_variant()?,
                5 => self.interactive_text()?,
                6 => self.interactive_config()?,
                7 => self.interactive_git()?,
                8 => break,
                _ => unreachable!(),
            }
            
            println!();
        }
        
        Ok(())
    }

    fn interactive_recognize(&mut self) -> Result<()> {
        println!("\n--- 识别图像 ---");
        
        let input: String = Input::new()
            .with_prompt("输入图像路径")
            .interact_text()?;
        
        let input_path = match normalize_path(&PathBuf::from(&input)) {
            Ok(path) => path,
            Err(e) => {
                println!("错误: {}", e);
                return Ok(());
            }
        };
        
        if let Err(e) = validate_file_exists(&input_path) {
            println!("错误: {}", e);
            return Ok(());
        }

        let format_items = vec!["TXT", "PDF", "JSON", "Markdown", "CSV", "HTML"];
        let format_selection = Select::new()
            .with_prompt("选择输出格式")
            .items(&format_items)
            .default(0)
            .interact()?;

        let accuracy_items = vec!["低精度(快速)", "中精度(平衡)", "高精度(准确)"];
        let accuracy_selection = Select::new()
            .with_prompt("选择识别精度")
            .items(&accuracy_items)
            .default(1)
            .interact()?;

        let options = &[
            "转换为简体字",
            "自动添加标点",
            "保存到历史记录",
            "包含置信度信息",
        ];
        let selected_options = MultiSelect::new()
            .with_prompt("选择选项 (空格选择, 回车确认)")
            .items(options)
            .interact()?;

        let simplified = selected_options.contains(&0);
        let punctuate = selected_options.contains(&1);
        let save = selected_options.contains(&2);
        let confidence = selected_options.contains(&3);

        let format = match format_selection {
            0 => CliOutputFormat::Txt,
            1 => CliOutputFormat::Pdf,
            2 => CliOutputFormat::Json,
            3 => CliOutputFormat::Markdown,
            4 => CliOutputFormat::Csv,
            5 => CliOutputFormat::Html,
            _ => CliOutputFormat::Txt,
        };

        let accuracy = match accuracy_selection {
            0 => CliAccuracy::Low,
            1 => CliAccuracy::Medium,
            2 => CliAccuracy::High,
            _ => CliAccuracy::Medium,
        };

        self.recognize(&input_path, &None, &format, &accuracy, &false, &simplified, &punctuate, &save, &false, &confidence, &None, &None)?;
        
        Ok(())
    }

    fn interactive_batch(&mut self) -> Result<()> {
        println!("\n--- 批量识别 ---");
        
        let input_dir: String = Input::new()
            .with_prompt("输入图像目录")
            .interact_text()?;
        
        let output_dir: String = Input::new()
            .with_prompt("输出目录 (留空使用默认)")
            .allow_empty(true)
            .interact_text()?;

        let format_items = vec!["TXT", "PDF", "JSON", "Markdown", "CSV", "HTML"];
        let format_selection = Select::new()
            .with_prompt("选择输出格式")
            .items(&format_items)
            .default(0)
            .interact()?;

        let format = match format_selection {
            0 => CliOutputFormat::Txt,
            1 => CliOutputFormat::Pdf,
            2 => CliOutputFormat::Json,
            3 => CliOutputFormat::Markdown,
            4 => CliOutputFormat::Csv,
            5 => CliOutputFormat::Html,
            _ => CliOutputFormat::Txt,
        };

        let output_path = if output_dir.is_empty() {
            None
        } else {
            Some(PathBuf::from(output_dir))
        };

        self.batch_recognize(&PathBuf::from(input_dir), &output_path, &format, &false)?;
        
        Ok(())
    }

    fn interactive_variant(&mut self) -> Result<()> {
        let items = vec![
            "查看异体字对照表",
            "转换文件中的异体字",
            "返回",
        ];
        
        let selection = Select::new()
            .with_prompt("异体字转换")
            .items(&items)
            .default(0)
            .interact()?;
        
        match selection {
            0 => self.show_variant_list()?,
            1 => {
                let input: String = Input::new()
                    .with_prompt("输入文件路径")
                    .interact_text()?;
                
                let output: String = Input::new()
                    .with_prompt("输出文件路径 (留空覆盖原文件)")
                    .allow_empty(true)
                    .interact_text()?;
                
                let simplified = Confirm::new()
                    .with_prompt("同时转换为简体字?")
                    .default(false)
                    .interact()?;
                
                let output_path = if output.is_empty() {
                    None
                } else {
                    Some(PathBuf::from(output))
                };
                
                self.handle_variant(&VariantAction::Convert {
                    input: PathBuf::from(input),
                    output: output_path,
                    simplified,
                })?;
            }
            2 => return Ok(()),
            _ => unreachable!(),
        }
        
        Ok(())
    }

    fn interactive_text(&mut self) -> Result<()> {
        let items = vec![
            "添加标点符号",
            "查找替换",
            "字符统计",
            "返回",
        ];
        
        let selection = Select::new()
            .with_prompt("文本处理")
            .items(&items)
            .default(0)
            .interact()?;
        
        match selection {
            0 => {
                let input: String = Input::new()
                    .with_prompt("输入文件路径")
                    .interact_text()?;
                
                let output: String = Input::new()
                    .with_prompt("输出文件路径 (留空覆盖原文件)")
                    .allow_empty(true)
                    .interact_text()?;
                
                let output_path = if output.is_empty() {
                    None
                } else {
                    Some(PathBuf::from(output))
                };
                
                self.handle_text(&TextAction::Punctuate {
                    input: PathBuf::from(input),
                    output: output_path,
                })?;
            }
            1 => {
                let input: String = Input::new()
                    .with_prompt("输入文件路径")
                    .interact_text()?;
                
                let find: String = Input::new()
                    .with_prompt("查找文本")
                    .interact_text()?;
                
                let replace: String = Input::new()
                    .with_prompt("替换为")
                    .interact_text()?;
                
                let output: String = Input::new()
                    .with_prompt("输出文件路径 (留空覆盖原文件)")
                    .allow_empty(true)
                    .interact_text()?;
                
                let output_path = if output.is_empty() {
                    None
                } else {
                    Some(PathBuf::from(output))
                };
                
                self.handle_text(&TextAction::Replace {
                    input: PathBuf::from(input),
                    output: output_path,
                    find,
                    replace,
                })?;
            }
            2 => {
                let input: String = Input::new()
                    .with_prompt("输入文件路径")
                    .interact_text()?;
                
                self.handle_text(&TextAction::Stats {
                    input: PathBuf::from(input),
                })?;
            }
            3 => return Ok(()),
            _ => unreachable!(),
        }
        
        Ok(())
    }

    fn interactive_config(&mut self) -> Result<()> {
        loop {
            let items = vec![
                "查看配置",
                "设置默认输出格式",
                "设置默认识别精度",
                "重置配置",
                "返回",
            ];
            
            let selection = Select::new()
                .with_prompt("配置管理")
                .items(&items)
                .default(0)
                .interact()?;
            
            match selection {
                0 => self.handle_config(&ConfigAction::Show)?,
                1 => {
                    let format_items = vec!["TXT", "PDF", "JSON", "Markdown", "CSV", "HTML"];
                    let selection = Select::new()
                        .with_prompt("选择默认输出格式")
                        .items(&format_items)
                        .default(0)
                        .interact()?;
                    
                    let format = match selection {
                        0 => CliOutputFormat::Txt,
                        1 => CliOutputFormat::Pdf,
                        2 => CliOutputFormat::Json,
                        3 => CliOutputFormat::Markdown,
                        4 => CliOutputFormat::Csv,
                        5 => CliOutputFormat::Html,
                        _ => CliOutputFormat::Txt,
                    };
                    
                    self.handle_config(&ConfigAction::SetFormat { format })?;
                }
                2 => {
                    let accuracy_items = vec!["低精度", "中精度", "高精度"];
                    let selection = Select::new()
                        .with_prompt("选择默认识别精度")
                        .items(&accuracy_items)
                        .default(1)
                        .interact()?;
                    
                    let accuracy = match selection {
                        0 => CliAccuracy::Low,
                        1 => CliAccuracy::Medium,
                        2 => CliAccuracy::High,
                        _ => CliAccuracy::Medium,
                    };
                    
                    self.handle_config(&ConfigAction::SetAccuracy { accuracy })?;
                }
                3 => self.handle_config(&ConfigAction::Reset)?,
                4 => break,
                _ => unreachable!(),
            }
        }
        Ok(())
    }

    fn interactive_git(&mut self) -> Result<()> {
        loop {
            let items = vec![
                "初始化Git仓库",
                "查看备份历史",
                "启用Git备份",
                "禁用Git备份",
                "返回",
            ];
            
            let selection = Select::new()
                .with_prompt("Git备份管理")
                .items(&items)
                .default(0)
                .interact()?;
            
            match selection {
                0 => self.handle_git(&GitAction::Init { path: None })?,
                1 => self.handle_git(&GitAction::History)?,
                2 => self.handle_git(&GitAction::Enable)?,
                3 => self.handle_git(&GitAction::Disable)?,
                4 => break,
                _ => unreachable!(),
            }
        }
        Ok(())
    }

    fn show_history(&self, limit: Option<usize>, search: Option<&str>) -> Result<()> {
        let records = if let Some(query) = search {
            self.db.search_records(query)?
        } else {
            self.db.get_all_records()?
        };

        let records = if let Some(l) = limit {
            records.into_iter().take(l).collect::<Vec<_>>()
        } else {
            records
        };

        if records.is_empty() {
            println!("暂无识别记录");
            return Ok(());
        }

        println!("\n=== 识别历史记录 ===");
        for (i, record) in records.iter().enumerate() {
            println!("\n[{}] {}", i + 1, record.created_at);
            println!("  文件: {}", record.file_path);
            println!("  字符数: {}", record.character_count);
            println!("  处理时间: {} ms", record.processing_time_ms);
            if self.cli.verbose {
                println!("  内容: {}", record.result_text);
            }
        }

        Ok(())
    }

    fn show_stats(&self) -> Result<()> {
        let stats = self.db.get_statistics()?;

        println!("\n=== 识别统计 ===");
        println!("总记录数: {}", stats.total_records);
        println!("总字符数: {}", stats.total_characters);
        println!("平均处理时间: {:.2} ms", stats.avg_processing_time_ms);

        Ok(())
    }

    fn handle_config(&mut self, action: &ConfigAction) -> Result<()> {
        match action {
            ConfigAction::Show => {
                println!("\n=== 当前配置 ===");
                println!("预处理:");
                println!("  降噪强度: {}", self.config.preprocess.denoise_strength);
                println!("  二值化阈值: {}", self.config.preprocess.threshold_level);
                println!("  字符最小尺寸: {}", self.config.preprocess.segment_min_size);
                println!("OCR:");
                println!("  支持异体字: {}", self.config.ocr.support_variants);
                println!("  支持古体字: {}", self.config.ocr.support_ancient);
                println!("输出:");
                println!("  默认格式: {:?}", self.config.default_output_format);
                println!("Git备份:");
                println!("  启用: {}", self.config.git_backup_enabled);
                if let Some(path) = &self.config.git_repository_path {
                    println!("  仓库路径: {}", path);
                }
            }
            ConfigAction::Reset => {
                if Confirm::new()
                    .with_prompt("确定要重置为默认配置吗?")
                    .default(false)
                    .interact()?
                {
                    self.config = AppConfig::default();
                    self.db.save_config(&self.config)?;
                    println!("配置已重置");
                }
            }
            ConfigAction::SetFormat { format } => {
                self.config.default_output_format = match format {
                    CliOutputFormat::Txt => OutputFormat::Txt,
                    CliOutputFormat::Pdf => OutputFormat::Pdf,
                    CliOutputFormat::Json => OutputFormat::Json,
                    CliOutputFormat::Markdown => OutputFormat::Markdown,
                    CliOutputFormat::Csv => OutputFormat::Csv,
                    CliOutputFormat::Html => OutputFormat::Html,
                };
                self.db.save_config(&self.config)?;
                println!("默认输出格式已设置");
            }
            ConfigAction::SetAccuracy { accuracy } => {
                self.config.ocr.accuracy = match accuracy {
                    CliAccuracy::Low => AccuracyLevel::Low,
                    CliAccuracy::Medium => AccuracyLevel::Medium,
                    CliAccuracy::High => AccuracyLevel::High,
                };
                self.db.save_config(&self.config)?;
                println!("默认识别精度已设置");
            }
        }
        Ok(())
    }

    fn handle_git(&mut self, action: &GitAction) -> Result<()> {
        match action {
            GitAction::Init { path } => {
                let repo_path = if let Some(p) = path {
                    p.clone()
                } else {
                    let input: String = Input::new()
                        .with_prompt("输入Git仓库路径")
                        .default("./abt-backup".to_string())
                        .interact_text()?;
                    PathBuf::from(input)
                };
                
                let backup = GitBackup::new(&repo_path.to_string_lossy())?;
                backup.init_repo()?;
                
                self.config.git_backup_enabled = true;
                self.config.git_repository_path = Some(repo_path.to_string_lossy().to_string());
                self.db.save_config(&self.config)?;
                
                println!("Git仓库已初始化: {}", repo_path.display());
            }
            GitAction::History => {
                if let Some(repo_path) = &self.config.git_repository_path {
                    let backup = GitBackup::new(repo_path)?;
                    let history = backup.get_history()?;
                    
                    if history.is_empty() {
                        println!("暂无备份历史");
                    } else {
                        println!("\n=== 备份历史 ===");
                        for entry in history {
                            println!("  {}", entry);
                        }
                    }
                } else {
                    println!("Git备份未启用，请先初始化仓库");
                }
            }
            GitAction::Enable => {
                if self.config.git_repository_path.is_some() {
                    self.config.git_backup_enabled = true;
                    self.db.save_config(&self.config)?;
                    println!("Git备份已启用");
                } else {
                    println!("请先初始化Git仓库");
                }
            }
            GitAction::Disable => {
                self.config.git_backup_enabled = false;
                self.db.save_config(&self.config)?;
                println!("Git备份已禁用");
            }
        }
        Ok(())
    }

    fn handle_variant(&mut self, action: &VariantAction) -> Result<()> {
        match action {
            VariantAction::List => {
                self.show_variant_list()?;
            }
            VariantAction::Convert { input, output, simplified } => {
                let input_path = normalize_path(input)?;
                validate_file_exists(&input_path)?;
                
                let text = std::fs::read_to_string(&input_path)?;
                let converter = crate::char_converter::CharConverter::new();
                
                let mut result = converter.convert_to_standard(&text);
                if *simplified {
                    result = converter.convert_to_simplified(&result);
                }
                
                let output_path = output.clone().unwrap_or_else(|| input_path.clone());
                std::fs::write(&output_path, result)?;
                
                println!("转换完成: {}", output_path.display());
            }
        }
        Ok(())
    }

    fn show_variant_list(&self) -> Result<()> {
        let converter = crate::char_converter::CharConverter::new();
        let mappings = converter.get_all_mappings();
        
        println!("\n=== 异体字对照表 ===");
        for (variant, standard, simplified) in mappings {
            print!("  {} → {}", variant, standard);
            if let Some(simp) = simplified {
                print!(" ({})", simp);
            }
            println!();
        }
        
        Ok(())
    }

    fn handle_text(&mut self, action: &TextAction) -> Result<()> {
        match action {
            TextAction::Punctuate { input, output } => {
                let input_path = normalize_path(input)?;
                validate_file_exists(&input_path)?;
                
                let text = std::fs::read_to_string(&input_path)?;
                let punctuator = crate::char_converter::SentencePunctuator::new();
                let result = punctuator.punctuate(&text);
                
                let output_path = output.clone().unwrap_or_else(|| input_path.clone());
                std::fs::write(&output_path, result)?;
                
                println!("标点添加完成: {}", output_path.display());
            }
            TextAction::Replace { input, output, find, replace } => {
                let input_path = normalize_path(input)?;
                validate_file_exists(&input_path)?;
                
                let text = std::fs::read_to_string(&input_path)?;
                let result = text.replace(find, replace);
                
                let output_path = output.clone().unwrap_or_else(|| input_path.clone());
                std::fs::write(&output_path, result)?;
                
                println!("查找替换完成: {}", output_path.display());
            }
            TextAction::Stats { input } => {
                let input_path = normalize_path(input)?;
                validate_file_exists(&input_path)?;
                
                let text = std::fs::read_to_string(&input_path)?;
                let chars: Vec<char> = text.chars().collect();
                let unique_chars: std::collections::HashSet<_> = chars.iter().collect();
                
                println!("\n=== 字符统计 ===");
                println!("文件: {}", input_path.display());
                println!("总字符数: {}", chars.len());
                println!("不重复字符数: {}", unique_chars.len());
                println!("行数: {}", text.lines().count());
                println!("空白字符数: {}", chars.iter().filter(|c| c.is_whitespace()).count());
            }
        }
        Ok(())
    }

    fn generate_completions(&self, shell: clap_complete::Shell) -> Result<()> {
        let mut cmd = Cli::command();
        let name = cmd.get_name().to_string();
        clap_complete::generate(shell, &mut cmd, name, &mut std::io::stdout());
        Ok(())
    }

    fn handle_model(&mut self, action: &ModelAction) -> Result<()> {
        let model_manager = crate::model_manager::ModelManager::new(None)?;
        
        match action {
            ModelAction::List => {
                let available_models = model_manager.get_available_models();
                println!("\n=== 可用模型列表 ===");
                for model in &available_models {
                    println!("\n名称: {}", model.name);
                    println!("  版本: {}", model.version);
                    println!("  描述: {}", model.description);
                    println!("  大小: {:.2} MB", model.size_bytes as f64 / 1024.0 / 1024.0);
                    println!("  支持: {}", model.supported_chars.join(", "));
                    println!("  发布日期: {}", model.release_date);
                }
                println!("\n共 {} 个可用模型", available_models.len());
            }
            
            ModelAction::Installed => {
                let installed_models = model_manager.get_installed_models();
                if installed_models.is_empty() {
                    println!("\n暂无已安装的模型");
                } else {
                    println!("\n=== 已安装模型 ===");
                    for model in installed_models {
                        print!("  {} v{}", model.name, model.version);
                        if model.is_active {
                            println!(" [激活]");
                        } else {
                            println!();
                        }
                    }
                }
            }
            
            ModelAction::Install { name } => {
                println!("\n正在安装模型: {}", name);
                model_manager.install_model(name)?;
            }
            
            ModelAction::Uninstall { name } => {
                if Confirm::new()
                    .with_prompt(format!("确定要卸载模型 {} 吗?", name))
                    .default(false)
                    .interact()?
                {
                    model_manager.uninstall_model(name)?;
                }
            }
            
            ModelAction::Activate { name } => {
                model_manager.activate_model(name)?;
                println!("模型 {} 已激活", name);
            }
            
            ModelAction::Update { name } => {
                println!("\n正在更新模型: {}", name);
                model_manager.incremental_update(name)?;
            }
            
            ModelAction::Check => {
                let updates = model_manager.check_for_updates();
                if updates.is_empty() {
                    println!("\n所有模型都是最新版本");
                } else {
                    println!("\n=== 有更新的模型 ===");
                    for (name, installed, latest) in updates {
                        println!("  {}: {} → {}", name, installed, latest);
                    }
                }
            }
        }
        
        Ok(())
    }

    fn handle_log(&mut self, action: &LogAction) -> Result<()> {
        let mut logger = crate::recognition_log::RecognitionLogger::new(None)?;
        
        match action {
            LogAction::List { limit } => {
                let logs = logger.get_logs(*limit);
                if logs.is_empty() {
                    println!("\n暂无识别日志");
                } else {
                    println!("\n=== 识别日志 ({}) ===", logs.len());
                    for (i, log) in logs.iter().enumerate() {
                        println!("\n[{}] {} (置信度: {:.1}%)", 
                            i + 1, log.id, log.confidence * 100.0);
                        println!("  文件: {}", log.image_path);
                        println!("  时间: {}", log.timestamp);
                        println!("  字符数: {}", log.character_logs.len());
                        if log.is_corrected {
                            println!("  [已校正]");
                        }
                    }
                }
            }
            
            LogAction::Errors { limit } => {
                let logs = logger.get_error_logs(None);
                let logs = if let Some(l) = limit {
                    logs.into_iter().take(*l).collect::<Vec<_>>()
                } else {
                    logs
                };
                
                if logs.is_empty() {
                    println!("\n暂无错误日志");
                } else {
                    println!("\n=== 错误日志 ({}) ===", logs.len());
                    for log in logs {
                        println!("\nID: {}", log.id);
                        println!("  文件: {}", log.image_path);
                        println!("  置信度: {:.1}%", log.confidence * 100.0);
                        if let Some(error_type) = &log.error_type {
                            println!("  错误类型: {:?}", error_type);
                        }
                    }
                }
            }
            
            LogAction::Stats => {
                let stats = logger.get_statistics();
                println!("\n=== 识别日志统计 ===");
                println!("  总识别次数: {}", stats.total_recognitions);
                println!("  已校正次数: {}", stats.total_corrections);
                println!("  平均置信度: {:.1}%", stats.average_confidence * 100.0);
                if !stats.error_distribution.is_empty() {
                    println!("  错误分布:");
                    for (error_type, count) in &stats.error_distribution {
                        println!("    {}: {}", error_type, count);
                    }
                }
                if !stats.most_misrecognized_chars.is_empty() {
                    println!("  最常识别错误字符:");
                    for (c, count) in &stats.most_misrecognized_chars {
                        println!("    {}: {} 次", c, count);
                    }
                }
            }
            
            LogAction::Export { output, format } => {
                let output_path = normalize_path(output)?;
                logger.export_logs(&output_path, format)?;
                println!("\n日志已导出到: {}", output_path.display());
            }
            
            LogAction::Clean { days } => {
                let removed = logger.clear_old_logs(*days)?;
                println!("\n已清理 {} 条旧日志", removed);
            }
            
            LogAction::ExportTraining { output } => {
                let output_path = normalize_path(output)?;
                logger.export_training_data(&output_path)?;
            }
        }
        
        Ok(())
    }
}
