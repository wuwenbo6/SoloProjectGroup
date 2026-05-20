chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    enabled: true,
    highlightColor: '#fff3cd'
  });
});

chrome.action.onClicked.addListener((tab) => {
  chrome.storage.sync.get(['enabled'], (result) => {
    const newEnabled = !result.enabled;
    chrome.storage.sync.set({ enabled: newEnabled });
    
    chrome.tabs.sendMessage(tab.id, {
      action: 'toggleExtension',
      enabled: newEnabled
    });
  });
});
