import 'dotenv/config';
import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveDbPath(relativePath) {
  if (!relativePath) return null;
  return path.isAbsolute(relativePath)
    ? relativePath
    : path.resolve(__dirname, '..', relativePath);
}

const sourceArg = process.argv[2] || 'dev.db';
const destinationArg = process.argv[3] || process.env.DATABASE_URL?.replace('sqlite://', '') || 'dev_fullscrape.db';

const sourcePath = resolveDbPath(sourceArg);
const destinationPath = resolveDbPath(destinationArg);

if (!sourcePath || !destinationPath) {
  console.error('[migrate-db] Missing source or destination path');
  process.exit(1);
}

console.log('[migrate-db] Source      :', sourcePath);
console.log('[migrate-db] Destination :', destinationPath);

const srcDb = new Database(sourcePath, { readonly: true });
const destDb = new Database(destinationPath);

const tablesToCopy = ['organizations', 'users', 'submissions', 'uploads'];

function copyTable(tableName) {
  const rows = srcDb.prepare(`SELECT * FROM ${tableName}`).all();
  console.log(`[migrate-db] Table ${tableName}: ${rows.length} row(s) to copy`);
  
  if (rows.length === 0) return;
  
  const columns = Object.keys(rows[0]);
  const placeholders = columns.map(() => '?').join(', ');
  const insertSql = `INSERT OR IGNORE INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`;
  const insertStmt = destDb.prepare(insertSql);
  
  const insertMany = destDb.transaction((rowsBatch) => {
    rowsBatch.forEach((row) => {
      const values = columns.map((col) => row[col]);
      insertStmt.run(values);
    });
  });
  
  insertMany(rows);
  console.log(`[migrate-db] Table ${tableName}: copied ${rows.length} row(s)`);
}

try {
  tablesToCopy.forEach(copyTable);
  console.log('[migrate-db] Migration complete.');
  process.exit(0);
} catch (error) {
  console.error('[migrate-db] Failed:', error);
  process.exit(1);
}

