import { db } from '../src/db.js';

const tableExists = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tax_rates'")
  .get();

if (!tableExists) {
  console.log('[report-tax-rates] tax_rates table does not exist in current database.');
  process.exit(0);
}

const totals = db.prepare('SELECT COUNT(*) AS total FROM tax_rates').get();
const perCounty = db
  .prepare(`
    SELECT 
      county,
      COUNT(*) AS rate_rows,
      COUNT(DISTINCT agency) AS agencies,
      COUNT(DISTINCT project) AS projects
    FROM tax_rates
    WHERE county IS NOT NULL AND county != ''
    GROUP BY county
    ORDER BY county
  `)
  .all();

const perAgency = db
  .prepare(`
    SELECT 
      county,
      agency,
      COUNT(DISTINCT project) AS projects,
      COUNT(DISTINCT entity_name) AS entities,
      COUNT(*) AS rate_rows
    FROM tax_rates
    WHERE county IS NOT NULL AND county != '' AND agency IS NOT NULL AND agency != ''
    GROUP BY county, agency
    ORDER BY county, agency
  `)
  .all();

console.log('=== Tax Rate Summary ===');
console.log('Database file:', db.name || 'current connection');
console.log('Total tax_rate rows:', totals.total);
console.log('Total counties with data:', perCounty.length);
console.table(perCounty);

console.log('\n=== Agency Breakdown (all rows) ===');
console.table(perAgency);

console.log('\n[report-tax-rates] Done.');

