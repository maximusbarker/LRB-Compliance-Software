/**
 * Create Test Submission Script
 * Creates a test submission with county, agency, and project data
 * to test TIF report generation with the new tax rate structure
 */

import Database from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Main async function
async function createTestSubmission() {
  // Load config - convert to file:// URL for Windows compatibility
  const configPath = path.join(__dirname, '../src/config.js');
  const configUrl = pathToFileURL(configPath).href;
  const config = await import(configUrl);
  const dbPath = config.default.database.filename;

  const db = new Database(dbPath);

  // Get available counties, agencies, and projects from tax_rates
  // First, find what org_id the tax rates are using
  const taxRateOrg = db.prepare(`
    SELECT DISTINCT org_id 
    FROM tax_rates 
    WHERE county IS NOT NULL AND agency IS NOT NULL AND project IS NOT NULL
    LIMIT 1
  `).get();
  
  if (!taxRateOrg) {
    console.error('\n❌ No tax rate data found with county/agency/project. Please run the scraper first.');
    db.close();
    process.exit(1);
  }
  
  const taxRateOrgId = taxRateOrg.org_id;
  console.log(`📋 Found tax rates for org_id: ${taxRateOrgId}`);
  
  const availableData = db.prepare(`
    SELECT DISTINCT county, agency, project, year
    FROM tax_rates
    WHERE org_id = ? 
      AND county IS NOT NULL AND agency IS NOT NULL AND project IS NOT NULL
    ORDER BY county, agency, project
    LIMIT 10
  `).all(taxRateOrgId);

  console.log('Available County/Agency/Project combinations:');
  availableData.forEach((row, idx) => {
    console.log(`  ${idx + 1}. ${row.county} > ${row.agency} > ${row.project} (Year: ${row.year})`);
  });

  if (availableData.length === 0) {
    console.error('\n❌ No tax rate data found with county/agency/project. Please run the scraper first.');
    db.close();
    process.exit(1);
  }

  // Use the first available combination
  const testData = availableData[0];
  console.log(`\n✅ Using: ${testData.county} > ${testData.agency} > ${testData.project}`);

  // Get or use the org_id that has tax rates (so submission matches tax rates)
  let org = db.prepare('SELECT id FROM organizations WHERE id = ?').get(taxRateOrgId);
  if (!org) {
    // If the org doesn't exist, create it with the same ID
    console.log('⚠️  Organization for tax rates not found. Creating organization...');
    db.prepare('INSERT INTO organizations (id, name, code) VALUES (?, ?, ?)').run(
      taxRateOrgId,
      'Test Organization',
      'TEST_ORG'
    );
    org = db.prepare('SELECT id FROM organizations WHERE id = ?').get(taxRateOrgId);
    console.log('✅ Created organization:', org.id);
  } else {
    console.log(`✅ Using existing organization: ${org.id}`);
  }

  // Get or create user_id
  let user = db.prepare('SELECT id FROM users WHERE org_id=? LIMIT 1').get(org.id);
  if (!user) {
    console.log('⚠️  No user found. Creating test user...');
    const userId = uuid();
    const testEmail = 'test@lrb.local';
    const testPassword = 'test123'; // Simple password for testing
    const passwordHash = await bcrypt.hash(testPassword, 10);
    
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, org_id) 
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, testEmail, passwordHash, 'user', org.id);
    
    user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    console.log('✅ Created test user:', user.id);
    console.log('   Email:', testEmail);
    console.log('   Password:', testPassword);
    console.log('   (This is a test user - use your actual admin account for production)');
  }

  // Create test submission payload with ALL fields needed for report generation
  const submissionPayload = {
  // Location data (multiple field names for compatibility)
  county: testData.county,
  submitterName: testData.agency,
  projectAreaName: testData.project,
  projectArea: testData.project, // Legacy field name
  city: testData.agency,
  cityCounty: testData.agency,
  client: testData.agency, // Alternative field name
  agency: testData.agency, // Alternative field name
  
  // Year (multiple field names)
  year: testData.year || 2025,
  fy: testData.year || 2025,
  ty: (testData.year || 2025) - 1, // Tax year typically previous year
  
  // Project Type and Purpose (for report generation)
  type: 'CDA', // CDA, RDA, EDA, etc.
  projectType: 'CDA', // Legacy field name
  purpose: 'Mixed-Use Development',
  projectPurpose: 'Mixed-Use Development', // Legacy field name
  taxingDistrict: 'Test Taxing District',
  
  // Property values (TIF fields)
  realPropertyValue: 50000000,
  personalPropertyValue: 0,
  centrallyAssessedValue: 10000000,
  baseValue: 40000000,
  baseTaxableValue: 40000000, // Legacy field name
  tyValue: 60000000,
  currentTaxableValue: 60000000, // Legacy field name
  valueIncrease: 20000000, // Calculated: tyValue - baseValue
  
  // Growth rates
  growthRates: JSON.stringify([
    { year: 2025, rate: 0.05 },
    { year: 2026, rate: 0.04 },
    { year: 2027, rate: 0.03 }
  ]),
  
  // Acreage (for Acreage Overview section)
  acreage: 100,
  developedAcreage: 60,
  undevelopedAcreage: 40,
  residentialAcreage: 30,
  totalAuthorizedHousingUnits: 150,
  
  // Tax entities (for report generation - need at least 2-3)
  taxEntityName_0: 'Test City',
  taxEntityRate_0: 0.0015,
  taxEntityRateYear_0: testData.year || 2025,
  taxEntityParticipationRate_0: 0.5,
  taxEntityRemittance_0: 0.25,
  taxEntityCapAmount_0: 1000000,
  taxEntityIncrementPaid_0: 125000,
  taxEntityRemainingAuthorized_0: 875000,
  
  taxEntityName_1: 'Test County',
  taxEntityRate_1: 0.0020,
  taxEntityRateYear_1: testData.year || 2025,
  taxEntityParticipationRate_1: 0.3,
  taxEntityRemittance_1: 0.15,
  taxEntityCapAmount_1: 500000,
  taxEntityIncrementPaid_1: 75000,
  taxEntityRemainingAuthorized_1: 425000,
  
  taxEntityName_2: 'Test School District',
  taxEntityRate_2: 0.0010,
  taxEntityRateYear_2: testData.year || 2025,
  taxEntityParticipationRate_2: 0.2,
  taxEntityRemittance_2: 0.10,
  taxEntityCapAmount_2: 300000,
  taxEntityIncrementPaid_2: 50000,
  taxEntityRemainingAuthorized_2: 250000,
  
  // Financial data (for Combined Budget section)
  fundBalance: 1000000,
  tyOriginalBudgetRevenues: 2000000,
  tyActualRevenue: 2100000,
  tyBaseYearRevenue: 500000,
  lifetimeRevenues: 50000000,
  lifetimeActualRevenues: 52000000,
  lifetimeBaseYearRevenues: 8000000,
  currentYearRevenue: 300000,
  fyIncrement: 300000, // Legacy field name
  
  // Revenue sources (for budget section)
  revenueSourceDescription_0: 'Property Tax Increment',
  revenueSource2025Actual_0: 300000,
  revenueSource2026Forecast_0: 320000,
  revenueSource2027Forecast_0: 340000,
  
  // Tax increment summary
  propertyTaxIncrementTotal: 300000,
  propertyTaxIncrementNpv: 285000,
  administrativeFeeTotal: 50000,
  administrativeFeeNpv: 47500,
  expenseTotal: 250000,
  expenseNpv: 237500,
  
  // Financial analysis
  administrativePercentage: 10,
  discountRate: 3,
  aggregateRemainingRevenue: 2000000,
  discountedAggregateRemainingRevenue: 1900000,
  totalAggregateExpense: 500000,
  totalAggregateExpenseAtNpv: 475000,
  
  // Governing Board (for Governing Board section)
  governingBoardName_0: 'John Smith',
  governingBoardTitle_0: 'Chairman',
  governingBoardName_1: 'Jane Doe',
  governingBoardTitle_1: 'Vice Chairman',
  governingBoardName_2: 'Bob Johnson',
  governingBoardTitle_2: 'Secretary',
  
  // Agency Staff (for Governing Board section)
  agencyStaffName_0: 'Alice Williams',
  agencyStaffTitle_0: 'Executive Director',
  agencyStaffName_1: 'Tom Brown',
  agencyStaffTitle_1: 'Finance Director',
  
  // Increment Distribution
  incrementEntity_0: 'Test City',
  incrementActual_0: 125000,
  incrementRemaining_0: 875000,
  
  // Project info
  projectName: testData.project,
  creationYear: 2020,
  baseYear: 2020,
  termLength: 30,
  startYear: 2021,
  expirationYear: 2045,
  remainingLife: 20,
  
  // Descriptions (for report sections)
  growthInAssessedValue: 'Test project area with mixed-use development including residential and commercial properties. Significant growth in assessed value due to new development including 150 residential units and 50,000 sq ft of commercial space.',
  descriptionGrowthAssessedValue: 'Test project area with mixed-use development including residential and commercial properties. Significant growth in assessed value due to new development including 150 residential units and 50,000 sq ft of commercial space.',
  descriptionOfBenefitsToTaxingEntities: 'Taxing entities benefit from increased property values and economic development. Revenue sharing provides funding for public services and infrastructure improvements.',
  descriptionSignificantDevelopment: 'Major mixed-use development with residential, commercial, and retail components. Infrastructure improvements completed including roads, utilities, and public spaces.',
  descriptionPlanFurthered: 'Development plan implementation on schedule. All phases completed as planned with strong community support and economic impact.',
  descriptionOtherIssues: 'No significant issues to report. Project proceeding as expected.',
    plannedUsesFundBalance: 'Infrastructure improvements, public facilities, economic development incentives, and administrative costs.'
  };

  // Insert submission
  const submissionId = uuid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO submissions (id, org_id, user_id, payload_json, year, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    submissionId,
    org.id,
    user.id,
    JSON.stringify(submissionPayload),
    submissionPayload.year,
    'submitted',
    now,
    now
  );

  console.log(`\n✅ Created test submission:`);
  console.log(`   ID: ${submissionId}`);
  console.log(`   County: ${testData.county}`);
  console.log(`   Agency: ${testData.agency}`);
  console.log(`   Project: ${testData.project}`);
  console.log(`   Year: ${submissionPayload.year}`);

  // Verify tax rates exist for this combination (use the same org_id as tax rates)
  const matchingRates = db.prepare(`
    SELECT COUNT(*) as count
    FROM tax_rates
    WHERE org_id = ? 
      AND county = ?
      AND agency = ?
      AND project = ?
      AND year = ?
  `).get(taxRateOrgId, testData.county, testData.agency, testData.project, testData.year);

  console.log(`\n📊 Tax rates matching this submission: ${matchingRates.count}`);

  if (matchingRates.count === 0) {
    console.warn('⚠️  WARNING: No tax rates found matching this county/agency/project/year combination.');
    console.warn('   The TIF report may not have tax rate data.');
  } else {
    console.log('✅ Tax rates found - TIF report should work correctly.');
  }

  // Show sample tax rates (use the same org_id as tax rates)
  const sampleRates = db.prepare(`
    SELECT entity_name, rate, real_property_rate, personal_property_rate, centrally_assessed_rate
    FROM tax_rates
    WHERE org_id = ? 
      AND county = ?
      AND agency = ?
      AND project = ?
      AND year = ?
    LIMIT 5
  `).all(taxRateOrgId, testData.county, testData.agency, testData.project, testData.year);

  if (sampleRates.length > 0) {
    console.log('\n📋 Sample tax rates:');
    sampleRates.forEach(rate => {
      console.log(`   ${rate.entity_name}: ${rate.rate} (Real: ${rate.real_property_rate || 'N/A'}, Personal: ${rate.personal_property_rate || 'N/A'}, Centrally: ${rate.centrally_assessed_rate || 'N/A'})`);
    });
  }

  console.log(`\n🎯 Next steps:`);
  console.log(`   1. Log into the application`);
  console.log(`   2. Navigate to the Internal Database tab`);
  console.log(`   3. Find submission ID: ${submissionId}`);
  console.log(`   4. Generate a TIF report for this submission`);
  console.log(`   5. Verify the report includes tax rate data`);

  db.close();
}

// Run the async function
createTestSubmission().catch(error => {
  console.error('❌ Error creating test submission:', error);
  process.exit(1);
});

