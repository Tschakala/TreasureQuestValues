const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const db = require('./db');

const bcrypt = require('bcrypt');
const crypto = require('crypto');

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const ADMIN_PASSWORD_HASH = '$2b$12$LqePqdR/vAPyoXUa3IbSWOckV23xi9wXfON1CuDGtdUeuPSsSQ8Qe';

const sessions = new Map();

fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });

const app = express();
app.use(express.json());

app.post('/api/admin/login', async (req, res) => {
  const password = req.body.password || '';

  const ok = await bcrypt.compare(
    password,
    ADMIN_PASSWORD_HASH
  );

  if (!ok) {
    return res.status(401).json({
      error: 'Invalid password'
    });
  }

  const token = crypto.randomUUID();

  sessions.set(token, true);

  res.json({ token });
});

// CORS configuration
const corsOrigin = NODE_ENV === 'production' ? process.env.ALLOWED_ORIGIN || 'https://tq.tschakala.at' : '*';
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', corsOrigin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: NODE_ENV === 'production' ? '1d' : '0'
}));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

function requireAdmin(req, res, next) {
  const token = req.header('x-admin-token');

  if (!sessions.has(token)) {
    return res.status(401).json({
      error: 'Unauthorized'
    });
  }

  next();
}

function parseItemsFromBuffer(buffer, originalName) {
  const text = buffer.toString('utf-8');
  const isJson = originalName.toLowerCase().endsWith('.json');

  if (isJson) {
    const parsed = JSON.parse(text);
    const rows = Array.isArray(parsed) ? parsed : [];
    return rows
      .map((row) => ({
        name: String(row.name ?? '').trim(),
        value: Number(row.value),
        imageUrl: String(row.imageUrl ?? row.image_url ?? row.image ?? '').trim(),
        demand: String(row.demand ?? '').trim(),
        existCount: Number(row.existCount ?? row.exist_count ?? 0),
        rarity: String(row.rarity ?? '').trim(),
        pentagonRarity: String(row.pentagonRarity ?? row.pentagon_rarity ?? '').trim()
      }))
      .filter((row) => row.name && Number.isFinite(row.value) && row.value >= 0);
  }

  // CSV: expects header "name,value,imageUrl,demand,existCount" (header optional, case-insensitive)
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const firstCols = lines[0].split(',').map((c) => c.trim().toLowerCase());
  const hasHeader = firstCols.includes('name') && firstCols.includes('value');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines
    .map((line) => {
      const [name, value, imageUrl, demand, existCount, rarity, pentagonRarity] = line.split(',').map((c) => (c ?? '').trim());
      return {
        name,
        value: Number(value),
        imageUrl: imageUrl || '',
        demand: demand || '',
        existCount: Number(existCount || 0),
        rarity: rarity || '',
        pentagonRarity: pentagonRarity || ''
      };
    })
    .filter((row) => row.name && Number.isFinite(row.value) && row.value >= 0);
}

// More specific routes first
// GET /api/items/:id/history
app.get('/api/items/:id/history', (req, res) => {
  const history = db.getItemHistory(req.params.id);
  res.json(history);
});

// POST /api/items/upload  (multipart file: csv or json)
app.post('/api/items/upload', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  let rows;
  try {
    rows = parseItemsFromBuffer(req.file.buffer, req.file.originalname);
  } catch (err) {
    return res.status(400).json({ error: 'Could not parse file. Use CSV (name,value) or JSON array.' });
  }

  if (rows.length === 0) {
    return res.status(400).json({ error: 'No valid items found in file.' });
  }

  const inserted = db.createItemsBulk(rows);
  res.status(201).json({ inserted });
});

// Generic routes after specific ones
// GET /api/items?search=term
app.get('/api/items', (req, res) => {
  const search = (req.query.search || '').toString().trim();
  const items = db.searchItems(search);
  res.json(items);
});

// GET /api/items/:id (single item)
app.get('/api/items/:id', (req, res) => {
  const items = db.getAllItems();
  const item = items.find(i => i.id === req.params.id);
  if (!item) {
    return res.status(404).json({ error: 'Item not found.' });
  }
  res.json(item);
});

// POST /api/items  { name, value, imageUrl, demand, existCount, rarity, pentagonRarity }
app.post('/api/items', requireAdmin, (req, res) => {
  const name = String(req.body.name || '').trim();
  const value = Number(req.body.value);
  const imageUrl = String(req.body.imageUrl || '').trim();
  const demand = String(req.body.demand || '').trim();
  const existCount = Number(req.body.existCount ?? 0);
  const rarity = String(req.body.rarity || '').trim();
  const pentagonRarity = String(req.body.pentagonRarity || '').trim();

  if (!name || !Number.isFinite(value) || value < 0) {
    return res.status(400).json({ error: 'Invalid name or value.' });
  }

  const item = db.createItem({ name, value, imageUrl, demand, existCount, rarity, pentagonRarity });
  res.status(201).json(item);
});

// PUT /api/items/:id  { name, value, imageUrl, demand, existCount, rarity, pentagonRarity }
app.put('/api/items/:id', requireAdmin, (req, res) => {
  const name = String(req.body.name || '').trim();
  const value = Number(req.body.value);
  const imageUrl = String(req.body.imageUrl || '').trim();
  const demand = String(req.body.demand || '').trim();
  const existCount = Number(req.body.existCount ?? 0);
  const rarity = String(req.body.rarity || '').trim();
  const pentagonRarity = String(req.body.pentagonRarity || '').trim();

  if (!name || !Number.isFinite(value) || value < 0) {
    return res.status(400).json({ error: 'Invalid name or value.' });
  }

  const item = db.updateItem(req.params.id, { name, value, imageUrl, demand, existCount, rarity, pentagonRarity });
  if (!item) {
    return res.status(404).json({ error: 'Item not found.' });
  }
  res.json(item);
});

// DELETE /api/items/:id
app.delete('/api/items/:id', requireAdmin, (req, res) => {
  const deleted = db.deleteItem(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Item not found.' });
  }
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`✓ Server running in ${NODE_ENV} mode on port ${PORT}`);
  console.log(`✓ Frontend: http://localhost:${PORT}`);
  console.log(`✓ API: http://localhost:${PORT}/api`);
  console.log(`✓ Admin: http://localhost:${PORT}/admin.html`);
});
