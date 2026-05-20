<?php
namespace Utils;

class PdfGenerator
{
    private static $config;
    
    private static function getConfig(): array
    {
        if (self::$config === null) {
            self::$config = require CONFIG_PATH . '/app.php';
        }
        return self::$config['pdf'] ?? [
            'storage_path' => APP_PATH . '/storage/pdf/',
            'font_path' => APP_PATH . '/assets/fonts/',
        ];
    }
    
    public static function getStoragePath(): string
    {
        $config = self::getConfig();
        $path = $config['storage_path'];
        if (!is_dir($path)) {
            mkdir($path, 0755, true);
        }
        return $path;
    }
    
    public static function generateArchiveNo(): string
    {
        return 'PDF' . date('YmdHis') . str_pad(rand(0, 9999), 4, '0', STR_PAD_LEFT);
    }
    
    public static function generateSkillArchive(array $skills, string $title, array $options = []): array
    {
        $archiveNo = self::generateArchiveNo();
        $storagePath = self::getStoragePath();
        $relativePath = date('Y/m/d/') . $archiveNo . '.pdf';
        $fullPath = $storagePath . $relativePath;
        
        if (!is_dir(dirname($fullPath))) {
            mkdir(dirname($fullPath), 0755, true);
        }
        
        $html = self::buildSkillArchiveHtml($skills, $title, $options);
        $pdfContent = self::htmlToPdf($html, $options);
        
        file_put_contents($fullPath, $pdfContent);
        
        return [
            'archive_no' => $archiveNo,
            'file_path' => $relativePath,
            'file_size' => filesize($fullPath),
            'file_hash' => hash_file('sha256', $fullPath),
            'item_count' => count($skills),
            'title' => $title,
        ];
    }
    
    public static function generateGradeArchive(array $grades, string $title, array $options = []): array
    {
        $archiveNo = self::generateArchiveNo();
        $storagePath = self::getStoragePath();
        $relativePath = date('Y/m/d/') . $archiveNo . '.pdf';
        $fullPath = $storagePath . $relativePath;
        
        if (!is_dir(dirname($fullPath))) {
            mkdir(dirname($fullPath), 0755, true);
        }
        
        $html = self::buildGradeArchiveHtml($grades, $title, $options);
        $pdfContent = self::htmlToPdf($html, $options);
        
        file_put_contents($fullPath, $pdfContent);
        
        return [
            'archive_no' => $archiveNo,
            'file_path' => $relativePath,
            'file_size' => filesize($fullPath),
            'file_hash' => hash_file('sha256', $fullPath),
            'item_count' => count($grades),
            'title' => $title,
        ];
    }
    
    public static function generateHeritorArchive(array $heritors, string $title, array $options = []): array
    {
        $archiveNo = self::generateArchiveNo();
        $storagePath = self::getStoragePath();
        $relativePath = date('Y/m/d/') . $archiveNo . '.pdf';
        $fullPath = $storagePath . $relativePath;
        
        if (!is_dir(dirname($fullPath))) {
            mkdir(dirname($fullPath), 0755, true);
        }
        
        $html = self::buildHeritorArchiveHtml($heritors, $title, $options);
        $pdfContent = self::htmlToPdf($html, $options);
        
        file_put_contents($fullPath, $pdfContent);
        
        return [
            'archive_no' => $archiveNo,
            'file_path' => $relativePath,
            'file_size' => filesize($fullPath),
            'file_hash' => hash_file('sha256', $fullPath),
            'item_count' => count($heritors),
            'title' => $title,
        ];
    }
    
    private static function htmlToPdf(string $html, array $options = []): string
    {
        $pageSize = $options['page_size'] ?? 'A4';
        $orientation = $options['orientation'] ?? 'P';
        
        $pdfContent = self::generatePdfContent($html, $pageSize, $orientation);
        
        return $pdfContent;
    }
    
    private static function generatePdfContent(string $html, string $pageSize, string $orientation): string
    {
        $pdf = self::buildPdfHeader($pageSize, $orientation);
        $pdf .= self::buildPdfContent($html);
        $pdf .= self::buildPdfFooter();
        
        return $pdf;
    }
    
    private static function buildPdfHeader(string $pageSize, string $orientation): string
    {
        $pageDimensions = [
            'A4' => ['width' => 595, 'height' => 842],
            'A3' => ['width' => 842, 'height' => 1191],
        ];
        $dim = $pageDimensions[$pageSize] ?? $pageDimensions['A4'];
        
        $header = "%PDF-1.7\n";
        $header .= "1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n";
        $header .= "2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1/MediaBox[0 0 {$dim['width']} {$dim['height']}]>>\nendobj\n";
        
        return $header;
    }
    
    private static function buildPdfContent(string $html): string
    {
        $text = strip_tags($html);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = preg_replace('/\s+/', ' ', $text);
        $text = trim($text);
        
        $content = "3 0 obj\n<</Type/Page/Parent 2 0 R/Resources<<>>>>\nstream\n";
        $content .= "BT\n/F1 12 Tf\n";
        $content .= "50 800 Td\n";
        
        $lines = explode("\n", wordwrap($text, 80));
        $yPosition = 800;
        foreach ($lines as $line) {
            if ($yPosition < 50) break;
            $encoded = self::encodeText($line);
            $content .= "{$encoded} Tj\n";
            $content .= "0 -15 Td\n";
            $yPosition -= 15;
        }
        
        $content .= "ET\nendstream\nendobj\n";
        
        return $content;
    }
    
    private static function buildPdfFooter(): string
    {
        return "xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000135 00000 n \ntrailer\n<</Size 4/Root 1 0 R>>\nstartxref\n250\n%%EOF\n";
    }
    
    private static function encodeText(string $text): string
    {
        $text = mb_convert_encoding($text, 'UTF-16BE', 'UTF-8');
        return '(' . str_replace(['(', ')', '\\'], ['\\(', '\\)', '\\\\'], $text) . ')';
    }
    
    private static function buildSkillArchiveHtml(array $skills, string $title, array $options = []): string
    {
        $html = self::getHtmlHeader($title);
        
        $html .= '<h1 style="text-align: center; color: #2c3e50; margin-bottom: 30px;">' . htmlspecialchars($title) . '</h1>';
        $html .= '<p style="text-align: center; color: #7f8c8d; margin-bottom: 40px;">生成时间: ' . date('Y年m月d日 H:i:s') . '</p>';
        
        foreach ($skills as $index => $skill) {
            $html .= '<div style="page-break-after: always; border: 1px solid #ddd; padding: 20px; margin-bottom: 20px;">';
            $html .= '<h2 style="color: #34495e; border-bottom: 2px solid #3498db; padding-bottom: 10px;">';
            $html .= '第' . ($index + 1) . '项 · ' . htmlspecialchars($skill['name'] ?? '未知技艺') . '</h2>';
            
            $html .= '<table style="width: 100%; border-collapse: collapse; margin-top: 15px;">';
            $html .= self::buildTableRow('技艺编号', $skill['skill_no'] ?? '');
            $html .= self::buildTableRow('所属类别', $skill['category_name'] ?? $skill['category'] ?? '');
            $html .= self::buildTableRow('技艺等级', self::getLevelName($skill['level'] ?? 0));
            $html .= self::buildTableRow('传承人', $skill['heritor_name'] ?? '');
            $html .= self::buildTableRow('发源地', $skill['origin_area'] ?? '');
            $html .= self::buildTableRow('评定等级', self::getLevelName($skill['final_level'] ?? $skill['level'] ?? 0));
            $html .= self::buildTableRow('总分', ($skill['total_score'] ?? '-') . ' 分');
            $html .= self::buildTableRow('评定时间', $skill['rated_at'] ?? $skill['created_at'] ?? '');
            $html .= '</table>';
            
            if (!empty($skill['description'])) {
                $html .= '<h3 style="color: #34495e; margin-top: 20px;">技艺简介</h3>';
                $html .= '<p style="line-height: 1.6; color: #555;">' . htmlspecialchars($skill['description']) . '</p>';
            }
            
            $html .= '</div>';
        }
        
        $html .= self::getHtmlFooter();
        return $html;
    }
    
    private static function buildGradeArchiveHtml(array $grades, string $title, array $options = []): string
    {
        $html = self::getHtmlHeader($title);
        
        $html .= '<h1 style="text-align: center; color: #2c3e50; margin-bottom: 30px;">' . htmlspecialchars($title) . '</h1>';
        $html .= '<p style="text-align: center; color: #7f8c8d; margin-bottom: 40px;">生成时间: ' . date('Y年m月d日 H:i:s') . '</p>';
        
        $html .= '<table style="width: 100%; border-collapse: collapse; margin-top: 15px;">';
        $html .= '<tr style="background-color: #3498db; color: white;">';
        $html .= '<th style="border: 1px solid #ddd; padding: 10px;">序号</th>';
        $html .= '<th style="border: 1px solid #ddd; padding: 10px;">技艺名称</th>';
        $html .= '<th style="border: 1px solid #ddd; padding: 10px;">传承人</th>';
        $html .= '<th style="border: 1px solid #ddd; padding: 10px;">评定等级</th>';
        $html .= '<th style="border: 1px solid #ddd; padding: 10px;">总分</th>';
        $html .= '<th style="border: 1px solid #ddd; padding: 10px;">评定时间</th>';
        $html .= '</tr>';
        
        foreach ($grades as $index => $grade) {
            $bgColor = $index % 2 == 0 ? '#f8f9fa' : 'white';
            $html .= "<tr style=\"background-color: {$bgColor};\">";
            $html .= '<td style="border: 1px solid #ddd; padding: 10px; text-align: center;">' . ($index + 1) . '</td>';
            $html .= '<td style="border: 1px solid #ddd; padding: 10px;">' . htmlspecialchars($grade['skill_name'] ?? '') . '</td>';
            $html .= '<td style="border: 1px solid #ddd; padding: 10px;">' . htmlspecialchars($grade['heritor_name'] ?? '') . '</td>';
            $html .= '<td style="border: 1px solid #ddd; padding: 10px; text-align: center;">' . self::getLevelName($grade['final_level'] ?? 0) . '</td>';
            $html .= '<td style="border: 1px solid #ddd; padding: 10px; text-align: center;">' . ($grade['total_score'] ?? '-') . '</td>';
            $html .= '<td style="border: 1px solid #ddd; padding: 10px; text-align: center;">' . ($grade['rated_at'] ?? '-') . '</td>';
            $html .= '</tr>';
        }
        
        $html .= '</table>';
        $html .= self::getHtmlFooter();
        return $html;
    }
    
    private static function buildHeritorArchiveHtml(array $heritors, string $title, array $options = []): string
    {
        $html = self::getHtmlHeader($title);
        
        $html .= '<h1 style="text-align: center; color: #2c3e50; margin-bottom: 30px;">' . htmlspecialchars($title) . '</h1>';
        $html .= '<p style="text-align: center; color: #7f8c8d; margin-bottom: 40px;">生成时间: ' . date('Y年m月d日 H:i:s') . '</p>';
        
        foreach ($heritors as $index => $heritor) {
            $html .= '<div style="page-break-after: always; border: 1px solid #ddd; padding: 20px; margin-bottom: 20px;">';
            $html .= '<h2 style="color: #34495e; border-bottom: 2px solid #27ae60; padding-bottom: 10px;">';
            $html .= '第' . ($index + 1) . '位 · ' . htmlspecialchars($heritor['name'] ?? '未知传承人') . '</h2>';
            
            $html .= '<table style="width: 100%; border-collapse: collapse; margin-top: 15px;">';
            $html .= self::buildTableRow('传承人编号', $heritor['heritor_no'] ?? '');
            $html .= self::buildTableRow('性别', $heritor['gender'] == 2 ? '女' : '男');
            $html .= self::buildTableRow('出生日期', $heritor['birth_date'] ?? '');
            $html .= self::buildTableRow('民族', $heritor['ethnicity'] ?? '');
            $html .= self::buildTableRow('学历', $heritor['education'] ?? '');
            $html .= self::buildTableRow('所属技艺', $heritor['skill_name'] ?? '');
            $html .= self::buildTableRow('资质等级', self::getLevelName($heritor['qualification_level'] ?? 0));
            $html .= self::buildTableRow('评定日期', $heritor['qualification_date'] ?? '');
            $html .= '</table>';
            
            if (!empty($heritor['bio'])) {
                $html .= '<h3 style="color: #34495e; margin-top: 20px;">个人简介</h3>';
                $html .= '<p style="line-height: 1.6; color: #555;">' . htmlspecialchars($heritor['bio']) . '</p>';
            }
            
            $html .= '</div>';
        }
        
        $html .= self::getHtmlFooter();
        return $html;
    }
    
    private static function buildTableRow(string $label, string $value): string
    {
        return '<tr>' .
            '<td style="border: 1px solid #ddd; padding: 8px; width: 150px; background-color: #ecf0f1; font-weight: bold;">' . $label . '</td>' .
            '<td style="border: 1px solid #ddd; padding: 8px;">' . htmlspecialchars($value) . '</td>' .
            '</tr>';
    }
    
    private static function getHtmlHeader(string $title): string
    {
        return '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>' . htmlspecialchars($title) . '</title>
    <style>
        body { font-family: "SimSun", "Microsoft YaHei", sans-serif; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #3498db; color: white; }
        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 60px;
            color: rgba(200, 200, 200, 0.1);
            z-index: -1;
        }
    </style>
</head>
<body>
<div class="watermark">非遗政务系统</div>';
    }
    
    private static function getHtmlFooter(): string
    {
        return '<div style="text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 12px;">
            本文件由非遗政务系统自动生成，仅供内部使用
        </div>
</body>
</html>';
    }
    
    private static function getLevelName(int $level): string
    {
        $levels = [1 => '国家级', 2 => '省级', 3 => '市级', 4 => '县级'];
        return $levels[$level] ?? '未评定';
    }
    
    public static function batchZipArchives(array $archiveNos, string $zipName = ''): array
    {
        $storagePath = self::getStoragePath();
        $zipPath = $storagePath . 'batch/' . ($zipName ?: 'batch_' . date('YmdHis')) . '.zip';
        
        if (!is_dir(dirname($zipPath))) {
            mkdir(dirname($zipPath), 0755, true);
        }
        
        $zip = new \ZipArchive();
        if ($zip->open($zipPath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
            throw new \Exception('无法创建ZIP文件');
        }
        
        $db = \Core\Database::getInstance();
        $successCount = 0;
        
        foreach ($archiveNos as $archiveNo) {
            $archive = $db->fetchOne("SELECT * FROM pdf_archives WHERE archive_no = ?", [$archiveNo]);
            if ($archive && file_exists($storagePath . $archive['file_path'])) {
                $zip->addFile($storagePath . $archive['file_path'], $archive['title'] . '_' . $archiveNo . '.pdf');
                $successCount++;
            }
        }
        
        $zip->close();
        
        return [
            'zip_path' => $zipPath,
            'success_count' => $successCount,
            'file_size' => filesize($zipPath),
        ];
    }
}