const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'items.db');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    value REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS value_history (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    value REAL NOT NULL,
    recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
  );
`);

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_history_unique
    ON value_history(item_id, value);
  `);

// Migrate older databases that don't have the newer columns yet.
const existingColumns = db.prepare('PRAGMA table_info(items)').all().map((col) => col.name);
if (!existingColumns.includes('image_url')) {
  db.exec('ALTER TABLE items ADD COLUMN image_url TEXT');
}
if (!existingColumns.includes('demand')) {
  db.exec("ALTER TABLE items ADD COLUMN demand TEXT NOT NULL DEFAULT 'Medium'");
}
if (!existingColumns.includes('exist_count')) {
  db.exec('ALTER TABLE items ADD COLUMN exist_count INTEGER NOT NULL DEFAULT 0');
}
// Separate, purely visual rarity used only to color the background pentagon on item cards.
// Has nothing to do with the existing item data above.
if (!existingColumns.includes('pentagon_rarity')) {
  db.exec("ALTER TABLE items ADD COLUMN pentagon_rarity TEXT NOT NULL DEFAULT 'Ultimate'");
}
// Real in-game rarity, describing how rare/hard-to-find an item is for a player. Independent
// from the pentagon color above and from demand.
if (!existingColumns.includes('rarity')) {
  db.exec("ALTER TABLE items ADD COLUMN rarity TEXT NOT NULL DEFAULT 'Common'");
}

// Ensure all items have at least one history record
const itemsWithoutHistory = db.prepare(`
  SELECT items.id, items.value FROM items
  LEFT JOIN value_history ON items.id = value_history.item_id
  WHERE value_history.id IS NULL
`).all();

itemsWithoutHistory.forEach(item => {
  db.prepare(`INSERT INTO value_history (id, item_id, value) VALUES (?, ?, ?)`).run(crypto.randomUUID(),item.id, item.value);
});

const VALID_DEMANDS = [
  'Lack of Circulation',
  'Very Low',
  'Low',
  'Medium',
  'High',
  'Very High'
];

function normalizeDemand(demand) {
  const value = String(demand || '').trim();
  const match = VALID_DEMANDS.find((option) => option.toLowerCase() === value.toLowerCase());
  return match || 'Medium';
}

function normalizeExistCount(existCount) {
  const value = Number(existCount);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value);
}

function cleanImageUrl(url) {
  if (!url) return '';

  const match = String(url)
    .trim()
    .match(/^.*?\.(png|jpg|jpeg|gif|webp)/i);

  return match ? match[0] : String(url).trim();
}

const allItems = db.prepare(
  'SELECT id, image_url FROM items'
).all();

const updateImage = db.prepare(
  'UPDATE items SET image_url = ? WHERE id = ?'
);

allItems.forEach(item => {
  const cleaned = cleanImageUrl(item.image_url);

  if (cleaned !== item.image_url) {
    updateImage.run(cleaned, item.id);
  }
});

// Purely visual pentagon color (Common/Rare/Legendary/Mythical/Ultimate). Not related to any
// other rarity concept - its only effect is the colored pentagon behind the item image.
const PENTAGON_RARITIES = ['Ultimate', 'Mythical', 'Legendary', 'Rare', 'Common', 'Unique'];

function normalizePentagonRarity(pentagonRarity) {
  const value = String(pentagonRarity || '').trim();
  const match = PENTAGON_RARITIES.find(
    (option) => option.toLowerCase() === value.toLowerCase()
  );

  return match || 'Ultimate';
}

// Real in-game rarity (Common/Rare/Very Rare/Extinct), describing how rare an item is to find
// for a player. Purely informational - independent from demand and from the pentagon color.
const VALID_RARITIES = ['Common', 'Rare', 'Very Rare', 'Extinct'];

function normalizeRarity(rarity) {
  const value = String(rarity || '').trim();
  const match = VALID_RARITIES.find((option) => option.toLowerCase() === value.toLowerCase());
  return match || 'Common';
}

const defaultItems = [
  { name: 'Common Sword', value: 25.5, imageUrl: '', demand: 'Medium', existCount: 0, rarity: 'Common', pentagonRarity: 'Common' },
  { name: 'Rare Ring', value: 47.0, imageUrl: '', demand: 'High', existCount: 0, rarity: 'Rare', pentagonRarity: 'Common' },
  { name: 'Legendary Shield', value: 120.0, imageUrl: '', demand: 'High', existCount: 0, rarity: 'Very Rare', pentagonRarity: 'Common' },
  { name: 'Gold Potion', value: 14.2, imageUrl: '', demand: 'Low', existCount: 0, rarity: 'Common', pentagonRarity: 'Common' },
  { name: 'Dragon Scale', value: 88.4, imageUrl: '', demand: 'Medium', existCount: 0, rarity: 'Extinct', pentagonRarity: 'Common' }
];

const countRow = db.prepare('SELECT COUNT(*) AS count FROM items').get();
if (countRow.count === 0) {
  const insert = db.prepare(
    'INSERT INTO items (id, name, value, image_url, demand, exist_count, rarity, pentagon_rarity) VALUES (@id, @name, @value, @imageUrl, @demand, @existCount, @rarity, @pentagonRarity)'
  );
  const insertMany = db.transaction((rows) => {
    rows.forEach((row) => insert.run({ id: crypto.randomUUID(), ...row }));
  });
  insertMany(defaultItems);
}

function getAllItems() {
  return db
    .prepare('SELECT id, name, value, image_url AS imageUrl, demand, exist_count AS existCount, rarity, pentagon_rarity AS pentagonRarity FROM items ORDER BY value DESC, name COLLATE NOCASE ASC')
    .all();
}

function searchItems(query) {
  if (!query) return getAllItems();
  if (query === '?') {
    return db
      .prepare(
        'SELECT id, name, value, image_url AS imageUrl, demand, exist_count AS existCount, rarity, pentagon_rarity AS pentagonRarity FROM items WHERE image_url IS NULL OR TRIM(image_url) = ? ORDER BY value DESC, name COLLATE NOCASE ASC'
      )
      .all('');
  }
  return db
    .prepare(
      'SELECT id, name, value, image_url AS imageUrl, demand, exist_count AS existCount, rarity, pentagon_rarity AS pentagonRarity FROM items WHERE name LIKE ? ORDER BY value DESC, name COLLATE NOCASE ASC'
    )
    .all(`%${query}%`);
}

function createItem({ name, value, imageUrl, demand, existCount, rarity, pentagonRarity }) {
  const id = crypto.randomUUID();
  const normalizedDemand = normalizeDemand(demand);
  const normalizedExistCount = normalizeExistCount(existCount);
  const normalizedRarity = normalizeRarity(rarity);
  const normalizedPentagonRarity = normalizePentagonRarity(pentagonRarity);
  const cleanUrl = cleanImageUrl(imageUrl);
  db.prepare('INSERT INTO items (id, name, value, image_url, demand, exist_count, rarity, pentagon_rarity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
  id,
  name,
  value,
  cleanUrl,
  normalizedDemand,
  normalizedExistCount,
  normalizedRarity,
  normalizedPentagonRarity
);
  // Record initial value history
  db.prepare('INSERT OR IGNORE INTO value_history (id, item_id, value) VALUES (?, ?, ?)').run(crypto.randomUUID(),id,value);
  return {
    id,
    name,
    value,
    imageUrl: cleanUrl,
    demand: normalizedDemand,
    existCount: normalizedExistCount,
    rarity: normalizedRarity,
    pentagonRarity: normalizedPentagonRarity
  };
}

function createItemsBulk(rows) {
  const insert = db.prepare(
    'INSERT INTO items (id, name, value, image_url, demand, exist_count, rarity, pentagon_rarity) VALUES (@id, @name, @value, @imageUrl, @demand, @existCount, @rarity, @pentagonRarity)'
  );
  const insertHistory = db.prepare('INSERT OR IGNORE INTO value_history (id, item_id, value) VALUES (?, ?, ?)');
  const insertMany = db.transaction((items) => {
    items.forEach((item) => {
      const itemId = crypto.randomUUID();
      insert.run({
        id: itemId,
        name: item.name,
        value: item.value,
        imageUrl: cleanImageUrl(item.imageUrl),
        demand: normalizeDemand(item.demand),
        existCount: normalizeExistCount(item.existCount),
        rarity: normalizeRarity(item.rarity),
        pentagonRarity: normalizePentagonRarity(item.pentagonRarity)
      });
      insertHistory.run(crypto.randomUUID(),itemId, item.value);
    });
  });
  insertMany(rows);
  return rows.length;
}

function deleteItem(id) {
  const result = db.prepare('DELETE FROM items WHERE id = ?').run(id);
  return result.changes > 0;
}

function updateItem(id, { name, value, imageUrl, demand, existCount, rarity, pentagonRarity }) {
  const normalizedDemand = normalizeDemand(demand);
  const normalizedExistCount = normalizeExistCount(existCount);
  const normalizedRarity = normalizeRarity(rarity);
  const normalizedPentagonRarity = normalizePentagonRarity(pentagonRarity);
  const cleanUrl = cleanImageUrl(imageUrl);

  const existingItem = db
    .prepare('SELECT value FROM items WHERE id = ?')
    .get(id);

  const valueChanged =
    Number(existingItem?.value) !== Number(value);

  const result = db
    .prepare('UPDATE items SET name = ?, value = ?, image_url = ?, demand = ?, exist_count = ?, rarity = ?, pentagon_rarity = ? WHERE id = ?')
    .run(
      name,
      value,
      cleanUrl,
      normalizedDemand,
      normalizedExistCount,
      normalizedRarity,
      normalizedPentagonRarity,
      id
    );

  if (result.changes === 0) return null;

  if (valueChanged) {
    const lastHistory = db.prepare(`
      SELECT value
      FROM value_history
      WHERE item_id = ?
      ORDER BY rowid DESC
      LIMIT 1
    `).get(id);

    if (!lastHistory || Number(lastHistory.value) !== Number(value)) {
      db.prepare(`
        INSERT OR IGNORE INTO value_history (
          id,
          item_id,
          value
        ) VALUES (?, ?, ?)
      `).run(
        crypto.randomUUID(),
        id,
        value
      );
    }
  }

  return {
    id,
    name,
    value,
    imageUrl: cleanUrl,
    demand: normalizedDemand,
    existCount: normalizedExistCount,
    rarity: normalizedRarity,
    pentagonRarity: normalizedPentagonRarity
  };
}

function getItemHistory(itemId) {
  return db.prepare(`
    SELECT value, recorded_at
    FROM value_history
    WHERE item_id = ?
    ORDER BY recorded_at ASC
  `).all(itemId);
}

module.exports = {
  getAllItems,
  searchItems,
  createItem,
  createItemsBulk,
  updateItem,
  deleteItem,
  getItemHistory
};
