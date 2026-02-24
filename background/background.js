/*
 * Background Service Worker
 * Handles messaging between popup, options, and content scripts,
 * manages extension state, and handles tab lifecycle.
 */

// Initialize default state on install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({
      enabled: false,
      showLabels: true,
      highlightParents: true,
      highlightChildren: true,
      parentDepth: 2,
      colorScheme: 'default',
      customColors: {
        self: '#2196F3',
        parent: '#FF9800',
        child: '#4CAF50'
      }
    });
  }
});

// Listen for messages from popup and options
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STATE') {
    chrome.storage.local.get([
      'enabled',
      'showLabels',
      'highlightParents',
      'highlightChildren',
      'parentDepth',
      'colorScheme',
      'customColors'
    ], (result) => {
      sendResponse(result);
    });
    return true; // async response
  }

  if (message.type === 'SET_STATE') {
    chrome.storage.local.set(message.payload, () => {
      // Broadcast state change to all content scripts in active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'STATE_CHANGED',
            payload: message.payload
          }).catch(() => {
            // Tab might not have content script loaded yet
          });
        }
      });
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'TOGGLE_ENABLED') {
    chrome.storage.local.get(['enabled'], (result) => {
      const newEnabled = !result.enabled;
      chrome.storage.local.set({ enabled: newEnabled }, () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'STATE_CHANGED',
              payload: { enabled: newEnabled }
            }).catch(() => {});
          }
        });
        sendResponse({ enabled: newEnabled });
      });
    });
    return true;
  }
});

// Update badge based on enabled state
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.enabled) {
    const enabled = changes.enabled.newValue;
    chrome.action.setBadgeText({ text: enabled ? 'ON' : '' });
    chrome.action.setBadgeBackgroundColor({ color: enabled ? '#4CAF50' : '#757575' });
  }
});