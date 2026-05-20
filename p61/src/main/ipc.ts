import { ipcMain, BrowserWindow } from 'electron';
import { TypeWriterDriver } from './modules/driver';
import { CharacterCollector } from './modules/collector';
import { ImageRecognitionModule } from './modules/recognition';
import { TranscriptionModule } from './modules/transcription';
import { ArchiveManager } from './modules/archive';
import { StyleComparisonModule } from './modules/styleComparison';
import { BatchProcessorModule } from './modules/batchProcessor';
import { ModelRecognitionModule } from './modules/modelRecognition';

let driver: TypeWriterDriver;
let collector: CharacterCollector;
let recognition: ImageRecognitionModule;
let transcription: TranscriptionModule;
let archive: ArchiveManager;
let styleComparison: StyleComparisonModule;
let batchProcessor: BatchProcessorModule;
let modelRecognition: ModelRecognitionModule;

export function initializeModules(): void {
  driver = new TypeWriterDriver();
  collector = new CharacterCollector();
  recognition = new ImageRecognitionModule();
  transcription = new TranscriptionModule();
  archive = new ArchiveManager();
  styleComparison = new StyleComparisonModule();
  batchProcessor = new BatchProcessorModule();
  modelRecognition = new ModelRecognitionModule();

  driver.on('character', (data) => {
    collector.collectCharacter(data);
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      mainWindow.webContents.send('character-data', data);
    }
  });
}

export function registerIpcHandlers(): void {
  initializeModules();

  ipcMain.handle('list-ports', async () => {
    try {
      return await driver.listPorts();
    } catch (error) {
      console.error('Failed to list ports:', error);
      return [];
    }
  });

  ipcMain.handle('connect-port', async (_, port: string, baudRate: number) => {
    try {
      await driver.connect({ port, baudRate, typewriterModel: 'default' });
      return { success: true };
    } catch (error) {
      console.error('Failed to connect port:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('disconnect-port', async () => {
    try {
      await driver.disconnect();
      return { success: true };
    } catch (error) {
      console.error('Failed to disconnect port:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('recognize-image', async (_, imageData: string) => {
    try {
      const result = await recognition.recognizeImage(imageData);
      return { success: true, data: result };
    } catch (error) {
      console.error('Recognition failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('export-txt', async (_, content: string, filePath: string) => {
    try {
      await transcription.exportToTxt(content, filePath);
      return { success: true };
    } catch (error) {
      console.error('Export TXT failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('export-pdf', async (_, content: string, filePath: string) => {
    try {
      await transcription.exportToPdf(content, filePath);
      return { success: true };
    } catch (error) {
      console.error('Export PDF failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('save-record', async (_, recordData: any) => {
    try {
      const record = archive.addRecord(recordData.type || 'transcription', recordData);
      return { success: true, data: record };
    } catch (error) {
      console.error('Save record failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('get-records', async () => {
    try {
      const records = archive.getAllRecords();
      return { success: true, data: records };
    } catch (error) {
      console.error('Get records failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('save-font-style', async (_, style: any) => {
    try {
      recognition.addFontStyle(style);
      archive.addRecord('font_style', style);
      return { success: true };
    } catch (error) {
      console.error('Save font style failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('get-font-styles', async () => {
    try {
      const styles = recognition.getAllFontStyles();
      return { success: true, data: styles };
    } catch (error) {
      console.error('Get font styles failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('start-collection-session', async (_, typewriterModel?: string) => {
    try {
      const session = collector.startSession(typewriterModel);
      return { success: true, data: session };
    } catch (error) {
      console.error('Start session failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('end-collection-session', async () => {
    try {
      const session = collector.endSession();
      if (session) {
        archive.addRecord('session', session);
      }
      return { success: true, data: session };
    } catch (error) {
      console.error('End session failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('get-current-session', async () => {
    try {
      const session = collector.getCurrentSession();
      return { success: true, data: session };
    } catch (error) {
      console.error('Get session failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('correct-character', async (_, sessionId: string, index: number, correction: string) => {
    try {
      const result = collector.correctCharacter(sessionId, index, correction);
      return { success: true, data: result };
    } catch (error) {
      console.error('Correct character failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('create-transcription', async (_, content: string, typewriterModel?: string, fontStyle?: string, encoding?: string) => {
    try {
      const result = transcription.createTranscription(content, typewriterModel, fontStyle, encoding);
      return { success: true, data: result };
    } catch (error) {
      console.error('Create transcription failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('validate-content', async (_, content: string) => {
    try {
      const result = transcription.validateContent(content);
      return { success: true, data: result };
    } catch (error) {
      console.error('Validate content failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('sanitize-content', async (_, content: string) => {
    try {
      const result = transcription.sanitizeContent(content);
      return { success: true, data: result };
    } catch (error) {
      console.error('Sanitize content failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('detect-encoding', async (_, content: string) => {
    try {
      const result = transcription.detectEncoding(content);
      return { success: true, data: result };
    } catch (error) {
      console.error('Detect encoding failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('batch-export', async (_, items: any[], options: any) => {
    try {
      const result = await transcription.batchExport(items, options);
      return { success: true, data: result };
    } catch (error) {
      console.error('Batch export failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('validate-and-export', async (_, content: string, filePath: string, format: 'txt' | 'pdf', options: any) => {
    try {
      const result = await transcription.validateAndExport(content, filePath, format, options);
      return { success: result.success, data: result };
    } catch (error) {
      console.error('Validate and export failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('get-transcriptions', async () => {
    try {
      const result = transcription.getAllTranscriptions();
      return { success: true, data: result };
    } catch (error) {
      console.error('Get transcriptions failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('get-archive-stats', async () => {
    try {
      const stats = archive.getStats();
      return { success: true, data: stats };
    } catch (error) {
      console.error('Get archive stats failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('get-connection-stats', async () => {
    try {
      const stats = driver.getStats();
      return { success: true, data: stats };
    } catch (error) {
      console.error('Get connection stats failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('compare-styles', async (_, style1Id: string, style2Id: string) => {
    try {
      const style1 = styleComparison.getStyle(style1Id);
      const style2 = styleComparison.getStyle(style2Id);
      if (!style1 || !style2) {
        return { success: false, error: 'Style not found' };
      }
      const result = styleComparison.compareStyles(style1, style2);
      return { success: true, data: result };
    } catch (error) {
      console.error('Compare styles failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('get-all-styles', async () => {
    try {
      const styles = styleComparison.getAllStyles();
      return { success: true, data: styles };
    } catch (error) {
      console.error('Get all styles failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('add-style', async (_, style: any) => {
    try {
      styleComparison.addStyle(style);
      return { success: true };
    } catch (error) {
      console.error('Add style failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('get-styles-by-model', async (_, modelName: string) => {
    try {
      const styles = styleComparison.getStylesByModel(modelName);
      return { success: true, data: styles };
    } catch (error) {
      console.error('Get styles by model failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('generate-style-report', async (_, styleId: string) => {
    try {
      const style = styleComparison.getStyle(styleId);
      if (!style) return { success: false, error: 'Style not found' };
      const report = styleComparison.generateStyleReport(style);
      return { success: true, data: report };
    } catch (error) {
      console.error('Generate style report failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('get-all-typewriter-models', async () => {
    try {
      const models = styleComparison.getAllModels();
      return { success: true, data: models };
    } catch (error) {
      console.error('Get all models failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('find-matching-model', async (_, sampleStyles: any[]) => {
    try {
      const result = styleComparison.findMatchingModel(sampleStyles);
      return { success: true, data: result };
    } catch (error) {
      console.error('Find matching model failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('batch-watermark', async (_, files: string[], outputDir: string, config: any) => {
    try {
      const result = await batchProcessor.batchWatermark(files, outputDir, config);
      return { success: true, data: result };
    } catch (error) {
      console.error('Batch watermark failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('batch-convert', async (_, files: string[], outputDir: string, options: any) => {
    try {
      const result = await batchProcessor.batchConvert(files, outputDir, options);
      return { success: true, data: result };
    } catch (error) {
      console.error('Batch convert failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('get-job-status', async (_, jobId: string) => {
    try {
      const job = batchProcessor.getJob(jobId);
      return { success: true, data: job };
    } catch (error) {
      console.error('Get job status failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('get-all-jobs', async () => {
    try {
      const jobs = batchProcessor.getAllJobs();
      return { success: true, data: jobs };
    } catch (error) {
      console.error('Get all jobs failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('get-supported-formats', async () => {
    try {
      const formats = batchProcessor.getSupportedFormats();
      return { success: true, data: formats };
    } catch (error) {
      console.error('Get supported formats failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('detect-devices', async () => {
    try {
      const devices = await modelRecognition.detectConnectedDevices();
      return { success: true, data: devices };
    } catch (error) {
      console.error('Detect devices failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('recognize-model', async (_, deviceInfo: any) => {
    try {
      const result = await modelRecognition.recognizeModel(deviceInfo);
      return { success: true, data: result };
    } catch (error) {
      console.error('Recognize model failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('auto-configure', async (_, portPath: string) => {
    try {
      const result = await modelRecognition.autoConfigure(portPath);
      return { success: result.success, data: result };
    } catch (error) {
      console.error('Auto configure failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('get-typewriter-fingerprints', async () => {
    try {
      const fingerprints = modelRecognition.getAllModels();
      return { success: true, data: fingerprints };
    } catch (error) {
      console.error('Get fingerprints failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('search-typewriter-models', async (_, query: string) => {
    try {
      const models = modelRecognition.searchModels(query);
      return { success: true, data: models };
    } catch (error) {
      console.error('Search models failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('identify-from-characteristics', async (_, charWidth: number, hasSerif: boolean, lineHeight?: number) => {
    try {
      const result = await modelRecognition.identifyFromCharacteristics(charWidth, hasSerif, lineHeight);
      return { success: true, data: result };
    } catch (error) {
      console.error('Identify from characteristics failed:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('get-manufacturers', async () => {
    try {
      const manufacturers = modelRecognition.getManufacturers();
      return { success: true, data: manufacturers };
    } catch (error) {
      console.error('Get manufacturers failed:', error);
      return { success: false, error: String(error) };
    }
  });
}
