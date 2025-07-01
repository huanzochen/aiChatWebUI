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

// ====== History UI & API ======
const historyList = document.getElementById('historyList');
const newConversationBtn = document.getElementById('newConversationBtn');

let historyConversations = [];
let currentConversationId = null;

// 產生隨機 id
function randomId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// 取得前10字作為標題
function getTitleFromContent(content) {
  if (!content || !content.length) return '新對話';
  // 取 user/ai 對話合併的前10字
  const allText = content.map(m => m.content).join(' ');
  return allText.slice(0, 10) || '新對話';
}

// 載入歷史紀錄
async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    historyConversations = await res.json();
    renderHistoryList();
    // 不自動選擇任何 conversation
  } catch (e) {
    historyList.innerHTML = '<li style="color:red">無法載入歷史紀錄</li>';
  }
}

function renderHistoryList() {
  historyList.innerHTML = '';
  if (!historyConversations.length) {
    historyList.innerHTML = '<li style="color:#888">尚無紀錄</li>';
    return;
  }
  historyConversations.slice().reverse().forEach(convo => {
    const li = document.createElement('li');
    li.textContent = convo.title || '新對話';
    li.title = new Date(convo.updateTime || convo.createTime).toLocaleString();
    li.style.cursor = 'pointer';
    li.style.padding = '2px 4px';
    li.style.borderRadius = '3px';
    if (convo.id === currentConversationId) {
      li.style.background = '#e6f0ff';
      li.style.fontWeight = 'bold';
    }
    li.onclick = () => selectConversation(convo.id);
    historyList.appendChild(li);
  });
}

async function selectConversation(id) {
  currentConversationId = id;
  renderHistoryList();
  // 載入該 conversation 的內容
  const convo = historyConversations.find(c => c.id === id);
  if (convo) {
    // 清空現有訊息
    messages.length = 0;
    chatMessages.innerHTML = '';
    // 重新渲染對話內容
    convo.content.forEach(msg => {
      appendMessage(msg.content, msg.role === 'assistant' ? 'ai' : 'user');
      messages.push({ role: msg.role, content: msg.content });
    });
  }
}

// 新增新對話
async function createNewConversation() {
  const now = Date.now();
  const newConvo = {
    id: randomId(),
    createTime: now,
    updateTime: now,
    title: '新對話',
    content: []
  };
  try {
    await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConvo)
    });
    await loadHistory();
    selectConversation(newConvo.id);
  } catch (e) {
    alert('建立新對話失敗');
  }
}

newConversationBtn.addEventListener('click', createNewConversation);

// 頁面載入時自動載入歷史
loadHistory();
// 頁面載入時清空訊息區與 messages
chatMessages.innerHTML = '';
messages.length = 0;
currentConversationId = null;

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

    // ====== 首次發送訊息時才建立新對話 ======
    if (!currentConversationId) {
      // 建立新對話
      const now = Date.now();
      const newConvo = {
        id: randomId(),
        createTime: now,
        updateTime: now,
        title: getTitleFromContent(messages),
        content: [...messages]
      };
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConvo)
      });
      if (res.ok) {
        currentConversationId = newConvo.id;
        await loadHistory();
      } else {
        alert('建立新對話失敗');
      }
    } else {
      // 後續訊息直接更新
      const now = Date.now();
      const updatedContent = [...messages];
      const title = getTitleFromContent(updatedContent);
      await fetch(`/api/history/${currentConversationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updateTime: now,
          title,
          content: updatedContent
        })
      });
      await loadHistory();
    }
    // ====== END ======
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
