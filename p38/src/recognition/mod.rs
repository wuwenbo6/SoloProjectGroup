use crate::preprocessing::ProcessedImage;
use crate::Result;
use image::DynamicImage;
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OcrConfig {
    pub accuracy: AccuracyLevel,
    pub support_variants: bool,
    pub support_ancient: bool,
    pub model_path: Option<String>,
    pub use_cache: bool,
    pub max_threads: usize,
}

#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub enum AccuracyLevel {
    Low,
    Medium,
    High,
}

impl Default for OcrConfig {
    fn default() -> Self {
        Self {
            accuracy: AccuracyLevel::Medium,
            support_variants: true,
            support_ancient: true,
            model_path: None,
            use_cache: true,
            max_threads: num_cpus::get(),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct CharacterRecognition {
    pub character: char,
    pub confidence: f32,
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
    pub is_variant: bool,
    pub variant_of: Option<char>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct OcrResult {
    pub characters: Vec<CharacterRecognition>,
    pub text: String,
    pub processing_time_ms: u64,
    pub total_characters: usize,
}

#[derive(Debug, Clone, Hash, Eq, PartialEq)]
struct FeatureKey {
    width: u32,
    height: u32,
    hash: u64,
}

pub struct OcrEngine {
    config: OcrConfig,
    character_database: Arc<CharacterDatabase>,
    feature_cache: Option<parking_lot::RwLock<HashMap<FeatureKey, char>>>,
}

struct CharacterDatabase {
    common_chars: Vec<char>,
    variant_map: HashMap<char, char>,
    ancient_chars: Vec<char>,
    stroke_counts: HashMap<char, u8>,
    feature_vectors: HashMap<char, Vec<u8>>,
}

impl CharacterDatabase {
    fn new() -> Self {
        let mut db = Self {
            common_chars: Vec::new(),
            variant_map: HashMap::new(),
            ancient_chars: Vec::new(),
            stroke_counts: HashMap::new(),
            feature_vectors: HashMap::new(),
        };
        db.init_common_chars();
        db.init_variant_map();
        db.init_ancient_chars();
        db.init_stroke_counts();
        db.init_feature_vectors();
        db
    }

    fn init_common_chars(&mut self) {
        let common_chars = vec![
            '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
            '天', '地', '人', '日', '月', '水', '火', '木', '金', '土',
            '之', '乎', '者', '也', '而', '其', '以', '为', '于', '是',
            '不', '可', '有', '无', '大', '小', '多', '少', '上', '下',
            '中', '国', '文', '章', '诗', '书', '礼', '乐', '易', '春',
            '秋', '冬', '夏', '风', '雨', '云', '雪', '山', '川', '河',
            '王', '侯', '将', '相', '君', '臣', '父', '子', '夫', '妇',
            '兄', '弟', '师', '友', '仁', '义', '礼', '智', '信', '道',
            '德', '圣', '贤', '忠', '孝', '节', '廉', '耻', '善', '恶',
            '美', '丑', '真', '假', '是', '非', '动', '静', '虚', '实',
        ];
        self.common_chars = common_chars;
    }

    fn init_variant_map(&mut self) {
        let variants = [
            ('𠀀', '一'), ('𠀁', '丁'), ('𠀂', '七'), ('𠀃', '万'), ('𠀄', '丈'),
            ('𠃊', '乙'), ('𠃋', '九'), ('𠃌', '了'), ('𠃍', '予'), ('𠃎', '争'),
            ('𠆢', '人'), ('𠆣', '仁'), ('𠆤', '什'), ('𠆥', '仆'), ('𠆦', '仇'),
            ('𠔥', '土'), ('𠔦', '地'), ('𠔧', '在'), ('𠔨', '圭'), ('𠔩', '坐'),
            ('𡈽', '土'), ('𡈾', '士'), ('𡈿', '壮'), ('𡉀', '声'), ('𡉁', '壳'),
            ('𢁉', '心'), ('𢁊', '必'), ('𢁋', '志'), ('𢁌', '忘'), ('𢁍', '忙'),
        ];
        
        for &(variant, standard) in &variants {
            self.variant_map.insert(variant, standard);
        }
    }

    fn init_ancient_chars(&mut self) {
        let ancient = vec![
            '𡘙', '𡚾', '𡛁', '𢀖', '𢀗', '𢀘', '𢀙', '𢀚', '𢀛', '𢀜',
        ];
        self.ancient_chars = ancient;
    }

    fn init_stroke_counts(&mut self) {
        let stroke_data = [
            ('一', 1), ('二', 2), ('三', 3), ('四', 5), ('五', 4),
            ('六', 4), ('七', 2), ('八', 2), ('九', 2), ('十', 2),
            ('天', 4), ('地', 6), ('人', 2), ('日', 4), ('月', 4),
            ('水', 4), ('火', 4), ('木', 4), ('金', 8), ('土', 3),
            ('之', 3), ('乎', 5), ('者', 8), ('也', 3), ('而', 6),
        ];
        for &(c, count) in &stroke_data {
            self.stroke_counts.insert(c, count);
        }
    }

    fn init_feature_vectors(&mut self) {
        for &c in &self.common_chars {
            let features = self.generate_feature_vector(c);
            self.feature_vectors.insert(c, features);
        }
    }

    fn generate_feature_vector(&self, c: char) -> Vec<u8> {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        c.hash(&mut hasher);
        let hash = hasher.finish();
        
        let mut features = vec![0u8; 25];
        for (i, f) in features.iter_mut().enumerate() {
            *f = ((hash >> (i * 2)) & 0xFF) as u8;
        }
        features
    }
}

impl OcrEngine {
    pub fn new(config: OcrConfig) -> Result<Self> {
        let character_database = Arc::new(CharacterDatabase::new());
        let feature_cache = if config.use_cache {
            Some(parking_lot::RwLock::new(HashMap::new()))
        } else {
            None
        };

        Ok(Self {
            config,
            character_database,
            feature_cache,
        })
    }

    pub fn recognize(&self, processed: &ProcessedImage) -> Result<OcrResult> {
        let start = std::time::Instant::now();
        let mut characters = Vec::with_capacity(processed.segments.len());

        let segments = &processed.segments;
        
        if self.config.max_threads > 1 && segments.len() > 10 {
            let results = self.parallel_recognize(processed, segments)?;
            characters.extend(results);
        } else {
            for &(x, y, w, h) in segments {
                if let Some(chr) = self.recognize_single_character(&processed.processed, x, y, w, h) {
                    let confidence = self.calculate_confidence(chr, x, y, w, h);
                    let (is_variant, variant_of) = self.check_variant(chr);
                    
                    characters.push(CharacterRecognition {
                        character: chr,
                        confidence,
                        x,
                        y,
                        width: w,
                        height: h,
                        is_variant,
                        variant_of,
                    });
                }
            }
        }

        characters.sort_by(|a, b| {
            let y_threshold = (a.height.max(b.height) as f32 * 0.3) as u32;
            if (a.y as i32 - b.y as i32).abs() <= y_threshold as i32 {
                a.x.cmp(&b.x)
            } else {
                a.y.cmp(&b.y)
            }
        });

        let text: String = characters.iter()
            .map(|c| c.variant_of.unwrap_or(c.character))
            .collect();

        let processing_time_ms = start.elapsed().as_millis() as u64;

        Ok(OcrResult {
            characters,
            text,
            processing_time_ms,
            total_characters: text.chars().count(),
        })
    }

    fn parallel_recognize(
        &self,
        processed: &ProcessedImage,
        segments: &[(u32, u32, u32, u32)],
    ) -> Result<Vec<CharacterRecognition>> {
        use std::sync::Arc;
        
        let db = Arc::clone(&self.character_database);
        let config = self.config.clone();
        
        let results: Vec<_> = segments
            .chunks((segments.len() + self.config.max_threads - 1) / self.config.max_threads)
            .map(|chunk| {
                let db = Arc::clone(&db);
                let config = config.clone();
                let img = processed.processed.clone();
                
                std::thread::spawn(move || {
                    let mut results = Vec::new();
                    for &(x, y, w, h) in chunk {
                        if let Some(chr) = Self::recognize_single_character_static(&img, x, y, w, h, &db) {
                            let confidence = Self::calculate_confidence_static(chr, &config);
                            let (is_variant, variant_of) = db.variant_map.get(&chr).map_or((false, None), |&s| (true, Some(s)));
                            
                            results.push(CharacterRecognition {
                                character: chr,
                                confidence,
                                x,
                                y,
                                width: w,
                                height: h,
                                is_variant,
                                variant_of,
                            });
                        }
                    }
                    results
                })
            })
            .collect::<Vec<_>>()
            .into_iter()
            .filter_map(|h| h.join().ok())
            .flatten()
            .collect();

        Ok(results)
    }

    fn recognize_single_character(
        &self,
        img: &DynamicImage,
        x: u32,
        y: u32,
        w: u32,
        h: u32,
    ) -> Option<char> {
        if let Some(cache) = &self.feature_cache {
            let key = FeatureKey {
                width: w,
                height: h,
                hash: self.calculate_image_hash(img, x, y, w, h),
            };
            
            let cache_read = cache.read();
            if let Some(&cached_char) = cache_read.get(&key) {
                return Some(cached_char);
            }
            drop(cache_read);

            let features = self.extract_features_fast(img, x, y, w, h);
            let chr = self.match_character(&features);

            if let Some(c) = chr {
                let mut cache_write = cache.write();
                cache_write.insert(key, c);
            }

            chr
        } else {
            let features = self.extract_features_fast(img, x, y, w, h);
            self.match_character(&features)
        }
    }

    fn recognize_single_character_static(
        img: &DynamicImage,
        x: u32,
        y: u32,
        w: u32,
        h: u32,
        db: &CharacterDatabase,
    ) -> Option<char> {
        let gray_img = img.to_luma8();
        let features = Self::extract_features_static(&gray_img, x, y, w, h);
        let mut best_match = None;
        let mut best_score = 0.5f32;

        for &c in &db.common_chars {
            if let Some(ref_vec) = db.feature_vectors.get(&c) {
                let score = Self::calculate_similarity_static(&features, ref_vec);
                if score > best_score {
                    best_score = score;
                    best_match = Some(c);
                }
            }
        }

        best_match
    }

    fn extract_features_fast(&self, img: &DynamicImage, x: u32, y: u32, w: u32, h: u32) -> Vec<u8> {
        let gray_img = img.to_luma8();
        let mut features = Vec::with_capacity(25);
        
        let grid_size = 5;
        let cell_w = (w as f32 / grid_size as f32).max(1.0);
        let cell_h = (h as f32 / grid_size as f32).max(1.0);

        for gy in 0..grid_size {
            for gx in 0..grid_size {
                let start_x = (x as f32 + gx as f32 * cell_w) as u32;
                let start_y = (y as f32 + gy as f32 * cell_h) as u32;
                let end_x = (start_x + cell_w as u32).min(gray_img.width());
                let end_y = (start_y + cell_h as u32).min(gray_img.height());

                let mut black_count = 0u32;
                let mut total_count = 0u32;

                for cy in start_y..end_y {
                    for cx in start_x..end_x {
                        if cx < gray_img.width() && cy < gray_img.height() {
                            let pixel = gray_img.get_pixel(cx, cy)[0];
                            if pixel < 128 {
                                black_count += 1;
                            }
                            total_count += 1;
                        }
                    }
                }

                let density = if total_count > 0 {
                    (black_count * 255 / total_count) as u8
                } else {
                    0
                };
                features.push(density);
            }
        }

        features
    }

    fn extract_features_static(img: &image::GrayImage, x: u32, y: u32, w: u32, h: u32) -> Vec<u8> {
        let mut features = Vec::with_capacity(25);
        
        let grid_size = 5;
        let cell_w = (w as f32 / grid_size as f32).max(1.0);
        let cell_h = (h as f32 / grid_size as f32).max(1.0);

        for gy in 0..grid_size {
            for gx in 0..grid_size {
                let start_x = (x as f32 + gx as f32 * cell_w) as u32;
                let start_y = (y as f32 + gy as f32 * cell_h) as u32;
                let end_x = (start_x + cell_w as u32).min(img.width());
                let end_y = (start_y + cell_h as u32).min(img.height());

                let mut black_count = 0u32;
                let mut total_count = 0u32;

                for cy in start_y..end_y {
                    for cx in start_x..end_x {
                        if cx < img.width() && cy < img.height() {
                            let pixel = img.get_pixel(cx, cy)[0];
                            if pixel < 128 {
                                black_count += 1;
                            }
                            total_count += 1;
                        }
                    }
                }

                let density = if total_count > 0 {
                    (black_count * 255 / total_count) as u8
                } else {
                    0
                };
                features.push(density);
            }
        }

        features
    }

    fn match_character(&self, features: &[u8]) -> Option<char> {
        let mut best_match = None;
        let mut best_score = 0.5f32;

        let chars_to_check = match self.config.accuracy {
            AccuracyLevel::Low => &self.character_database.common_chars[0..50],
            AccuracyLevel::Medium => &self.character_database.common_chars[0..100],
            AccuracyLevel::High => &self.character_database.common_chars[..],
        };

        for &c in chars_to_check {
            if let Some(ref_vec) = self.character_database.feature_vectors.get(&c) {
                let score = self.calculate_similarity(features, ref_vec);
                if score > best_score {
                    best_score = score;
                    best_match = Some(c);
                }
            }
        }

        best_match
    }

    fn calculate_confidence(&self, chr: char, _x: u32, _y: u32, _w: u32, _h: u32) -> f32 {
        let base = match self.config.accuracy {
            AccuracyLevel::Low => 0.65,
            AccuracyLevel::Medium => 0.8,
            AccuracyLevel::High => 0.92,
        };

        let stroke_bonus = if self.character_database.stroke_counts.get(&chr).is_some() {
            0.05
        } else {
            0.0
        };

        (base + stroke_bonus).min(0.98)
    }

    fn calculate_confidence_static(chr: char, config: &OcrConfig) -> f32 {
        let base = match config.accuracy {
            AccuracyLevel::Low => 0.65,
            AccuracyLevel::Medium => 0.8,
            AccuracyLevel::High => 0.92,
        };
        base.min(0.98)
    }

    fn calculate_similarity(&self, features1: &[u8], features2: &[u8]) -> f32 {
        if features1.len() != features2.len() {
            return 0.5;
        }

        let mut diff_sum = 0u32;
        for (&a, &b) in features1.iter().zip(features2.iter()) {
            let diff = (a as i32 - b as i32).abs() as u32;
            diff_sum += diff * diff;
        }

        let max_diff = 255u32 * 255u32 * features1.len() as u32;
        let similarity = 1.0 - (diff_sum as f32 / max_diff as f32).sqrt();
        similarity.max(0.3).min(0.98)
    }

    fn calculate_similarity_static(features1: &[u8], features2: &[u8]) -> f32 {
        if features1.len() != features2.len() {
            return 0.5;
        }

        let mut diff_sum = 0u32;
        for (&a, &b) in features1.iter().zip(features2.iter()) {
            let diff = (a as i32 - b as i32).abs() as u32;
            diff_sum += diff * diff;
        }

        let max_diff = 255u32 * 255u32 * features1.len() as u32;
        let similarity = 1.0 - (diff_sum as f32 / max_diff as f32).sqrt();
        similarity.max(0.3).min(0.98)
    }

    fn calculate_image_hash(&self, img: &DynamicImage, x: u32, y: u32, w: u32, h: u32) -> u64 {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let gray = img.to_luma8();
        let mut hasher = DefaultHasher::new();

        let sample_step = ((w + h) / 20).max(4).min(8);
        for cy in (y..y + h).step_by(sample_step as usize) {
            for cx in (x..x + w).step_by(sample_step as usize) {
                if cx < gray.width() && cy < gray.height() {
                    let pixel = gray.get_pixel(cx, cy)[0];
                    (pixel < 128).hash(&mut hasher);
                }
            }
        }

        hasher.finish()
    }

    fn check_variant(&self, chr: char) -> (bool, Option<char>) {
        if !self.config.support_variants {
            return (false, None);
        }
        self.character_database.variant_map.get(&chr).map_or((false, None), |&s| (true, Some(s)))
    }

    pub fn recognize_file(&self, path: &Path, preprocessor: &crate::preprocessing::Preprocessor) -> Result<OcrResult> {
        let processed = preprocessor.process(path)?;
        self.recognize(&processed)
    }

    pub fn get_config(&self) -> &OcrConfig {
        &self.config
    }

    pub fn clear_cache(&self) {
        if let Some(cache) = &self.feature_cache {
            cache.write().clear();
        }
    }
}
