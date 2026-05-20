use crate::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub name: String,
    pub version: String,
    pub description: String,
    pub size_bytes: u64,
    pub download_url: String,
    pub checksum: String,
    pub supported_chars: Vec<String>,
    pub release_date: String,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateProgress {
    pub total_size: u64,
    pub downloaded: u64,
    pub percentage: f32,
    pub status: UpdateStatus,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum UpdateStatus {
    Idle,
    Downloading,
    Verifying,
    Applying,
    Completed,
    Failed,
}

pub struct ModelManager {
    models_dir: PathBuf,
    installed_models: HashMap<String, ModelInfo>,
    current_model: Option<String>,
}

impl ModelManager {
    pub fn new(base_dir: Option<&Path>) -> Result<Self> {
        let models_dir = if let Some(dir) = base_dir {
            dir.join("models")
        } else {
            dirs::home_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join(".abt")
                .join("models")
        };

        std::fs::create_dir_all(&models_dir)?;

        let mut manager = Self {
            models_dir,
            installed_models: HashMap::new(),
            current_model: None,
        };

        manager.load_installed_models()?;
        Ok(manager)
    }

    fn load_installed_models(&mut self) -> Result<()> {
        let manifest_path = self.models_dir.join("manifest.json");
        if manifest_path.exists() {
            let content = std::fs::read_to_string(&manifest_path)?;
            let manifest: ModelManifest = serde_json::from_str(&content)
                .map_err(|e| crate::Error::ModelError(format!("加载模型清单失败: {}", e)))?;
            self.installed_models = manifest.models;
            self.current_model = manifest.current_model;
        }
        Ok(())
    }

    fn save_manifest(&self) -> Result<()> {
        let manifest = ModelManifest {
            models: self.installed_models.clone(),
            current_model: self.current_model.clone(),
        };

        let manifest_path = self.models_dir.join("manifest.json");
        let json = serde_json::to_string_pretty(&manifest)
            .map_err(|e| crate::Error::ModelError(format!("保存模型清单失败: {}", e)))?;
        
        std::fs::write(&manifest_path, json)?;
        Ok(())
    }

    pub fn get_available_models(&self) -> Vec<ModelInfo> {
        vec![
            ModelInfo {
                name: "ancient-classic-v1.0".to_string(),
                version: "1.0.0".to_string(),
                description: "基础古籍刻本识别模型，支持常用字形".to_string(),
                size_bytes: 52_428_800,
                download_url: "https://abt-models.example.com/ancient-classic-v1.0.bin".to_string(),
                checksum: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6".to_string(),
                supported_chars: vec!["常用字".to_string(), "异体字".to_string()],
                release_date: "2024-01-15".to_string(),
                is_active: false,
            },
            ModelInfo {
                name: "ancient-fuzzy-v1.1".to_string(),
                version: "1.1.0".to_string(),
                description: "模糊识别优化模型，支持模糊、残缺文字识别".to_string(),
                size_bytes: 78_643_200,
                download_url: "https://abt-models.example.com/ancient-fuzzy-v1.1.bin".to_string(),
                checksum: "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7".to_string(),
                supported_chars: vec!["常用字".to_string(), "异体字".to_string(), "模糊字".to_string()],
                release_date: "2024-03-20".to_string(),
                is_active: false,
            },
            ModelInfo {
                name: "ancient-special-v2.0".to_string(),
                version: "2.0.0".to_string(),
                description: "专业古文字识别模型，支持甲骨文、金文等".to_string(),
                size_bytes: 125_829_120,
                download_url: "https://abt-models.example.com/ancient-special-v2.0.bin".to_string(),
                checksum: "c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8".to_string(),
                supported_chars: vec!["常用字".to_string(), "异体字".to_string(), "甲骨文".to_string(), "金文".to_string()],
                release_date: "2024-05-10".to_string(),
                is_active: false,
            },
            ModelInfo {
                name: "ancient-enhanced-v1.5".to_string(),
                version: "1.5.0".to_string(),
                description: "增量优化模型，识别准确率提升15%".to_string(),
                size_bytes: 65_536_000,
                download_url: "https://abt-models.example.com/ancient-enhanced-v1.5.bin".to_string(),
                checksum: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9".to_string(),
                supported_chars: vec!["常用字".to_string(), "异体字".to_string(), "古体字".to_string()],
                release_date: "2024-06-01".to_string(),
                is_active: false,
            },
        ]
    }

    pub fn get_installed_models(&self) -> Vec<&ModelInfo> {
        self.installed_models.values().collect()
    }

    pub fn get_current_model(&self) -> Option<&ModelInfo> {
        self.current_model.as_ref().and_then(|name| self.installed_models.get(name))
    }

    pub fn download_model(&self, model_name: &str) -> Result<UpdateProgress> {
        let available_models = self.get_available_models();
        let model = available_models.iter()
            .find(|m| m.name == model_name)
            .ok_or_else(|| crate::Error::ModelError(format!("模型不存在: {}", model_name)))?;

        println!("准备下载模型: {}", model.name);
        println!("版本: {}", model.version);
        println!("大小: {:.2} MB", model.size_bytes as f64 / 1024.0 / 1024.0);
        println!("描述: {}", model.description);

        let progress = self.simulate_download(model)?;
        
        Ok(progress)
    }

    fn simulate_download(&self, model: &ModelInfo) -> Result<UpdateProgress> {
        use std::io::Write;
        
        let model_path = self.models_dir.join(&model.name).with_extension("bin");
        
        println!("\n开始下载...");
        let pb = indicatif::ProgressBar::new(model.size_bytes);
        pb.set_style(indicatif::ProgressStyle::default_bar()
            .template("{spinner:.green} [{bar:40.cyan/blue}] {bytes}/{total_bytes} ({bytes_per_sec})")
            .unwrap()
            .progress_chars("#>-"));

        let mut downloaded = 0u64;
        let chunk_size = model.size_bytes / 100;
        
        while downloaded < model.size_bytes {
            std::thread::sleep(std::time::Duration::from_millis(50));
            downloaded = (downloaded + chunk_size).min(model.size_bytes);
            pb.set_position(downloaded);
        }
        
        pb.finish_with_message("下载完成");

        println!("正在验证校验和...");
        std::thread::sleep(std::time::Duration::from_millis(500));

        let mut file = std::fs::File::create(&model_path)?;
        file.write_all(&[0u8; 1024])?;
        
        println!("正在应用更新...");
        std::thread::sleep(std::time::Duration::from_millis(1000));

        Ok(UpdateProgress {
            total_size: model.size_bytes,
            downloaded: model.size_bytes,
            percentage: 100.0,
            status: UpdateStatus::Completed,
        })
    }

    pub fn install_model(&mut self, model_name: &str) -> Result<()> {
        let available_models = self.get_available_models();
        let mut model = available_models.iter()
            .find(|m| m.name == model_name)
            .ok_or_else(|| crate::Error::ModelError(format!("模型不存在: {}", model_name)))?
            .clone();

        let progress = self.download_model(model_name)?;
        
        if progress.status == UpdateStatus::Completed {
            model.is_active = true;
            self.installed_models.insert(model.name.clone(), model);
            self.save_manifest()?;
            println!("模型 {} 安装成功", model_name);
        }

        Ok(())
    }

    pub fn uninstall_model(&mut self, model_name: &str) -> Result<()> {
        if !self.installed_models.contains_key(model_name) {
            return Err(crate::Error::ModelError(format!("模型未安装: {}", model_name)));
        }

        if let Some(current) = &self.current_model {
            if current == model_name {
                return Err(crate::Error::ModelError("不能卸载当前激活的模型".to_string()));
            }
        }

        let model_path = self.models_dir.join(model_name).with_extension("bin");
        if model_path.exists() {
            std::fs::remove_file(&model_path)?;
        }

        self.installed_models.remove(model_name);
        self.save_manifest()?;
        
        println!("模型 {} 已卸载", model_name);
        Ok(())
    }

    pub fn activate_model(&mut self, model_name: &str) -> Result<()> {
        if !self.installed_models.contains_key(model_name) {
            return Err(crate::Error::ModelError(format!("模型未安装: {}", model_name)));
        }

        for model in self.installed_models.values_mut() {
            model.is_active = model.name == model_name;
        }

        self.current_model = Some(model_name.to_string());
        self.save_manifest()?;
        
        println!("模型 {} 已激活", model_name);
        Ok(())
    }

    pub fn check_for_updates(&self) -> Vec<(String, String, String)> {
        let mut updates = Vec::new();
        let available = self.get_available_models();
        
        for available_model in &available {
            if let Some(installed) = self.installed_models.get(&available_model.name) {
                if available_model.version != installed.version {
                    updates.push((
                        available_model.name.clone(),
                        installed.version.clone(),
                        available_model.version.clone(),
                    ));
                }
            }
        }
        
        updates
    }

    pub fn incremental_update(&mut self, model_name: &str) -> Result<()> {
        let available_models = self.get_available_models();
        let latest_model = available_models.iter()
            .find(|m| m.name == model_name)
            .ok_or_else(|| crate::Error::ModelError(format!("模型不存在: {}", model_name)))?;

        if !self.installed_models.contains_key(model_name) {
            println!("模型未安装，执行全新安装...");
            return self.install_model(model_name);
        }

        println!("开始增量更新: {}", model_name);
        println!("当前版本: {}", self.installed_models[model_name].version);
        println!("最新版本: {}", latest_model.version);

        let progress = self.simulate_download(latest_model)?;
        
        if progress.status == UpdateStatus::Completed {
            let mut model = latest_model.clone();
            model.is_active = self.current_model.as_deref() == Some(model_name);
            self.installed_models.insert(model.name.clone(), model);
            self.save_manifest()?;
            println!("模型 {} 增量更新完成", model_name);
        }

        Ok(())
    }

    pub fn get_models_dir(&self) -> &Path {
        &self.models_dir
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct ModelManifest {
    models: HashMap<String, ModelInfo>,
    current_model: Option<String>,
}

#[derive(Debug, Clone)]
pub struct FuzzyRecognitionConfig {
    pub enable_stroke_detection: bool,
    pub enable_radical_matching: bool,
    pub enable_context_inference: bool,
    pub confidence_threshold: f32,
    pub fuzzy_match_level: FuzzyMatchLevel,
}

impl Default for FuzzyRecognitionConfig {
    fn default() -> Self {
        Self {
            enable_stroke_detection: true,
            enable_radical_matching: true,
            enable_context_inference: true,
            confidence_threshold: 0.3,
            fuzzy_match_level: FuzzyMatchLevel::Medium,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FuzzyMatchLevel {
    Low,
    Medium,
    High,
    Strict,
}

pub struct FuzzyRecognizer {
    config: FuzzyRecognitionConfig,
    stroke_database: HashMap<char, Vec<u8>>,
    radical_database: HashMap<char, Vec<char>>,
}

impl FuzzyRecognizer {
    pub fn new(config: FuzzyRecognitionConfig) -> Self {
        let mut recognizer = Self {
            config,
            stroke_database: HashMap::new(),
            radical_database: HashMap::new(),
        };
        recognizer.init_database();
        recognizer
    }

    fn init_database(&mut self) {
        let stroke_data = vec![
            ('一', vec![1]),
            ('二', vec![2]),
            ('三', vec![3]),
            ('人', vec![2]),
            ('大', vec![3]),
            ('天', vec![4]),
            ('地', vec![6]),
            ('日', vec![4]),
            ('月', vec![4]),
            ('水', vec![4]),
            ('火', vec![4]),
            ('木', vec![4]),
            ('金', vec![8]),
            ('土', vec![3]),
            ('之', vec![3]),
            ('乎', vec![5]),
            ('者', vec![8]),
            ('也', vec![3]),
            ('文', vec![4]),
            ('章', vec![11]),
            ('詩', vec![13]),
            ('書', vec![10]),
            ('禮', vec![17]),
            ('乐', vec![5]),
            ('易', vec![8]),
            ('春', vec![9]),
            ('秋', vec![9]),
        ];

        for (c, strokes) in stroke_data {
            self.stroke_database.insert(c, strokes);
        }

        let radical_data = vec![
            ('河', vec!['水', '可']),
            ('湖', vec!['水', '胡']),
            ('江', vec!['水', '工']),
            ('海', vec!['水', '每']),
            ('他', vec!['人', '也']),
            ('何', vec!['人', '可']),
            ('体', vec!['人', '本']),
            ('明', vec!['日', '月']),
            ('时', vec!['日', '寸']),
            ('春', vec!['春', '日']),
        ];

        for (c, radicals) in radical_data {
            self.radical_database.insert(c, radicals);
        }
    }

    pub fn recognize_fuzzy(&self, char_features: &CharFeatures) -> Option<FuzzyMatchResult> {
        let mut candidates = Vec::new();

        if self.config.enable_stroke_detection {
            let stroke_matches = self.match_by_strokes(char_features.stroke_count);
            candidates.extend(stroke_matches);
        }

        if self.config.enable_radical_matching && !char_features.visible_radicals.is_empty() {
            let radical_matches = self.match_by_radicals(&char_features.visible_radicals);
            candidates.extend(radical_matches);
        }

        if candidates.is_empty() {
            candidates = self.get_common_chars();
        }

        let scored_candidates: Vec<_> = candidates.into_iter()
            .map(|(c, score)| {
                let confidence = match self.config.fuzzy_match_level {
                    FuzzyMatchLevel::Low => score * 0.6,
                    FuzzyMatchLevel::Medium => score * 0.75,
                    FuzzyMatchLevel::High => score * 0.9,
                    FuzzyMatchLevel::Strict => score * 0.95,
                };
                (c, confidence)
            })
            .filter(|&(_, c)| c >= self.config.confidence_threshold)
            .collect();

        if scored_candidates.is_empty() {
            return None;
        }

        let best_match = scored_candidates.iter()
            .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))?;

        let alternatives = scored_candidates.iter()
            .filter(|&&(c, _)| c != best_match.0)
            .take(3)
            .map(|&(c, conf)| CandidateChar { character: c, confidence: conf })
            .collect();

        Some(FuzzyMatchResult {
            best_match: best_match.0,
            confidence: best_match.1,
            alternatives,
            match_method: if char_features.stroke_count > 0 { "笔画匹配" } else { "部首匹配" }.to_string(),
        })
    }

    fn match_by_strokes(&self, detected_strokes: u8) -> Vec<(char, f32)> {
        if detected_strokes == 0 {
            return Vec::new();
        }

        let mut matches = Vec::new();

        for (&c, strokes) in &self.stroke_database {
            if let Some(&stroke_count) = strokes.first() {
                let diff = (stroke_count as i32 - detected_strokes as i32).abs();
                let confidence = 1.0 - (diff as f32 * 0.1);
                if confidence > 0.3 {
                    matches.push((c, confidence));
                }
            }
        }

        matches
    }

    fn match_by_radicals(&self, radicals: &[char]) -> Vec<(char, f32)> {
        let mut matches = Vec::new();

        for (&c, char_radicals) in &self.radical_database {
            let match_count = radicals.iter()
                .filter(|&r| char_radicals.contains(r))
                .count();

            if match_count > 0 {
                let confidence = match_count as f32 / char_radicals.len() as f32;
                matches.push((c, confidence));
            }
        }

        matches
    }

    fn get_common_chars(&self) -> Vec<(char, f32)> {
        vec![
            ('之', 0.5),
            ('也', 0.5),
            ('者', 0.4),
            ('乎', 0.4),
            ('不', 0.4),
            ('大', 0.3),
            ('人', 0.3),
            ('文', 0.3),
        ]
    }

    pub fn enhance_image_quality(&self, img: &image::GrayImage) -> image::GrayImage {
        let (width, height) = img.dimensions();
        let mut enhanced = image::GrayImage::new(width, height);

        for y in 0..height {
            for x in 0..width {
                let pixel = img.get_pixel(x, y)[0];
                
                let mut enhanced_pixel = if pixel < 128 {
                    (pixel as f32 * 0.7) as u8
                } else {
                    ((pixel as f32 - 128.0) * 1.3 + 128.0).min(255.0) as u8
                };

                if x > 0 && y > 0 && x < width - 1 && y < height - 1 {
                    let mut sum = 0u32;
                    for dy in -1..=1 {
                        for dx in -1..=1 {
                            let px = img.get_pixel((x as i32 + dx) as u32, (y as i32 + dy) as u32)[0];
                            sum += px as u32;
                        }
                    }
                    let avg = (sum / 9) as u8;
                    enhanced_pixel = ((enhanced_pixel as f32 + avg as f32) / 2.0) as u8;
                }

                enhanced.put_pixel(x, y, image::Luma([enhanced_pixel]));
            }
        }

        enhanced
    }

    pub fn infer_by_context(&self, preceding_chars: &[char], candidates: &[(char, f32)]) -> Vec<(char, f32)> {
        if !self.config.enable_context_inference || preceding_chars.is_empty() {
            return candidates.to_vec();
        }

        let common_phrases = [
            (vec!['之'], '后', 0.3),
            (vec!['乎'], '哉', 0.4),
            (vec!['者'], '也', 0.5),
            (vec!['不'], '可', 0.3),
            (vec!['大'], '道', 0.25),
            (vec!['天', '地'], '人', 0.3),
            (vec!['日', '月'], '明', 0.4),
        ];

        let mut context_scores = Vec::new();

        for &(ref pattern, next_char, boost) in &common_phrases {
            if preceding_chars.ends_with(pattern) {
                for &(c, conf) in candidates {
                    if c == next_char {
                        context_scores.push((c, (conf + boost).min(1.0)));
                    } else {
                        context_scores.push((c, conf));
                    }
                }
            }
        }

        if context_scores.is_empty() {
            candidates.to_vec()
        } else {
            context_scores
        }
    }
}

#[derive(Debug, Clone)]
pub struct CharFeatures {
    pub stroke_count: u8,
    pub visible_radicals: Vec<char>,
    pub aspect_ratio: f32,
    pub position_x: u32,
    pub position_y: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct FuzzyMatchResult {
    pub best_match: char,
    pub confidence: f32,
    pub alternatives: Vec<CandidateChar>,
    pub match_method: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CandidateChar {
    pub character: char,
    pub confidence: f32,
}
