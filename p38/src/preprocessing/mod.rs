use crate::Result;
use image::{DynamicImage, GrayImage, ImageBuffer, Luma};
use std::path::Path;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PreprocessConfig {
    pub denoise_strength: u8,
    pub deskew_angle: f64,
    pub threshold_level: u8,
    pub segment_min_size: u32,
}

impl Default for PreprocessConfig {
    fn default() -> Self {
        Self {
            denoise_strength: 30,
            deskew_angle: 0.0,
            threshold_level: 128,
            segment_min_size: 20,
        }
    }
}

pub struct Preprocessor {
    config: PreprocessConfig,
}

impl Preprocessor {
    pub fn new(config: PreprocessConfig) -> Self {
        Self { config }
    }

    pub fn load_image(&self, path: &Path) -> Result<DynamicImage> {
        let img = image::open(path)
            .map_err(|e| crate::Error::ImageError(format!("无法加载图像: {}", e)))?;
        Ok(img)
    }

    pub fn to_grayscale(&self, img: &DynamicImage) -> GrayImage {
        img.to_luma8()
    }

    pub fn denoise(&self, img: &GrayImage) -> GrayImage {
        let (width, height) = img.dimensions();
        let mut result = GrayImage::new(width, height);
        
        for y in 0..height {
            for x in 0..width {
                let mut sum = 0u32;
                let mut count = 0u32;
                
                for dy in -1..=1 {
                    for dx in -1..=1 {
                        let nx = x as i32 + dx;
                        let ny = y as i32 + dy;
                        if nx >= 0 && nx < width as i32 && ny >= 0 && ny < height as i32 {
                            sum += img.get_pixel(nx as u32, ny as u32)[0] as u32;
                            count += 1;
                        }
                    }
                }
                
                let avg = (sum / count) as u8;
                result.put_pixel(x, y, Luma([avg]));
            }
        }
        
        result
    }

    pub fn threshold(&self, img: &GrayImage) -> GrayImage {
        let mut result = img.clone();
        
        for pixel in result.pixels_mut() {
            let val = if pixel[0] > self.config.threshold_level { 255 } else { 0 };
            *pixel = Luma([val]);
        }
        
        result
    }

    pub fn deskew(&self, img: &GrayImage) -> GrayImage {
        img.clone()
    }

    pub fn segment_characters(&self, img: &GrayImage) -> Result<Vec<(u32, u32, u32, u32)>> {
        let mut segments = Vec::new();
        let (width, height) = img.dimensions();
        let mut visited = vec![vec![false; width as usize]; height as usize];
        
        for y in 0..height {
            for x in 0..width {
                if !visited[y as usize][x as usize] && img.get_pixel(x, y)[0] == 0 {
                    if let Some(rect) = self.flood_fill(img, x, y, &mut visited) {
                        let (_, _, w, h) = rect;
                        if w >= self.config.segment_min_size && h >= self.config.segment_min_size {
                            segments.push(rect);
                        }
                    }
                }
            }
        }
        
        Ok(segments)
    }

    fn flood_fill(&self, img: &GrayImage, start_x: u32, start_y: u32, visited: &mut Vec<Vec<bool>>) -> Option<(u32, u32, u32, u32)> {
        let (width, height) = img.dimensions();
        let mut stack = vec![(start_x, start_y)];
        let mut min_x = start_x;
        let mut max_x = start_x;
        let mut min_y = start_y;
        let mut max_y = start_y;
        
        while let Some((x, y)) = stack.pop() {
            if x >= width || y >= height || visited[y as usize][x as usize] {
                continue;
            }
            
            if img.get_pixel(x, y)[0] != 0 {
                continue;
            }
            
            visited[y as usize][x as usize] = true;
            min_x = min_x.min(x);
            max_x = max_x.max(x);
            min_y = min_y.min(y);
            max_y = max_y.max(y);
            
            if x > 0 { stack.push((x - 1, y)); }
            if x < width - 1 { stack.push((x + 1, y)); }
            if y > 0 { stack.push((x, y - 1)); }
            if y < height - 1 { stack.push((x, y + 1)); }
        }
        
        let w = max_x - min_x + 1;
        let h = max_y - min_y + 1;
        
        Some((min_x, min_y, w, h))
    }

    pub fn process(&self, path: &Path) -> Result<ProcessedImage> {
        let img = self.load_image(path)?;
        let gray = self.to_grayscale(&img);
        let denoised = self.denoise(&gray);
        let thresholded = self.threshold(&denoised);
        let deskewed = self.deskew(&thresholded);
        let segments = self.segment_characters(&deskewed)?;
        
        Ok(ProcessedImage {
            original: img,
            processed: DynamicImage::ImageLuma8(deskewed),
            segments,
        })
    }
}

#[derive(Debug, Clone)]
pub struct ProcessedImage {
    pub original: DynamicImage,
    pub processed: DynamicImage,
    pub segments: Vec<(u32, u32, u32, u32)>,
}
