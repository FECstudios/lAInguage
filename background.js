chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    isImageTranslationEnabled: false,
    targetLanguage: 'es'
  });
  
    console.log('Extension installed');
  });
  
  // Helper function to inject content script
  async function ensureContentScriptInjected(tabId) {
    try {
      // Check if content script is already injected
      await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      return true;
    } catch (error) {
      // If content script is not injected, inject it
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content.js']
        });
        await chrome.scripting.insertCSS({
          target: { tabId },
          files: ['styles.css']
        });
        return true;
      } catch (error) {
        console.error('Failed to inject content script:', error);
        return false;
      }
    }
  }
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'translatePageText') {
      handleTranslatePageText(request.tabId, request.targetLanguage)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }
    if (request.action === 'initializeContentScript') {
      handleContentScriptInitialization(request.tabId)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep message channel open for async response
    }
  
    if (request.action === 'storeTranslationHistory') {
      storeTranslationHistory(request.data)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }
  
    if (request.action === 'getTranslationHistory') {
      getTranslationHistory()
        .then(history => sendResponse({ history }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }
  });
  
  async function handleContentScriptInitialization(tabId) {
    try {
      const success = await ensureContentScriptInjected(tabId);
      return { success };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  async function storeTranslationHistory(data) {
    try {
      await chrome.storage.sync.set({ translationHistory: data });
    } catch (error) {
      console.error('Error storing translation history:', error);
      throw error;
    }
  }
  
  async function getTranslationHistory() {
    try {
      const { translationHistory = [] } = await chrome.storage.sync.get('translationHistory');
      return translationHistory;
    } catch (error) {
      console.error('Error retrieving translation history:', error);
      throw error;
    }
  }
  async function translatePageText(tabId, sourceLanguage, targetLanguage) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        function: translatePage,
        args: [sourceLanguage, targetLanguage]
      });
    } catch (error) {
      console.error('Failed to translate page text:', error);
    }
  }

  async function handleTranslatePageText(request, sender, sendResponse) {
    const tabId = sender.tab.id;
    const { sourceLanguage, targetLanguage } = request.data;
  
    try {
      await translatePageText(tabId, sourceLanguage, targetLanguage);
      sendResponse({ success: true });
    } catch (error) {
      console.error('Failed to handle translate page text:', error);
      sendResponse({ success: false, error: error.message });
    }
  }