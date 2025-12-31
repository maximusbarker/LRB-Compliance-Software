import { scrapeAllUtahTaxRates } from '../src/scrapers/utahTaxRates.js';
import { db } from '../src/db.js';

const args = process.argv.slice(2);
const taxYear = process.env.TAX_YEAR ? parseInt(process.env.TAX_YEAR, 10) : 2025;

const org = db.prepare('SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1').get();
if (!org) {
  console.error('[scrape-counties] No organization found. Run migrations/seed first.');
  process.exit(1);
}

const counties = args.length ? args : null;

console.log('[scrape-counties] Starting scrape');
console.log('  Tax Year :', taxYear);
console.log('  Org ID   :', org.id);
console.log('  Counties :', counties ? counties.join(', ') : 'ALL (no filter)');

try {
  const results = await scrapeAllUtahTaxRates({
    taxYear,
    orgId: org.id,
    countyFilters: counties,
    onProgress: (county, agency, project, ratesCount) => {
      console.log(`[scrape-counties] ${county} > ${agency} > ${project}: ${ratesCount} new rate(s)`);
    }
  });
  
  console.log('[scrape-counties] Completed scrape');
  console.log('  Counties available :', results.availableCounties);
  console.log('  Counties processed :', results.totalCounties);
  console.log('  Agencies processed :', results.totalAgencies);
  console.log('  Projects processed :', results.totalProjects);
  console.log('  Rates stored       :', results.totalRates);
  console.log('  Errors             :', results.errors.length);
  if (results.errors.length) {
    results.errors.forEach((err) => console.error('   •', err));
  }
  process.exit(0);
} catch (error) {
  console.error('[scrape-counties] Scrape failed:', error);
  process.exit(1);
}

