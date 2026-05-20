const { ipcRenderer } = require('electron');

window.electronAPI = {
    openFileDialog: (filters) => ipcRenderer.invoke('open-file-dialog', filters),
    openMultipleFilesDialog: (filters) => ipcRenderer.invoke('open-multiple-files-dialog', filters),
    saveFileDialog: (filters) => ipcRenderer.invoke('save-file-dialog', filters),
    showSaveDialog: (filters) => ipcRenderer.invoke('save-file-dialog', filters),
    startRegistration: (sourceCloud, targetCloud, params) => 
        ipcRenderer.invoke('start-registration', sourceCloud, targetCloud, params),
    startTemporalRegistration: (frameClouds, params) =>
        ipcRenderer.invoke('start-temporal-registration', frameClouds, params),
    evaluateQuality: (sourceCloud, targetCloud, params) =>
        ipcRenderer.invoke('evaluate-quality', sourceCloud, targetCloud, params),
    cancelRegistration: () => ipcRenderer.invoke('cancel-registration'),
    onRegistrationProgress: (callback) => 
        ipcRenderer.on('registration-progress', (event, data) => callback(data)),
    onTemporalRegistrationProgress: (callback) =>
        ipcRenderer.on('temporal-registration-progress', (event, data) => callback(data))
};
