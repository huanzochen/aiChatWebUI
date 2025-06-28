const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const apiKeyInput = document.getElementById('apiKeyInput');
const modelSelect = document.getElementById('modelSelect');

// Flag to control auto scrolling behavior
let autoScrollEnabled = true;

// Store chat history for multi-turn conversation
const messages = [];

// Load saved API key from localStorage if available
const savedApiKey = localStorage.getItem('openai_api_key');
if (savedApiKey) {
  apiKeyInput.value = savedApiKey;
}

// Sync systemPromptSelect and systemPromptTextarea
const systemPromptSelect = document.getElementById('systemPromptSelect');
const systemPromptTextarea = document.getElementById('systemPromptTextarea');

function syncPromptTextarea() {
  const selectedValue = systemPromptSelect.value;
  if (selectedValue === 'custom') {
    systemPromptTextarea.value = '';
    systemPromptTextarea.disabled = false;
  } else {
    systemPromptTextarea.value = selectedValue;
    systemPromptTextarea.disabled = true;
  }
}

systemPromptSelect.addEventListener('change', syncPromptTextarea);

// Initialize on page load
syncPromptTextarea();

// Auto resize textarea height
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 80) + 'px';
});

// Send message
async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  // Enable auto scroll when user sends a new message
  autoScrollEnabled = true;

  // Get API key and model
  const apiKey = apiKeyInput.value.trim();
  const model = modelSelect.value;

  if (!apiKey) {
    alert('Please enter your OpenAI API Key.');
    return;
  }

  // Save API key to localStorage
  localStorage.setItem('openai_api_key', apiKey);

  // Get system prompt from textarea or select
  const customPrompt = document.getElementById('systemPromptTextarea').value.trim();
  const selectedPrompt = document.getElementById('systemPromptSelect').value;
  const systemPromptContent = customPrompt || selectedPrompt || '你是一個使用繁體中文回答的助理。請用繁體中文回覆所有問題。';

  // Add user message to chat and history
  appendMessage(text, 'user');
  messages.push({ role: 'user', content: text });

  // Clear input immediately after adding message and history
  chatInput.value = '';
  chatInput.style.height = 'auto';

  // Show loading message
  const loadingMsg = appendMessage('...', 'ai');

  try {
    // Add system prompt for response
    const systemPrompt = {
      role: 'system',
      content: systemPromptContent
    };

    // Insert system prompt at the beginning of messages array for each request
    const requestMessages = [systemPrompt, ...messages];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: model,
        messages: requestMessages
      })
    });
    if (!response.ok) {
      throw new Error('API Error: ' + response.status);
    }

    const data = await response.json();
    const aiReply = data.choices?.[0]?.message?.content?.trim() || '[No response]';

    // Remove loading message and show AI reply
    loadingMsg.innerHTML = marked.parse(aiReply);
    messages.push({ role: 'assistant', content: aiReply });

    // Scroll to bottom once after AI reply is appended
    if (autoScrollEnabled) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  } catch (err) {
    loadingMsg.textContent = '[Error] ' + err.message;
  }
}

function appendMessage(text, role) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'chat-message' + (role === 'user' ? ' user' : '');
  // Render markdown for both AI and user messages without sanitization
  msgDiv.innerHTML = marked.parse(text);
  chatMessages.appendChild(msgDiv);
  if (autoScrollEnabled) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  return msgDiv;
}

  
// Listen for send button click
sendBtn.addEventListener('click', sendMessage);

// Detect user scroll to disable auto scroll if user scrolls up
chatMessages.addEventListener('scroll', () => {
  const threshold = 20; // px from bottom to consider as bottom
  const position = chatMessages.scrollTop + chatMessages.clientHeight;
  const height = chatMessages.scrollHeight;
  if (position < height - threshold) {
    autoScrollEnabled = false;
  } else {
    autoScrollEnabled = true;
  }
});

// Support sending on Enter (Shift+Enter for newline)
let isComposing = false;

chatInput.addEventListener('compositionstart', () => {
  isComposing = true;
});

chatInput.addEventListener('compositionend', () => {
  isComposing = false;
});

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
    e.preventDefault();
    sendMessage();
  }
});
