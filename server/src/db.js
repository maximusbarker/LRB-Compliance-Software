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
      county TEXT,
      agency TEXT,
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
      finalized_at TEXT,
      finalized_by_user_id TEXT,
      finalized_by_name TEXT,
      finalized_ip TEXT,
      finalized_user_agent TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS submission_events (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL,
      org_id TEXT NOT NULL,
      user_id TEXT,
      event_type TEXT NOT NULL,
      changed_fields_json TEXT,
      payload_snapshot_json TEXT,
      ip TEXT,
      user_agent TEXT,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
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

    CREATE TABLE IF NOT EXISTS generated_reports (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      submission_id TEXT,
      user_id TEXT NOT NULL,
      report_type TEXT NOT NULL,
      filename TEXT NOT NULL,
      stored_path TEXT NOT NULL,
      county TEXT,
      agency TEXT,
      project TEXT,
      year INTEGER,
      file_size INTEGER,
      mime_type TEXT DEFAULT 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orgs_code ON organizations(code);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_submissions_org ON submissions(org_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_year ON submissions(year);
    CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
    CREATE INDEX IF NOT EXISTS idx_submission_events_submission ON submission_events(submission_id);
    CREATE INDEX IF NOT EXISTS idx_submission_events_org ON submission_events(org_id);
    CREATE INDEX IF NOT EXISTS idx_submission_events_type ON submission_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_tax_rates_org_submission ON tax_rates(org_id, submission_id);
    CREATE INDEX IF NOT EXISTS idx_tax_rates_year ON tax_rates(year);
    CREATE INDEX IF NOT EXISTS idx_reports_org ON generated_reports(org_id);
    CREATE INDEX IF NOT EXISTS idx_reports_submission ON generated_reports(submission_id);
    CREATE INDEX IF NOT EXISTS idx_reports_county_agency_project ON generated_reports(county, agency, project);
    CREATE INDEX IF NOT EXISTS idx_reports_type ON generated_reports(report_type);
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

  // Ensure generated_reports table exists (migration for existing databases)
  try {
    const reportTableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='generated_reports'
    `).get();
    
    if (!reportTableExists) {
      db.exec(`
        CREATE TABLE generated_reports (
          id TEXT PRIMARY KEY,
          org_id TEXT NOT NULL,
          submission_id TEXT,
          user_id TEXT NOT NULL,
          report_type TEXT NOT NULL,
          filename TEXT NOT NULL,
          stored_path TEXT NOT NULL,
          county TEXT,
          agency TEXT,
          project TEXT,
          year INTEGER,
          file_size INTEGER,
          mime_type TEXT DEFAULT 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
          FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_reports_org ON generated_reports(org_id);
        CREATE INDEX IF NOT EXISTS idx_reports_submission ON generated_reports(submission_id);
        CREATE INDEX IF NOT EXISTS idx_reports_county_agency_project ON generated_reports(county, agency, project);
        CREATE INDEX IF NOT EXISTS idx_reports_type ON generated_reports(report_type);
      `);
      console.log('[db] Created generated_reports table');
    }
  } catch (error) {
    console.log('[db] Migration note for generated_reports:', error.message);
  }

  // Migration: Add county and agency columns to users table if they don't exist
  try {
    const userColumns = db.prepare("PRAGMA table_info(users)").all();
    const userColumnNames = userColumns.map(c => c.name);
    
    if (!userColumnNames.includes('county')) {
      db.exec('ALTER TABLE users ADD COLUMN county TEXT');
      console.log('[db] Added county column to users table');
    }
    if (!userColumnNames.includes('agency')) {
      db.exec('ALTER TABLE users ADD COLUMN agency TEXT');
      console.log('[db] Added agency column to users table');
    }
    
    // Add indexes for county/agency lookups
    try {
      db.exec('CREATE INDEX IF NOT EXISTS idx_users_county_agency ON users(county, agency)');
    } catch (idxError) {
      // Index might already exist, that's okay
    }
  } catch (error) {
    console.log('[db] Migration note for users county/agency:', error.message);
  }

  // Migration: Ensure submissions columns exist (older DBs)
  try {
    const submissionColumns = db.prepare("PRAGMA table_info(submissions)").all();
    const submissionColumnNames = submissionColumns.map(c => c.name);

    if (!submissionColumnNames.includes('status')) {
      db.exec("ALTER TABLE submissions ADD COLUMN status TEXT DEFAULT 'submitted'");
      console.log('[db] Added status column to submissions table');
    }
    if (!submissionColumnNames.includes('finalized_at')) {
      db.exec('ALTER TABLE submissions ADD COLUMN finalized_at TEXT');
    }
    if (!submissionColumnNames.includes('finalized_by_user_id')) {
      db.exec('ALTER TABLE submissions ADD COLUMN finalized_by_user_id TEXT');
    }
    if (!submissionColumnNames.includes('finalized_by_name')) {
      db.exec('ALTER TABLE submissions ADD COLUMN finalized_by_name TEXT');
    }
    if (!submissionColumnNames.includes('finalized_ip')) {
      db.exec('ALTER TABLE submissions ADD COLUMN finalized_ip TEXT');
    }
    if (!submissionColumnNames.includes('finalized_user_agent')) {
      db.exec('ALTER TABLE submissions ADD COLUMN finalized_user_agent TEXT');
    }

    // Indexes (safe to re-run)
    try {
      db.exec('CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status)');
    } catch (_) {}
  } catch (error) {
    console.log('[db] Migration note for submissions finalize fields:', error.message);
  }

  // Migration: Ensure submission_events columns exist (older DBs)
  try {
    const eventColumns = db.prepare("PRAGMA table_info(submission_events)").all();
    const eventColumnNames = eventColumns.map(c => c.name);
    if (!eventColumnNames.includes('payload_snapshot_json')) {
      db.exec('ALTER TABLE submission_events ADD COLUMN payload_snapshot_json TEXT');
      console.log('[db] Added payload_snapshot_json column to submission_events table');
    }
  } catch (error) {
    console.log('[db] Migration note for submission_events payload snapshot:', error.message);
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


