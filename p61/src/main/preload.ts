import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  listPorts: () => ipcRenderer.invoke('list-ports'),
  connectPort: (port: string, baudRate: number) => ipcRenderer.invoke('connect-port', port, baudRate),
  disconnectPort: () => ipcRenderer.invoke('disconnect-port'),
  onCharacterData: (callback: (data: any) => void) => {
    ipcRenderer.on('character-data', (_, data) => callback(data));
  },
  removeCharacterDataListener: () => {
    ipcRenderer.removeAllListeners('character-data');
  },
  recognizeImage: (imageData: string) => ipcRenderer.invoke('recognize-image', imageData),
  exportToTxt: (content: string, path: string) => ipcRenderer.invoke('export-txt', content, path),
  exportToPdf: (content: string, path: string) => ipcRenderer.invoke('export-pdf', content, path),
  saveRecord: (record: any) => ipcRenderer.invoke('save-record', record),
  getRecords: () => ipcRenderer.invoke('get-records'),
  saveFontStyle: (style: any) => ipcRenderer.invoke('save-font-style', style),
  getFontStyles: () => ipcRenderer.invoke('get-font-styles'),

  compareStyles: (style1Id: string, style2Id: string) => ipcRenderer.invoke('compare-styles', style1Id, style2Id),
  getAllStyles: () => ipcRenderer.invoke('get-all-styles'),
  addStyle: (style: any) => ipcRenderer.invoke('add-style', style),
  getStylesByModel: (modelName: string) => ipcRenderer.invoke('get-styles-by-model', modelName),
  generateStyleReport: (styleId: string) => ipcRenderer.invoke('generate-style-report', styleId),
  getAllTypewriterModels: () => ipcRenderer.invoke('get-all-typewriter-models'),
  findMatchingModel: (sampleStyles: any[]) => ipcRenderer.invoke('find-matching-model', sampleStyles),

  batchWatermark: (files: string[], outputDir: string, config: any) => ipcRenderer.invoke('batch-watermark', files, outputDir, config),
  batchConvert: (files: string[], outputDir: string, options: any) => ipcRenderer.invoke('batch-convert', files, outputDir, options),
  getJobStatus: (jobId: string) => ipcRenderer.invoke('get-job-status', jobId),
  getAllJobs: () => ipcRenderer.invoke('get-all-jobs'),
  getSupportedFormats: () => ipcRenderer.invoke('get-supported-formats'),

  detectDevices: () => ipcRenderer.invoke('detect-devices'),
  recognizeModel: (deviceInfo: any) => ipcRenderer.invoke('recognize-model', deviceInfo),
  autoConfigure: (portPath: string) => ipcRenderer.invoke('auto-configure', portPath),
  getTypewriterFingerprints: () => ipcRenderer.invoke('get-typewriter-fingerprints'),
  searchTypewriterModels: (query: string) => ipcRenderer.invoke('search-typewriter-models', query),
  identifyFromCharacteristics: (charWidth: number, hasSerif: boolean, lineHeight?: number) => ipcRenderer.invoke('identify-from-characteristics', charWidth, hasSerif, lineHeight),
  getManufacturers: () => ipcRenderer.invoke('get-manufacturers'),

  validateContent: (content: string) => ipcRenderer.invoke('validate-content', content),
  sanitizeContent: (content: string) => ipcRenderer.invoke('sanitize-content', content),
  detectEncoding: (content: string) => ipcRenderer.invoke('detect-encoding', content),
  batchExport: (items: any[], options: any) => ipcRenderer.invoke('batch-export', items, options),
  validateAndExport: (content: string, filePath: string, format: 'txt' | 'pdf', options: any) => ipcRenderer.invoke('validate-and-export', content, filePath, format, options),
  getConnectionStats: () => ipcRenderer.invoke('get-connection-stats'),
  getArchiveStats: () => ipcRenderer.invoke('get-archive-stats'),
  createTranscription: (content: string, typewriterModel?: string, fontStyle?: string, encoding?: string) => ipcRenderer.invoke('create-transcription', content, typewriterModel, fontStyle, encoding),
  getTranscriptions: () => ipcRenderer.invoke('get-transcriptions'),

  startCollectionSession: (typewriterModel?: string) => ipcRenderer.invoke('start-collection-session', typewriterModel),
  endCollectionSession: () => ipcRenderer.invoke('end-collection-session'),
  getCurrentSession: () => ipcRenderer.invoke('get-current-session'),
  correctCharacter: (sessionId: string, index: number, correction: string) => ipcRenderer.invoke('correct-character', sessionId, index, correction)
});
