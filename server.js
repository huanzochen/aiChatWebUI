const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;
const HISTORY_PATH = path.join(__dirname, 'data', 'history.json');

app.use(cors());
app.use(express.json());

// 確保 data/history.json 存在
function ensureHistoryFile() {
  const dir = path.dirname(HISTORY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(HISTORY_PATH)) fs.writeFileSync(HISTORY_PATH, '[]', 'utf-8');
}

function readHistory() {
  ensureHistoryFile();
  return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8'));
}

function writeHistory(history) {
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2), 'utf-8');
}

// 取得所有 conversation
app.get('/api/history', (req, res) => {
  const history = readHistory();
  res.json(history);
});

// 取得單一 conversation
app.get('/api/history/:id', (req, res) => {
  const history = readHistory();
  const convo = history.find(h => h.id === req.params.id);
  if (!convo) return res.status(404).json({ error: 'Not found' });
  res.json(convo);
});

// 新增 conversation
app.post('/api/history', (req, res) => {
  const { id, createTime, updateTime, title, content } = req.body;
  if (!id || !createTime || !title || !content) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const history = readHistory();
  history.push({ id, createTime, updateTime, title, content });
  writeHistory(history);
  res.status(201).json({ success: true });
});

// 更新 conversation
app.put('/api/history/:id', (req, res) => {
  const { updateTime, title, content } = req.body;
  const history = readHistory();
  const idx = history.findIndex(h => h.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  if (updateTime) history[idx].updateTime = updateTime;
  if (title) history[idx].title = title;
  if (content) history[idx].content = content;
  writeHistory(history);
  res.json({ success: true });
});

// 靜態檔案服務
app.use(express.static(__dirname));

// 根目錄回傳 index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 