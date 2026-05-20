const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectImageFiles: () => ipcRenderer.invoke('select-image-files'),
  processImages: (params) => ipcRenderer.invoke('process-images', params),
  generateChords: (params) => ipcRenderer.invoke('generate-chords', params),
  exportMusicXML: (params) => ipcRenderer.invoke('export-musicxml', params),
  showSaveDialog: () => ipcRenderer.invoke('save-file-dialog'),
  saveScore: (scoreData) => ipcRenderer.invoke('save-score', scoreData),
  getScores: () => ipcRenderer.invoke('get-scores'),
  getScore: (id) => ipcRenderer.invoke('get-score', id),
  deleteScore: (id) => ipcRenderer.invoke('delete-score', id),
  savePlayRecord: (record) => ipcRenderer.invoke('save-play-record', record),
  getPlayRecords: (scoreId) => ipcRenderer.invoke('get-play-records', scoreId)
});
