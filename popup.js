let currentTab = null;
let detectedLanguage = 'en';
const supportedTargetLanguages = ['en', 'es', 'ja'];
let targetLanguage = 'es';

async function initializeExtension() {
    try {
      // Get current tab
      [currentTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });

      if (!currentTab) {
        throw new Error('No active tab found');
      }

      // Initialize content script
      const result = await chrome.runtime.sendMessage({
        action: 'initializeContentScript',
        tabId: currentTab.id
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to initialize content script');
      }

      // Now that content script is ready, set up the button
      setupHighlightButton();

    const languageSelect = document.getElementById('targetLanguageSelect');
    languageSelect.value = targetLanguage;
    languageSelect.addEventListener('change', (e) => {
      targetLanguage = e.target.value;
    });

    // Setup translate button
    const translateButton = document.getElementById('translateButton');
    translateButton.addEventListener('click', translatePage);
  } catch (error) {
    console.error('Initialization error:', error);
    document.getElementById('status').textContent = 'Error: ' + error.message;
  }
}

async function translatePage() {
  const status = document.getElementById('status');
  status.textContent = 'Translating page...';

  try {
    // Send message to content script to extract and translate page text
    const response = await chrome.tabs.sendMessage(currentTab.id, {
      action: 'translatePage',
      targetLanguage: targetLanguage
    });

    if (response) {
      status.textContent = 'Page translated successfully!';
    } else {
      status.textContent = 'Translation failed: ' + response.error;
    }
  } catch (error) {
    console.error('Translation error:', error);
    status.textContent = 'Error: ' + error.message;
  }
}

function setupHighlightButton() {
    const button = document.getElementById('highlightBtn');
    const status = document.getElementById('status');

    button.addEventListener('click', async () => {
      try {
        status.textContent = 'Sending command...';

        const response = await chrome.tabs.sendMessage(currentTab.id, {
          action: 'toggleHighlight'
        });

        button.textContent = response.isHighlighted ? 
          'Disable Highlighting' : 
          'Highlight Input Fields';
        status.textContent = '';
      } catch (error) {
        console.error('Toggle error:', error);
        status.textContent = 'Error: Could not toggle highlighting';

        // Try to reinitialize
        await initializeExtension();
      }
    });
  }

function extractTextFromPage(pageText) {
    // Use a library or regular expressions to extract text from the HTML
    // For example, the following code uses a simple regular expression to extract text
    return pageText.match(/<[^>]>(.?)<\/[^>]>/g)?.map(elm => elm.replace(/<[^>]>/g, '')).join(' ') || '';
  }

  async function displaySummary(summary) {
    // Display the summary in the popup UI
    const summaryDiv = document.createElement('div');
    summaryDiv.id = 'summary';
    summaryDiv.textContent = summary;
    document.body.appendChild(summaryDiv);
  }

  function displayError(errorMessage) {
    // Display an error message in the popup UI
    document.getElementById('status').textContent = 'Error: ' + errorMessage;
  }



  document.addEventListener('DOMContentLoaded', initializeExtension);