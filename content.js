let isHighlighted = false;
let currentTranslator = null;
let translationHistory = [];

async function translateText(inputText, targetLanguage) {
    if (!inputText.trim()) {
      return "Please enter some text to translate.";
    }
  
    try {
      // First, translate from English to the selected target language
      const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(inputText)}&langpair=en|${targetLanguage}`);
      const data = await response.json();
  
      if (!data.responseData.translatedText) {
        return "Sorry, something went wrong with the translation.";
      }
  
      const translatedText = data.responseData.translatedText;
  
      // Now, retranslate from the target language back to English
      const retranslateResponse = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(translatedText)}&langpair=${targetLanguage}|en`);
      const retranslateData = await retranslateResponse.json();
  
      if (!retranslateData.responseData.translatedText) {
        return "Sorry, something went wrong with the retranslation.";
      }
  
      const retranslatedText = retranslateData.responseData.translatedText;
  
      // Return both translations
      return {
        originalTranslation: translatedText,
        retranslatedToEnglish: retranslatedText
      };
    } catch (error) {
      return "Error: Unable to fetch translation.";
    }
  }
  async function translateText2(inputText, targetLanguage) {
    try {
      // Check AI capabilities
      const capabilities = await chrome.aiOriginTrial.languageModel.capabilities();
  
      if (capabilities.available === 'no') {
        console.error("AI NOT AVAILABLE");
        return "Error: AI not available.";
      }
  
      // Create a session
      const session = await chrome.aiOriginTrial.languageModel.create({
        temperature: capabilities.defaultTemperature,
        topK: capabilities.defaultTopK,
        systemPrompt: 'You are a helpful AI specializing in accurate translations.',
      });
  
      // Construct the prompt
      const prompt = `
        Translate the following text into ${targetLanguage}. Provide the translation as a single word or phrase without additional comments:
        "${inputText}"
      `;
  
      // Prompt the model and wait for the result
      const result = await session.prompt(prompt);
      const translatedText = result.trim();
  
      // Retranslate the text to English
      const retranslateResponse = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(translatedText)}&langpair=${targetLanguage}|en`
      );
      const retranslateData = await retranslateResponse.json();
  
      if (!retranslateData.responseData.translatedText) {
        return "Sorry, something went wrong with the retranslation.";
      }
  
      const retranslatedText = retranslateData.responseData.translatedText;
  
      // Return both translations
      return {
        originalTranslation: translatedText,
        retranslatedToEnglish: retranslatedText,
      };
    } catch (error) {
      console.error("Error occurred:", error);
      return "Error: Unable to fetch translation.";
    }
  }
  

// Function to store translation in history
function addToHistory(original, translated, targetLang) {
  translationHistory.unshift({
    timestamp: new Date().toISOString(),
    original,
    translated,
    targetLang,
    verified: false
  });
  
  // Keep only last 10 translations
  if (translationHistory.length > 10) {
    translationHistory.pop();
  }
}

// Mock translation function (replace with real translation when available)
async function detectSourceLanguage(text) {
    const canDetect = await translation.canDetect();
    let detector;
    if (canDetect !== 'no') {
      if (canDetect === 'readily') {
        // The language detector can immediately be used
        detector = await translation.createDetector();
      } else {
        // The language detector can be used after the model download
        detector = await translation.createDetector();
        detector.addEventListener('downloadprogress', (e) => {
          console.log(`Model download progress: ${e.loaded}/${e.total}`);
        });
        await detector.ready;
      }
      try {
      const results = await detector.detect(text);
      return results[0].detectedLanguage;
      }catch (error) {
        console.warn('Language detection failed, defaulting to English', error);
        return 'en';
      }
    } else {
      // The language detector can't be used at all
      return null;
    }
  }
  
  // Translate text using the Translation API
  async function translateTextAI(text, targetLanguage) {
    const canTranslate = await translation.canTranslate({ sourceLanguage: await detectSourceLanguage(text), targetLanguage });
    console.log(await detectSourceLanguage(text))
    let translator;
    if (canTranslate !== 'no') {
      if (canTranslate === 'readily') {
        // The translator can immediately be used
        console.log("Creating")
        translator = await translation.createTranslator({ sourceLanguage: await detectSourceLanguage(text), targetLanguage });
      } else {
        console.log("Download first")
        translator = await translation.createTranslator({ sourceLanguage: await detectSourceLanguage(text), targetLanguage });
        translator.addEventListener('downloadprogress', (e) => {
          console.log(e.loaded, e.total);
        });
        await translator.ready;
    
      }
      const skibi = await translator.translate(text);
      return skibi;
    } else {
      // The translator can't be used at all
      return `[Translation not available - ${targetLanguage}]`;
    }
  }

async function handleInputClick(event) {
  event.preventDefault();
  const input = event.target;
  
  // Remove any existing translation UI
  const existingUI = document.querySelector('.translation-ui');
  if (existingUI) {
    existingUI.remove();
  }
  
  // Create translation UI container
  const uiContainer = document.createElement('div');
  uiContainer.className = 'translation-ui';
  uiContainer.style.cssText = `
    position: absolute;
    top: ${input.getBoundingClientRect().bottom + window.scrollY}px;
    left: ${input.getBoundingClientRect().left + window.scrollX}px;
    z-index: 10000;
    background: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 8px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    min-width: 300px;
  `;

  // Add header for suggestions
  const suggestionHeader = document.createElement('div');
  suggestionHeader.textContent = 'Translate';
  suggestionHeader.style.cssText = `
    font-weight: bold;
    margin-bottom: 10px;
    padding-bottom: 5px;
    border-bottom: 1px solid #eee;
  `;
  uiContainer.appendChild(suggestionHeader);
  
  // Create language buttons
  const languages = [
    { code: 'es', name: 'Spanish' },
    { code: 'ja', name: 'Japanese' }
  ];
  
  // Add history button
  const historyButton = document.createElement('button');
  historyButton.textContent = 'Show History';
  historyButton.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 2px 8px;
    background: #666;
    color: white;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
  `;
  
  historyButton.addEventListener('click', () => {
    showTranslationHistory(uiContainer);
  });
  
  uiContainer.appendChild(historyButton);
  
  for (const lang of languages) {
    const button = document.createElement('button');
    button.textContent = `Translate to ${lang.name}`;
    button.style.cssText = `
      display: block;
      margin: 5px;
      padding: 5px 10px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      width: calc(100% - 10px);
    `;
    
    button.addEventListener('click', async () => {
      try {
        const originalText = input.value;
        if (!originalText.trim()) return;

        button.disabled = true;
        button.textContent = 'Translating...';
        
        // Mock translation (replace with real translation API)
        const translatedText = await translateTextAI(originalText, lang.code);
        const backTranslation = await translateTextAI(translatedText, 'en');
        console.log("backTranslation", backTranslation)
        // Store in history
        addToHistory(originalText, translatedText, lang.code);
        
        // Create result container
        const resultContainer = document.createElement('div');
        resultContainer.style.cssText = `
          margin-top: 10px;
          padding: 8px;
          background: #f5f5f5;
          border-radius: 4px;
          display: flex;
          flex-direction: column;
          gap: 10px; /* Add spacing between result sections */
        `;
        
        
        // Add translations
        resultContainer.innerHTML = `
        <div style="margin-bottom: 4px;">Original: ${originalText}</div>
        <div style="margin-bottom: 4px;">${lang.name}: ${translatedText}</div>
        <div style="margin-bottom: 4px;">Back to English: ${backTranslation}</div>
      `;
        
        // Add verification popup
        const verificationPopup = document.createElement('div');
        verificationPopup.style.cssText = `
          position: relative;
          background: #f8f8f8;
          padding: 5px;
          border-radius: 3px;
          border: 1px solid #ddd;
          font-size: 12px;
          margin-top: 10px; /* Ensure there's space between result and verification */
        `;
        
        verificationPopup.innerHTML = `
        <div style="margin-bottom: 5px;">Did you mean to translate this?</div>
        <div style="display: flex; gap: 10px; justify-content: flex-start;">
          <button class="verify-btn" style="margin-right: 5px;">✓</button>
          <button class="reject-btn">✗</button>
        </div>
      `;
        
        verificationPopup.querySelector('.verify-btn').addEventListener('click', () => {
            input.value = translatedText;
            verificationPopup.remove();
        });
        verificationPopup.querySelector('.reject-btn').addEventListener('click', async () => {
            // Hide the tick and cross buttons
            verificationPopup.style.display = 'none';
          
            // Create a container for the options buttons
            const optionsContainer = document.createElement('div');
            optionsContainer.style.cssText = `
              display: flex;
              justify-content: space-around;
              margin-top: 10px;
              gap: 10px;
            `;
          
            // Perform the translation asynchronously
            const result1 = await translateText(originalText, lang.code);
            const result2 = await translateText2(originalText, lang.code);
            // Handle the translation result
            if (typeof result1 === 'string') {
              console.log(result1); // Log any error message
            } else {
              console.log('Original Translation:', result1.originalTranslation);
              console.log('Retranslated to English:', result1.retranslatedToEnglish);
            }
          
            // Define the options to display
            const options = [
              'Translation: ' + result1.originalTranslation + ' Retranslated to English: ' + result1.retranslatedToEnglish,
              'Translation: ' + result2.originalTranslation + ' Retranslated to English: ' + result2.retranslatedToEnglish,
            ];
          
            // Create and append buttons for each option
            options.forEach(optionText => {
              const button = document.createElement('button');
              button.textContent = optionText;
              button.style.cssText = `
                padding: 10px 15px;
                font-size: 16px;
                background: #4CAF50;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                transition: background 0.3s;
              `;
          
              // Add click event to each button
              button.addEventListener('click', () => {
                // Extract the originalTranslation part from the optionText
                const originalTranslationStart = optionText.indexOf('Translation: ') + 'Translation: '.length;
                const originalTranslationEnd = optionText.indexOf(' Retranslated to English:');
                const originalTranslation = optionText.substring(originalTranslationStart, originalTranslationEnd);
            
                input.value = originalTranslation; // Set the input value to the originalTranslation
                optionsContainer.remove(); // Remove the buttons container
              });
          
              optionsContainer.appendChild(button); // Append the button to the container
            });
          
            // Create the feedback "x" button
            const feedbackButton = document.createElement('button');
            feedbackButton.textContent = '✗';
            feedbackButton.style.cssText = `
              padding: 8px 12px;
              font-size: 14px;
              background: #f44336;
              color: white;
              border: none;
              border-radius: 5px;
              cursor: pointer;
              transition: background 0.3s;
            `;
          
            // Function to display the feedback form
            function showFeedbackForm(container) {
              const feedbackForm = document.createElement('div');
              feedbackForm.style.cssText = `
                margin-top: 10px;
                padding: 8px;
                background: white;
                border: 1px solid #ddd;
                border-radius: 4px;
              `;
          
              feedbackForm.innerHTML = `
                <textarea 
                  placeholder="Please explain what's wrong with the translation..."
                  style="width: 100%; margin-bottom: 5px; padding: 5px;"
                  rows="3"
                ></textarea>
                <button style="background: #4CAF50; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">
                  Submit Feedback
                </button>
              `;
          
              // Handle feedback submission
              feedbackForm.querySelector('button').addEventListener('click', () => {
                const feedback = feedbackForm.querySelector('textarea').value;
                console.log('Translation feedback:', feedback);
                // Simulate feedback submission
                feedbackForm.innerHTML = '<div style="color: green;">Thank you for your feedback!</div>';
                setTimeout(() => feedbackForm.remove(), 2000); // Remove form after a delay
              });
          
              container.appendChild(feedbackForm); // Append the form to the container
            }
          
            // Add event to show the feedback form
            feedbackButton.addEventListener('click', () => {
              showFeedbackForm(resultContainer); // Show the feedback form
            });
          
            // Append the feedback button and options container to the result container
            optionsContainer.appendChild(feedbackButton);
            resultContainer.appendChild(optionsContainer);
          });
          
          // Attach everything to the UI container
          uiContainer.appendChild(resultContainer);
          uiContainer.appendChild(verificationPopup);
          
        
      } catch (error) {
        console.error('Translation error:', error);
        const errorMsg = document.createElement('div');
        errorMsg.textContent = 'Translation failed. Please try again.';
        errorMsg.style.color = 'red';
        uiContainer.appendChild(errorMsg);
      } finally {
        button.disabled = false;
        button.textContent = `Translate to ${lang.name}`;
      }
    });
    
    uiContainer.appendChild(button);
  }
  
  document.body.appendChild(uiContainer);
  
  // Close UI when clicking outside
  document.addEventListener('click', function closeUI(e) {
    if (!uiContainer.contains(e.target) && e.target !== input) {
      uiContainer.remove();
      document.removeEventListener('click', closeUI);
    }
  });
}

// Function to show translation history
function showTranslationHistory(container) {
  const historyContainer = document.createElement('div');
  historyContainer.style.cssText = `
    position: absolute;
    top: 40px;
    right: 8px;
    background: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 8px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    max-height: 300px;
    overflow-y: auto;
    width: 250px;
    z-index: 10001;
  `;
  
  if (translationHistory.length === 0) {
    historyContainer.innerHTML = '<div style="color: #666;">No translation history yet</div>';
  } else {
    translationHistory.forEach((item, index) => {
      const historyItem = document.createElement('div');
      historyItem.style.cssText = `
        padding: 5px;
        border-bottom: 1px solid #eee;
        font-size: 12px;
        ${index === translationHistory.length - 1 ? 'border-bottom: none;' : ''}
      `;
      
      const date = new Date(item.timestamp).toLocaleString();
      historyItem.innerHTML = `
        <div style="color: #666; margin-bottom: 2px;">${date}</div>
        <div style="margin-bottom: 2px;">From: ${item.original}</div>
        <div>To (${item.targetLang}): ${item.translated}</div>
      `;
      
      historyContainer.appendChild(historyItem);
    });
  }
  
  container.appendChild(historyContainer);
  
  // Close history when clicking outside
  function closeHistory(e) {
    if (!historyContainer.contains(e.target)) {
      historyContainer.remove();
      document.removeEventListener('click', closeHistory);
    }
  }
  
  setTimeout(() => {
    document.addEventListener('click', closeHistory);
  }, 0);
}

// Toggle highlight functionality
function toggleHighlight() {
  const inputs = document.querySelectorAll(
    'input[type="text"], input[type="password"], textarea'
  );
  
  inputs.forEach(input => {
    if (isHighlighted) {
      input.classList.add('highlight-input');
      input.addEventListener('click', handleInputClick);
    } else {
      input.classList.remove('highlight-input');
      input.removeEventListener('click', handleInputClick);
    }
  });
}
function extractTextNodes(node) {
  const textNodes = [];
  
  function traverse(node) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
      textNodes.push(node);
    } else {
      for (let child of node.childNodes) {
        traverse(child);
      }
    }
  }
  
  traverse(node);
  return textNodes;
}

// Translate the entire page
async function translateEntirePage(targetLanguage) {
  try {
    // Extract all text nodes
    const textNodes = extractTextNodes(document.body);
    
    // Translate each text node
    for (let textNode of textNodes) {
      const originalText = textNode.textContent;
      
      // Skip very short or empty text
      if (originalText.trim().length < 2) continue;
      
      try {
        const translatedText = await translateTextAI(originalText, targetLanguage);
        
        // Create a new text node with translated text
        const translatedTextNode = document.createTextNode(translatedText);
        textNode.parentNode.replaceChild(translatedTextNode, textNode);
      } catch (translateError) {
        console.error('Translation error for text:', originalText, translateError);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Page translation error:', error);
    return false;
  }
}
// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ status: 'ready' });
    return true;
  }
  if (request.action === 'translatePage') {
    translateEntirePage(request.targetLanguage)
      .then(success => {
        sendResponse({ 
          success: success,
          error: success ? null : 'Translation failed'
        });
      })
      .catch(error => {
        sendResponse({ 
          success: false, 
          error: error.message 
        });
      });
    
    return true; // Indicates we'll send response asynchronously
  }
  if (request.action === 'toggleHighlight') {
    isHighlighted = !isHighlighted;
    toggleHighlight();
    sendResponse({ isHighlighted });
    return true;
  }
});

// Create and show the AI explanation popup
async function showAIExplanationPopup(text, button) {
    // Create popup container
    const popup = createPopupElement(button);
    
    // Create and style tab container
    const { explainTab, translateTab, contentContainer } = createTabs(popup);
    
    // Create chat interface elements
    const { chatInput, sendButton, loadingIndicator } = createChatInterface();
    
    // Add close button
    const closeButton = createCloseButton(() => {
      popup.remove();
      button.remove();
    });
  
    // Handle AI interaction
    async function handleAIInteraction(prompt, isExplanation = true) {
      try {
        loadingIndicator.style.display = 'block';
        const { available } = await ai.languageModel.capabilities();
        
        if (available !== "no") {
          const session = await ai.languageModel.create({
            systemPrompt: isExplanation 
              ? "You are a helpful assistant that explains text clearly and concisely." 
              : "You are a helpful translator that provides accurate translations and explanations of nuances."
          });
  
          const userPrompt = isExplanation
            ? `Please explain this text: "${text}". ${prompt}`
            : `Please translate this text: "${text}" and explain any important nuances. ${prompt}`;
  
          const result = await session.prompt(userPrompt);
          
          contentContainer.innerHTML += `
            <div style="margin-bottom: 10px !important;">
              <strong>${isExplanation ? 'Explanation' : 'Translation'}:</strong>
              <p style="margin-top: 5px !important;">${result}</p>
            </div>
          `;
  
          session.destroy();
        }
      } catch (error) {
        contentContainer.innerHTML += `
          <div style="color: red !important; margin-bottom: 10px !important;">
            Error: ${error.message}
          </div>
        `;
      } finally {
        loadingIndicator.style.display = 'none';
      }
    }
  
    // Add event listeners
    sendButton.addEventListener('click', () => {
      const question = chatInput.value.trim();
      if (question) {
        handleAIInteraction(question, explainTab.style.borderBottom.includes('4CAF50'));
        chatInput.value = '';
      }
    });
  
    // Tab click handlers
    explainTab.addEventListener('click', () => {
      updateTabStyles(explainTab, translateTab);
      contentContainer.innerHTML = '';
      handleExplainTabOpen(text, contentContainer);
    });
    handleExplainTabOpen(text, contentContainer);
  
    translateTab.addEventListener('click', () => {
      updateTabStyles(translateTab, explainTab);
      contentContainer.innerHTML = '';
      handleAIInteraction('', false);
    });
  
    // Assemble popup
    const chatContainer = document.createElement('div');
    chatContainer.style.cssText = 'border-top: 1px solid #ddd !important; padding-top: 15px !important;';
    chatContainer.append(chatInput, sendButton, loadingIndicator);
    popup.append(chatContainer, closeButton);
    document.body.appendChild(popup);
  
    // Initial explanation
    handleAIInteraction('', true);
  
    // Handle clicking outside
    setTimeout(() => {
      document.addEventListener('click', (e) => {
        if (!popup.contains(e.target) && !button.contains(e.target)) {
          popup.remove();
          button.remove();
        }
      });
    }, 100);
  
    return popup;
  }


  function createPopupElement(button) {
    const buttonRect = button.getBoundingClientRect();
    const popup = document.createElement('div');
    popup.className = 'explanation-popup';
    popup.style.cssText = `
      position: fixed;
      top: ${buttonRect.bottom + 5}px;
      left: ${buttonRect.left}px;
      background: white !important;
      border: 2px solid #4CAF50 !important;
      border-radius: 4px !important;
      padding: 20px !important;
      box-shadow: 0 4px 8px rgba(0,0,0,0.2) !important;
      z-index: 9999999 !important;
      min-width: 300px !important;
      max-width: 400px !important;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      pointer-events: auto !important;
    `;
    return popup;
  }
  
  function createTab(label, isActive = false) {
    const tab = document.createElement('div');
    tab.textContent = label;
    tab.style.cssText = `
      padding: 8px 15px !important;
      cursor: pointer !important;
      ${isActive ? 'border-bottom: 2px solid #4CAF50 !important; color: #4CAF50 !important;' : 'color: #666 !important;'}
    `;
    return tab;
  }
  
  function createTabs(popup) {
    const tabContainer = document.createElement('div');
    tabContainer.style.cssText = `
      display: flex !important;
      margin-bottom: 15px !important;
      border-bottom: 1px solid #ddd !important;
    `;
  
    const explainTab = createTab('Explain', true);
    const translateTab = createTab('Translate');
    
    const contentContainer = document.createElement('div');
    contentContainer.style.cssText = `
      margin-bottom: 15px !important;
      max-height: 200px !important;
      overflow-y: auto !important;
    `;
  
    tabContainer.appendChild(explainTab);
    tabContainer.appendChild(translateTab);
    popup.appendChild(tabContainer);
    popup.appendChild(contentContainer);
  
    return { explainTab, translateTab, contentContainer };
  }
  async function handleExplainTabOpen(text, contentContainer) {
    try {
      // Clear previous content
      contentContainer.innerHTML = '';
  
      // Check AI availability
      const { available } = await ai.languageModel.capabilities();
      
      if (available !== "no") {
        const session = await ai.languageModel.create({
          systemPrompt: "You are a helpful dictionary and language assistant. Provide a clear, concise definition, word type, and brief context for the given text."
        });
  
        // Get word meaning
        const meaningPrompt = `Provide a detailed explanation for the word or phrase: "${text}". Include:
        1. Definition
        2. Part of speech
        3. Example usage
        4. Any interesting etymology or context`;
  
        const result = await session.prompt(meaningPrompt);
        
        // Display result
        contentContainer.innerHTML = `
          <div style="margin-bottom: 10px !important;">
            <strong>Word Meaning:</strong>
            <p style="margin-top: 5px !important; white-space: pre-wrap;">${result}</p>
          </div>
        `;
  
        session.destroy();
      }
    } catch (error) {
      contentContainer.innerHTML += `
        <div style="color: red !important; margin-bottom: 10px !important;">
          Error: ${error.message}
        </div>
      `;
    }
  }

  function createChatInterface() {
    const chatInput = document.createElement('textarea');
    chatInput.placeholder = 'Ask a question about this text...';
    chatInput.style.cssText = `
      width: 100% !important;
      padding: 8px !important;
      margin-bottom: 10px !important;
      border: 1px solid #ddd !important;
      border-radius: 4px !important;
      resize: vertical !important;
      min-height: 60px !important;
    `;
  
    const sendButton = document.createElement('button');
    sendButton.textContent = 'Send';
    sendButton.style.cssText = `
      background: #4CAF50 !important;
      color: white !important;
      border: none !important;
      border-radius: 4px !important;
      padding: 8px 16px !important;
      cursor: pointer !important;
      float: right !important;
    `;
  
    const loadingIndicator = document.createElement('div');
    loadingIndicator.style.cssText = `
      display: none;
      color: #666 !important;
      margin-top: 10px !important;
      text-align: center !important;
    `;
    loadingIndicator.textContent = 'AI is thinking...';
  
    return { chatInput, sendButton, loadingIndicator };
  }
  
  function createCloseButton(onClose) {
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.cssText = `
      position: absolute !important;
      top: 5px !important;
      right: 5px !important;
      background: none !important;
      border: none !important;
      font-size: 20px !important;
      cursor: pointer !important;
      color: #666 !important;
      padding: 5px !important;
      line-height: 1 !important;
    `;
    closeButton.addEventListener('click', onClose);
    return closeButton;
  }
  
  function updateTabStyles(activeTab, inactiveTab) {
    activeTab.style.borderBottom = '2px solid #4CAF50 !important';
    activeTab.style.color = '#4CAF50';
    inactiveTab.style.borderBottom = 'none';
    inactiveTab.style.color = '#666';
  }

  
  // Handle AI interaction
  async function handleAIInteraction(prompt, isExplanation = true) {
    try {
      loadingIndicator.style.display = 'block';
      const { available } = await ai.languageModel.capabilities();
      
      if (available !== "no") {
        const session = await ai.languageModel.create({
          systemPrompt: isExplanation 
            ? "You are a helpful assistant that explains text clearly and concisely." 
            : "You are a helpful translator that provides accurate translations and explanations of nuances."
        });

        // Initial prompt or user's custom prompt
        const userPrompt = isExplanation
          ? `Please explain this text: "${text}". ${prompt}`
          : `Please translate this text: "${text}" and explain any important nuances. ${prompt}`;

        const result = await session.prompt(userPrompt);
        
        // Display result
        contentContainer.innerHTML += `
          <div style="margin-bottom: 10px !important;">
            <strong>${isExplanation ? 'Explanation' : 'Translation'}:</strong>
            <p style="margin-top: 5px !important;">${result}</p>
          </div>
        `;

        session.destroy();
      }
    } catch (error) {
      contentContainer.innerHTML += `
        <div style="color: red !important; margin-bottom: 10px !important;">
          Error: ${error.message}
        </div>
      `;
    } finally {
      loadingIndicator.style.display = 'none';
    }
  }
 
  // Update the existing createExplanationButton function to use the new popup
  function createExplanationButton(selection) {
    console.log('Creating explanation button');
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    // Remove any existing buttons first
    const existingButtons = document.querySelectorAll('.explanation-button');
    existingButtons.forEach(button => button.remove());
    
    const button = document.createElement('button');
    button.textContent = 'Explain/Translate';
    button.className = 'explanation-button';
    
    button.style.cssText = `
      position: absolute;
      top: ${window.scrollY + rect.bottom + 5}px;
      left: ${window.scrollX + rect.left}px;
      background: #4CAF50 !important;
      color: white !important;
      border: none !important;
      border-radius: 4px !important;
      padding: 8px 16px !important;
      cursor: pointer !important;
      z-index: 999999 !important;
      font-size: 14px !important;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      pointer-events: auto !important;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2) !important;
    `;
    
    button.addEventListener('click', function(e) {
      console.log('Button clicked');
      e.preventDefault();
      e.stopPropagation();
      const selectedText = selection.toString().trim();
      showAIExplanationPopup(selectedText, this);
      return false;
    }, true);
    
    document.body.appendChild(button);
    return button;
  }


// Create and position the explanation button
function createExplanationButton(selection) {
    console.log('Creating explanation button');
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    // Remove any existing buttons first
    const existingButtons = document.querySelectorAll('.explanation-button');
    existingButtons.forEach(button => button.remove());
    
    const button = document.createElement('button');
    button.textContent = 'Explain/Translate';
    button.className = 'explanation-button';
    
    // Force visibility and high z-index
    button.style.cssText = `
      position: absolute;
      top: ${window.scrollY + rect.bottom + 5}px;
      left: ${window.scrollX + rect.left}px;
      background: #4CAF50 !important;
      color: white !important;
      border: none !important;
      border-radius: 4px !important;
      padding: 8px 16px !important;
      cursor: pointer !important;
      z-index: 999999 !important;
      font-size: 14px !important;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      pointer-events: auto !important;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2) !important;
    `;
    
    button.addEventListener('click', function(e) {
      console.log('Button clicked');
      e.preventDefault();
      e.stopPropagation();
      const selectedText = selection.toString().trim();
      showAIExplanationPopup(selectedText, this);
      return false;
    }, true);
    
    document.body.appendChild(button);
    
    // Add click listener to document to remove button when clicking elsewhere
    setTimeout(() => {
      document.addEventListener('mousedown', function hideButton(e) {
        if (!button.contains(e.target)) {
          button.remove();
          document.removeEventListener('mousedown', hideButton);
        }
      });
    }, 0);
    
    console.log('Button added to page');
    return button;
  }
  

  // Handle text selection
  document.addEventListener('mouseup', (e) => {
    // Don't show button if clicking on existing button or popup
    if (e.target.classList.contains('explanation-button') || 
        e.target.classList.contains('explanation-popup')) {
      return;
    }
    
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText) {
      console.log('Text selected:', selectedText);
      createExplanationButton(selection);
    }
  }, true);
  
  // Prevent text selection from being lost when clicking the button
  document.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('explanation-button') || 
        e.target.classList.contains('explanation-popup')) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  async function translatePage(targetLanguage) {
    const pageText = document.documentElement.outerHTML;
    const translatedText = await translateTextAI(pageText, targetLanguage);
  
    if (translatedText) {
      document.documentElement.outerHTML = translatedText;
    } else {
      console.error('Failed to translate page');
    }
  }

