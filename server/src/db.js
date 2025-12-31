import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import config from './config.js';

const dbPath = config.database.filename;
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

function ensureSchema() {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      org_id TEXT NOT NULL,
      reset_token TEXT,
      reset_expires INTEGER,
      verified_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      year INTEGER,
      status TEXT DEFAULT 'submitted',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT,
      size INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tax_rates (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      submission_id TEXT,
      entity_name TEXT NOT NULL,
      year INTEGER NOT NULL,
      rate REAL NOT NULL,
      real_property_rate REAL,
      personal_property_rate REAL,
      centrally_assessed_rate REAL,
      county TEXT,
      agency TEXT,
      project TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_orgs_code ON organizations(code);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_submissions_org ON submissions(org_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_year ON submissions(year);
    CREATE INDEX IF NOT EXISTS idx_tax_rates_org_submission ON tax_rates(org_id, submission_id);
    CREATE INDEX IF NOT EXISTS idx_tax_rates_year ON tax_rates(year);
  `);
  
  // Migration: Add new columns if they don't exist
  try {
    const columns = db.prepare("PRAGMA table_info(tax_rates)").all();
    const columnNames = columns.map(c => c.name);
    
    if (!columnNames.includes('real_property_rate')) {
      db.exec('ALTER TABLE tax_rates ADD COLUMN real_property_rate REAL');
    }
    if (!columnNames.includes('personal_property_rate')) {
      db.exec('ALTER TABLE tax_rates ADD COLUMN personal_property_rate REAL');
    }
    if (!columnNames.includes('centrally_assessed_rate')) {
      db.exec('ALTER TABLE tax_rates ADD COLUMN centrally_assessed_rate REAL');
    }
    if (!columnNames.includes('county')) {
      db.exec('ALTER TABLE tax_rates ADD COLUMN county TEXT');
    }
    if (!columnNames.includes('agency')) {
      db.exec('ALTER TABLE tax_rates ADD COLUMN agency TEXT');
    }
    if (!columnNames.includes('project')) {
      db.exec('ALTER TABLE tax_rates ADD COLUMN project TEXT');
    }
  } catch (error) {
    // Table might not exist yet, that's okay
    console.log('[db] Migration note:', error.message);
  }
}

function seedDefaultOrg() {
  const existing = db.prepare('SELECT * FROM organizations LIMIT 1').get();
  if (!existing) {
    const id = uuid();
    const code = 'DEMO-CITY';
    db.prepare('INSERT INTO organizations (id, name, code) VALUES (?, ?, ?)').run(id, 'Demo City', code);
    console.log(`[db] Created default organization Demo City with code "${code}"`);
  }
}

ensureSchema();
seedDefaultOrg();

export { db };


