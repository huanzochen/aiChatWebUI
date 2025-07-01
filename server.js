
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Serve static files from current directory (including index.html)
app.use(express.static(path.join(__dirname)));

const historyFilePath = path.join(__dirname, 'data', 'history.json');

// Helper to read history file
function readHistory() {
  try {
    if (!fs.existsSync(historyFilePath)) {
      return {};
    }
    const data = fs.readFileSync(historyFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading history file:', err);
    return {};
  }
}

// Helper to write history file
function writeHistory(history) {
  try {
    fs.mkdirSync(path.dirname(historyFilePath), { recursive: true });
    fs.writeFileSync(historyFilePath, JSON.stringify(history, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing history file:', err);
  }
}

// GET /history - return all history
app.get('/history', (req, res) => {
  const history = readHistory();
  res.json(history);
});

// POST /history - update history object
app.post('/history', (req, res) => {
  const newHistory = req.body;
  if (typeof newHistory !== 'object') {
    return res.status(400).json({ error: 'Invalid history data' });
  }
  writeHistory(newHistory);
  res.json({ message: 'History updated' });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
