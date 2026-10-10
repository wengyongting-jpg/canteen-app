// SQLite 连接与建表（better-sqlite3，CommonJS）
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'canteen.db');

let db = null;

function getDb() {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  createTables(db);
  return db;
}

function createTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS canteens (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS windows (
      id INTEGER PRIMARY KEY,
      canteen_id INTEGER NOT NULL REFERENCES canteens(id),
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS dishes (
      id INTEGER PRIMARY KEY,
      window_id INTEGER NOT NULL REFERENCES windows(id),
      name TEXT NOT NULL,
      price REAL NOT NULL,
      taste_tags TEXT NOT NULL DEFAULT '[]',
      allergens TEXT NOT NULL DEFAULT '[]',
      allergen_status TEXT NOT NULL DEFAULT 'unconfirmed'
        CHECK (allergen_status IN ('contains','confirmed_free','unconfirmed')),
      diet_tags TEXT NOT NULL DEFAULT '[]',
      listed_at TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_synthetic INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY,
      dish_id INTEGER NOT NULL REFERENCES dishes(id),
      user_id TEXT NOT NULL,
      score_taste INTEGER NOT NULL CHECK (score_taste BETWEEN 1 AND 5),
      score_value INTEGER NOT NULL CHECK (score_value BETWEEN 1 AND 5),
      score_portion INTEGER NOT NULL CHECK (score_portion BETWEEN 1 AND 5),
      comment TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'normal' CHECK (status IN ('normal','blocked')),
      is_synthetic INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      preferences TEXT NOT NULL DEFAULT '{}',
      allergens TEXT NOT NULL DEFAULT '[]',
      diet_restrictions TEXT NOT NULL DEFAULT '[]'
    );
    CREATE INDEX IF NOT EXISTS idx_reviews_dish ON reviews(dish_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_user_dish ON reviews(user_id, dish_id);
    CREATE INDEX IF NOT EXISTS idx_dishes_window ON dishes(window_id);
  `);
}

module.exports = { getDb, DB_PATH };
