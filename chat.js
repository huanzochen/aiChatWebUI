import { streamChatCompletion } from './streamOpenAI.js';

const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const apiKeyInput = document.getElementById('apiKeyInput');
const modelSelect = document.getElementById('modelSelect');

// Flag to control auto scrolling behavior
let autoScrollEnabled = true;

// Store chat history for multi-turn conversation
const messages = [];

// Store all conversation histories loaded from backend
let historyData = {};

// Current conversation id
let currentConversationId = null;

// Load saved API key from localStorage if available
const savedApiKey = localStorage.getItem('openai_api_key');
if (savedApiKey) {
  apiKeyInput.value = savedApiKey;
}

// Generate a unique ID for conversation
function generateId() {
  return '_' + Math.random().toString(36).substr(2, 9);
}

// Load history from backend
async function loadHistory() {
  try {
    const res = await fetch('http://localhost:3001/history');
    if (res.ok) {
      historyData = await res.json();
    } else {
      historyData = {};
    }
  } catch (err) {
    console.error('Failed to load history:', err);
    historyData = {};
  }
}

// Save history to backend
async function saveHistory() {
  try {
    await fetch('http://localhost:3001/history', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(historyData)
    });
  } catch (err) {
    console.error('Failed to save history:', err);
  }
}

// Create a new conversation history entry




function createNewConversation() {
  const id = generateId();
  currentConversationId = id;
  messages.length = 0; // clear current messages
  chatMessages.innerHTML = ''; // clear UI messages
  // Also update historyData to reflect new conversation (empty)
  // but do not save to backend yet (only save on first user message)
  historyData[id] = {
    id,
    createTime: new Date().toISOString(),
    updateTime: new Date().toISOString(),
    title: '',
    content: []
  };
  // Render history list after updating historyData
  renderHistoryList();

  // Clear messages array as well to keep in sync
  messages.length = 0;

  // Also clear chatMessages UI to ensure no residual messages
  chatMessages.innerHTML = '';
}

// Initialize history on page load


loadHistory().then(() => {
  renderHistoryList();
  const newConvBtn = document.getElementById('newConversationBtn');
  newConvBtn.addEventListener('click', () => {
    createNewConversation();
  });
});

// Render the history list in the UI
function renderHistoryList() {
  const historyListDiv = document.getElementById('historyList');
  historyListDiv.innerHTML = '';

  const entries = Object.values(historyData).sort((a, b) => new Date(b.updateTime) - new Date(a.updateTime));

  entries.forEach(entry => {
    const item = document.createElement('div');
    item.style.padding = '6px';
    item.style.borderBottom = '1px solid #eee';
    item.style.cursor = 'pointer';
    item.title = `Created: ${entry.createTime}\nUpdated: ${entry.updateTime}`;
    item.textContent = entry.title || '(No Title)';

    item.addEventListener('click', () => {
      loadConversation(entry.id);
    });

    historyListDiv.appendChild(item);
  });
}

// Load a conversation from history by id
function loadConversation(id) {
  const entry = historyData[id];
  if (!entry) return;

  currentConversationId = id;
  messages.length = 0;
  chatMessages.innerHTML = '';

  entry.content.forEach(msg => {
    appendMessage(msg.content, msg.role);
    messages.push(msg);
  });
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

  autoScrollEnabled = true;

  const apiKey = apiKeyInput.value.trim();
  const model = modelSelect.value;

  if (!apiKey) {
    alert('Please enter your OpenAI API Key.');
    return;
  }

  localStorage.setItem('openai_api_key', apiKey);

  const customPrompt = document.getElementById('systemPromptTextarea').value.trim();
  const selectedPrompt = document.getElementById('systemPromptSelect').value;
  const systemPromptContent = customPrompt || selectedPrompt || '你是一個使用繁體中文回答的助理。請用繁體中文回覆所有問題。';

  appendMessage(text, 'user');
  messages.push({ role: 'user', content: text });

  // On first user message, create new conversation in history if not exists
  if (!currentConversationId) {
    const id = generateId();
    currentConversationId = id;
    const now = new Date().toISOString();
    historyData[id] = {
      id,
      createTime: now,
      updateTime: now,
      title: text.substring(0, 10),
      content: [{ role: 'user', content: text }]
    };
      saveHistory();
      renderHistoryList();
    } else {
      // Update history content and title
      const historyEntry = historyData[currentConversationId];
      if (historyEntry) {
        historyEntry.content.push({ role: 'user', content: text });
        historyEntry.updateTime = new Date().toISOString();
        if (!historyEntry.title) {
          historyEntry.title = text.substring(0, 10);
        }
        saveHistory();
        renderHistoryList();
      }
    }

  chatInput.value = '';
  chatInput.style.height = 'auto';

  const loadingMsg = appendMessage('...', 'ai');

  try {
    const systemPrompt = {
      role: 'system',
      content: systemPromptContent
    };

    const requestMessages = [systemPrompt, ...messages];

    loadingMsg.innerHTML = '';

    const aiReply = await streamChatCompletion({
      apiKey,
      model,
      messages: requestMessages,
      onUpdate: (partial) => {
        loadingMsg.innerHTML = marked.parse(partial);
        if (autoScrollEnabled) {
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
      }
    });

    messages.push({ role: 'assistant', content: aiReply });

    // Update history content and title with AI reply
    if (currentConversationId) {
      const historyEntry = historyData[currentConversationId];
      if (historyEntry) {
        historyEntry.content.push({ role: 'assistant', content: aiReply });
        historyEntry.updateTime = new Date().toISOString();
        if (!historyEntry.title) {
          historyEntry.title = aiReply.substring(0, 10);
        }
        saveHistory();
      }
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
