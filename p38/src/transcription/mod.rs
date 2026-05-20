use crate::char_converter::{CharConverter, SentencePunctuator};
use crate::recognition::OcrResult;
use crate::Result;
use printpdf::*;
use std::fs::File;
use std::io::BufWriter;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TranscriptionConfig {
    pub output_format: OutputFormat,
    pub include_metadata: bool,
    pub include_confidence: bool,
    pub preserve_layout: bool,
    pub line_spacing: f32,
    pub convert_to_simplified: bool,
    pub convert_to_standard: bool,
    pub auto_punctuate: bool,
    pub font_size: f32,
    pub margin: f32,
}

#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub enum OutputFormat {
    Txt,
    Pdf,
    Json,
    Markdown,
    Csv,
    Html,
}

impl Default for TranscriptionConfig {
    fn default() -> Self {
        Self {
            output_format: OutputFormat::Txt,
            include_metadata: true,
            include_confidence: false,
            preserve_layout: true,
            line_spacing: 1.5,
            convert_to_simplified: false,
            convert_to_standard: true,
            auto_punctuate: false,
            font_size: 14.0,
            margin: 20.0,
        }
    }
}

#[derive(Debug, Clone)]
pub struct BatchResult {
    pub total_files: usize,
    pub successful: usize,
    pub failed: usize,
    pub output_paths: Vec<String>,
    pub errors: Vec<String>,
}

pub struct Transcriber {
    config: TranscriptionConfig,
    converter: CharConverter,
    punctuator: SentencePunctuator,
}

impl Transcriber {
    pub fn new(config: TranscriptionConfig) -> Self {
        Self {
            config,
            converter: CharConverter::new(),
            punctuator: SentencePunctuator::new(),
        }
    }

    pub fn transcribe(&self, result: &OcrResult, output_path: &Path) -> Result<()> {
        match self.config.output_format {
            OutputFormat::Txt => self.transcribe_to_txt(result, output_path),
            OutputFormat::Pdf => self.transcribe_to_pdf(result, output_path),
            OutputFormat::Json => self.transcribe_to_json(result, output_path),
            OutputFormat::Markdown => self.transcribe_to_markdown(result, output_path),
            OutputFormat::Csv => self.transcribe_to_csv(result, output_path),
            OutputFormat::Html => self.transcribe_to_html(result, output_path),
        }
    }

    pub fn transcribe_batch(&self, results: &[(&OcrResult, PathBuf)], output_dir: &Path) -> Result<BatchResult> {
        if !output_dir.exists() {
            std::fs::create_dir_all(output_dir)?;
        }

        let mut batch_result = BatchResult {
            total_files: results.len(),
            successful: 0,
            failed: 0,
            output_paths: Vec::new(),
            errors: Vec::new(),
        };

        for (result, base_path) in results {
            let file_stem = base_path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("output");

            let output_path = output_dir.join(format!(
                "{}{}",
                file_stem,
                self.get_extension()
            ));

            match self.transcribe(result, &output_path) {
                Ok(_) => {
                    batch_result.successful += 1;
                    batch_result.output_paths.push(output_path.to_string_lossy().to_string());
                }
                Err(e) => {
                    batch_result.failed += 1;
                    batch_result.errors.push(format!(
                        "{}: {}",
                        output_path.display(),
                        e
                    ));
                }
            }
        }

        Ok(batch_result)
    }

    pub fn find_replace(&self, text: &str, find: &str, replace: &str) -> String {
        text.replace(find, replace)
    }

    pub fn batch_replace(&self, text: &str, replacements: &[(String, String)]) -> String {
        let mut result = text.to_string();
        for (find, replace) in replacements {
            result = result.replace(find, replace);
        }
        result
    }

    pub fn process_text(&self, result: &OcrResult) -> String {
        let mut text = if self.config.preserve_layout {
            self.format_with_layout(result)
        } else {
            result.text.clone()
        };

        if self.config.convert_to_standard {
            text = self.converter.convert_to_standard(&text);
        }

        if self.config.convert_to_simplified {
            text = self.converter.convert_to_simplified(&text);
        }

        if self.config.auto_punctuate {
            text = self.punctuator.punctuate(&text);
        }

        text
    }

    fn get_extension(&self) -> &'static str {
        match self.config.output_format {
            OutputFormat::Txt => ".txt",
            OutputFormat::Pdf => ".pdf",
            OutputFormat::Json => ".json",
            OutputFormat::Markdown => ".md",
            OutputFormat::Csv => ".csv",
            OutputFormat::Html => ".html",
        }
    }

    fn transcribe_to_txt(&self, result: &OcrResult, output_path: &Path) -> Result<()> {
        let mut content = String::new();
        
        if self.config.include_metadata {
            content.push_str(&format!("识别时间: {} 毫秒\n", result.processing_time_ms));
            content.push_str(&format!("总字符数: {}\n", result.total_characters));
            content.push_str(&"=".repeat(50));
            content.push_str("\n\n");
        }
        
        content.push_str(&self.process_text(result));
        
        if self.config.include_confidence {
            content.push_str("\n\n字符置信度:\n");
            for chr in &result.characters {
                content.push_str(&format!(
                    "{}: {:.1}%{}\n",
                    chr.character,
                    chr.confidence * 100.0,
                    if chr.is_variant { " (异体字)" } else { "" }
                ));
            }
        }
        
        std::fs::write(output_path, content)?;
        Ok(())
    }

    fn format_with_layout(&self, result: &OcrResult) -> String {
        if result.characters.is_empty() {
            return String::new();
        }
        
        let mut sorted_chars = result.characters.clone();
        sorted_chars.sort_by(|a, b| {
            a.y.cmp(&b.y).then_with(|| a.x.cmp(&b.x))
        });
        
        let mut lines: Vec<Vec<crate::recognition::CharacterRecognition>> = Vec::new();
        let mut current_line = Vec::new();
        
        if !sorted_chars.is_empty() {
            let mut current_line_y = sorted_chars[0].y;
            let line_height = sorted_chars.iter().map(|c| c.height).max().unwrap_or(30);
            let line_threshold = (line_height as f32 * 0.5) as u32;
            
            for chr in sorted_chars {
                if (chr.y as i32 - current_line_y as i32).abs() > line_threshold as i32 {
                    if !current_line.is_empty() {
                        lines.push(current_line);
                    }
                    current_line = Vec::new();
                    current_line_y = chr.y;
                }
                current_line.push(chr);
            }
            
            if !current_line.is_empty() {
                lines.push(current_line);
            }
        }
        
        for line in &mut lines {
            line.sort_by(|a, b| a.x.cmp(&b.x));
        }
        
        let mut output = String::new();
        for line in lines {
            if line.is_empty() {
                continue;
            }
            
            let min_x = line.iter().map(|c| c.x).min().unwrap_or(0);
            let mut formatted_line = String::new();
            let mut last_x = min_x;
            
            for chr in &line {
                let gap = (chr.x - last_x) as usize;
                let space_count = (gap as f32 / 15.0).round() as usize;
                
                for _ in 0..space_count {
                    formatted_line.push(' ');
                }
                
                formatted_line.push(chr.character);
                last_x = chr.x + chr.width;
            }
            
            output.push_str(&formatted_line);
            output.push('\n');
        }
        
        output
    }

    fn transcribe_to_pdf(&self, result: &OcrResult, output_path: &Path) -> Result<()> {
        let page_width = Mm(210.0);
        let page_height = Mm(297.0);
        let margin = Mm(self.config.margin);
        let line_height = Mm(self.config.font_size / 2.835 * self.config.line_spacing);
        
        let (mut doc, mut page1, mut layer1) = PdfDocument::new(
            "古籍刻本转录结果",
            page_width,
            page_height,
            "Layer 1",
        );
        let mut current_layer = doc.get_page(page1).get_layer(layer1);
        
        let font = doc.add_builtin_font(BuiltinFont::TimesRoman)
            .map_err(|e| crate::Error::TranscriptionError(format!("PDF字体错误: {}", e)))?;
        
        let mut y = page_height - margin;
        
        if self.config.include_metadata {
            current_layer.begin_text_section();
            current_layer.set_font(&font, 10.0);
            current_layer.set_text_cursor(margin, y);
            current_layer.write_text(format!("识别时间: {} 毫秒", result.processing_time_ms), &font);
            y -= line_height;
            current_layer.set_text_cursor(margin, y);
            current_layer.write_text(format!("总字符数: {}", result.total_characters), &font);
            y -= line_height * 2.0;
            current_layer.end_text_section();
        }
        
        let text = self.process_text(result);
        
        current_layer.set_font(&font, self.config.font_size);
        
        for line in text.lines() {
            if line.is_empty() {
                y -= line_height;
                continue;
            }
            
            if y < margin + line_height {
                let (new_page, new_layer) = doc.add_page(page_width, page_height, "Next Layer");
                page1 = new_page;
                layer1 = new_layer;
                current_layer = doc.get_page(page1).get_layer(layer1);
                current_layer.set_font(&font, self.config.font_size);
                y = page_height - margin;
            }
            
            current_layer.begin_text_section();
            current_layer.set_text_cursor(margin, y);
            current_layer.write_text(line, &font);
            current_layer.end_text_section();
            y -= line_height;
        }
        
        doc.save(&mut BufWriter::new(File::create(output_path)?))
            .map_err(|e| crate::Error::TranscriptionError(format!("PDF保存错误: {}", e)))?;
        
        Ok(())
    }

    fn transcribe_to_json(&self, result: &OcrResult, output_path: &Path) -> Result<()> {
        #[derive(serde::Serialize)]
        struct Output<'a> {
            metadata: Metadata,
            text: String,
            characters: &'a [crate::recognition::CharacterRecognition],
        }

        #[derive(serde::Serialize)]
        struct Metadata {
            processing_time_ms: u64,
            total_characters: usize,
            converted_to_simplified: bool,
            converted_to_standard: bool,
            auto_punctuated: bool,
        }

        let output = Output {
            metadata: Metadata {
                processing_time_ms: result.processing_time_ms,
                total_characters: result.total_characters,
                converted_to_simplified: self.config.convert_to_simplified,
                converted_to_standard: self.config.convert_to_standard,
                auto_punctuated: self.config.auto_punctuate,
            },
            text: self.process_text(result),
            characters: &result.characters,
        };

        let json = serde_json::to_string_pretty(&output)
            .map_err(|e| crate::Error::TranscriptionError(format!("JSON序列化错误: {}", e)))?;
        
        std::fs::write(output_path, json)?;
        Ok(())
    }

    fn transcribe_to_markdown(&self, result: &OcrResult, output_path: &Path) -> Result<()> {
        let mut content = String::new();
        
        content.push_str("# 古籍刻本转录结果\n\n");
        
        if self.config.include_metadata {
            content.push_str("## 元数据\n\n");
            content.push_str(&format!("- 识别时间: {} 毫秒\n", result.processing_time_ms));
            content.push_str(&format!("- 总字符数: {}\n", result.total_characters));
            
            let mut conversions = Vec::new();
            if self.config.convert_to_standard {
                conversions.push("标准字形转换");
            }
            if self.config.convert_to_simplified {
                conversions.push("简体字转换");
            }
            if self.config.auto_punctuate {
                conversions.push("自动断句");
            }
            if !conversions.is_empty() {
                content.push_str(&format!("- 文本处理: {}\n", conversions.join(", ")));
            }
            content.push('\n');
        }
        
        content.push_str("## 转录内容\n\n");
        content.push_str(&self.process_text(result));
        
        if self.config.include_confidence {
            content.push_str("\n\n## 字符置信度\n\n");
            content.push_str("| 字符 | 置信度 | 备注 |\n");
            content.push_str("|------|--------|------|\n");
            for chr in &result.characters {
                content.push_str(&format!(
                    "| {} | {:.1}% | {} |\n",
                    chr.character,
                    chr.confidence * 100.0,
                    if chr.is_variant { "异体字" } else { "" }
                ));
            }
        }
        
        std::fs::write(output_path, content)?;
        Ok(())
    }

    fn transcribe_to_csv(&self, result: &OcrResult, output_path: &Path) -> Result<()> {
        let mut content = String::new();
        
        content.push_str("字符,置信度(%),x坐标,y坐标,宽度,高度,是否异体字\n");
        
        for chr in &result.characters {
            content.push_str(&format!(
                "\"{}\",{:.1},{},{},{},{},{}\n",
                chr.character,
                chr.confidence * 100.0,
                chr.x,
                chr.y,
                chr.width,
                chr.height,
                if chr.is_variant { "是" } else { "否" }
            ));
        }
        
        std::fs::write(output_path, content)?;
        Ok(())
    }

    fn transcribe_to_html(&self, result: &OcrResult, output_path: &Path) -> Result<()> {
        let mut content = String::new();
        
        content.push_str("<!DOCTYPE html>\n");
        content.push_str("<html lang=\"zh-CN\">\n");
        content.push_str("<head>\n");
        content.push_str("    <meta charset=\"UTF-8\">\n");
        content.push_str("    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n");
        content.push_str("    <title>古籍刻本转录结果</title>\n");
        content.push_str("    <style>\n");
        content.push_str("        body { font-family: \"Microsoft YaHei\", SimSun, serif; max-width: 800px; margin: 0 auto; padding: 20px; }\n");
        content.push_str("        h1 { color: #333; border-bottom: 2px solid #ccc; padding-bottom: 10px; }\n");
        content.push_str("        .metadata { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }\n");
        content.push_str("        .text-content { line-height: 1.8; font-size: 18px; white-space: pre-wrap; }\n");
        content.push_str("        table { width: 100%; border-collapse: collapse; margin: 20px 0; }\n");
        content.push_str("        th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }\n");
        content.push_str("        th { background: #f0f0f0; }\n");
        content.push_str("        .variant { color: #d32f2f; }\n");
        content.push_str("    </style>\n");
        content.push_str("</head>\n");
        content.push_str("<body>\n");
        content.push_str("    <h1>古籍刻本转录结果</h1>\n");
        
        if self.config.include_metadata {
            content.push_str("    <div class=\"metadata\">\n");
            content.push_str(&format!("        <p><strong>识别时间:</strong> {} 毫秒</p>\n", result.processing_time_ms));
            content.push_str(&format!("        <p><strong>总字符数:</strong> {}</p>\n", result.total_characters));
            content.push_str("    </div>\n");
        }
        
        content.push_str("    <div class=\"text-content\">\n");
        content.push_str(&self.process_text(result));
        content.push_str("    </div>\n");
        
        if self.config.include_confidence {
            content.push_str("    <h2>字符置信度</h2>\n");
            content.push_str("    <table>\n");
            content.push_str("        <tr><th>字符</th><th>置信度</th><th>坐标</th><th>备注</th></tr>\n");
            for chr in &result.characters {
                content.push_str(&format!(
                    "        <tr><td{}>{}</td><td>{:.1}%</td><td>({}, {})</td><td>{}</td></tr>\n",
                    if chr.is_variant { " class=\"variant\"" } else { "" },
                    chr.character,
                    chr.confidence * 100.0,
                    chr.x,
                    chr.y,
                    if chr.is_variant { "异体字" } else { "" }
                ));
            }
            content.push_str("    </table>\n");
        }
        
        content.push_str("</body>\n");
        content.push_str("</html>\n");
        
        std::fs::write(output_path, content)?;
        Ok(())
    }
}
