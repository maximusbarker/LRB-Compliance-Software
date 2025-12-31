/**
 * Test script for Utah Tax Rates Scraper
 * Tests scraping with the Tooele County example
 */

import { scrapeUtahTaxRates } from './server/src/scrapers/utahTaxRates.js';
import { db } from './server/src/db.js';
import { v4 as uuid } from 'uuid';

// Get default org ID
const defaultOrg = db.prepare('SELECT id FROM organizations LIMIT 1').get();
if (!defaultOrg) {
  console.error('No organization found. Please ensure database is initialized.');
  process.exit(1);
}

const orgId = defaultOrg.id;

console.log('Starting scraper test...');
console.log('Parameters:');
console.log('  Tax Year: 2025');
console.log('  County: 23_TOOELE');
console.log('  Agency: Tooele City Redevelopment Agency');
console.log('  Project: 8017_1000 NORTH RETAIL COMMUNITY REINVESTMENT AREA');
console.log('  Org ID:', orgId);
console.log('');

try {
  const result = await scrapeUtahTaxRates({
    taxYear: 2025,
    county: '23_TOOELE',
    agency: 'Tooele City Redevelopment Agency',
    project: '8017_1000 NORTH RETAIL COMMUNITY REINVESTMENT AREA',
    orgId: orgId,
    submissionId: null // Master rates
  });
  
  console.log('✅ Scraping successful!');
  console.log('Result:', JSON.stringify(result, null, 2));
  
  // Display scraped rates
  if (result.rates && result.rates.length > 0) {
    console.log('\n📊 Scraped Tax Rates:');
    result.rates.forEach(rate => {
      console.log(`  - ${rate.entityName}:`);
      console.log(`    Primary Rate: ${rate.rate}`);
      if (rate.realPropertyRate) console.log(`    Real Property: ${rate.realPropertyRate}`);
      if (rate.personalPropertyRate) console.log(`    Personal Property: ${rate.personalPropertyRate}`);
      if (rate.centrallyAssessedRate) console.log(`    Centrally Assessed: ${rate.centrallyAssessedRate}`);
    });
  }
  
} catch (error) {
  console.error('❌ Scraping failed:');
  console.error(error);
  process.exit(1);
}

process.exit(0);


