/**
 * Script to analyze formula-derived fields and their base data dependencies
 * Identifies what data is needed from forms vs. what comes from tax entity/rate imports
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelPath = path.join(__dirname, 'Learning Data', '1000 North Retail CRA Model 2025 (TIF Model Copy for Dad).xlsx');

console.log('Analyzing Formula Dependencies in Excel TIF Report');
console.log('='.repeat(80));

try {
    const workbook = XLSX.readFile(excelPath);
    const ws = workbook.Sheets['Updated Multi-Year Budget'];
    
    // Get all formulas and their dependencies
    const formulas = [];
    const cellValues = {};
    const cellFormulas = {};
    
    // First pass: collect all cell values and formulas
    Object.keys(ws).forEach(cell => {
        if (cell.startsWith('!')) return;
        const cellObj = ws[cell];
        cellValues[cell] = cellObj.v;
        if (cellObj.f) {
            cellFormulas[cell] = cellObj.f;
            formulas.push({
                cell,
                formula: cellObj.f,
                value: cellObj.v,
                type: cellObj.t
            });
        }
    });
    
    // Analyze key sections
    const analysis = {
        baseDataFields: {
            // From forms (project data)
            projectAreaName: { source: 'form', location: 'A1', description: 'Project Area Name' },
            totalAcreage: { source: 'form', location: 'AB11', description: 'Total Acreage (from form: acreage)' },
            baseYear: { source: 'form', location: 'C18-C19', description: 'Base Year Value (from form: baseValue)' },
            realPropertyValue: { source: 'form', location: 'C14', description: 'Real Property Assessed Value (TY value)' },
            personalPropertyValue: { source: 'form', location: 'C15', description: 'Personal Property Value' },
            centrallyAssessedValue: { source: 'form', location: 'C16', description: 'Centrally Assessed Value' },
            developedAcreage: { source: 'form', location: 'AB13', description: 'Developed Acreage (from form: developedAcreage)' },
            undevelopedAcreage: { source: 'form', location: 'AB14', description: 'Undeveloped Acreage (from form: undevelopedAcreage)' },
            
            // From tax entity/rate import (NOT in forms)
            taxRates: { source: 'import', location: 'C23-C25, D23-D25, etc.', description: 'Tax rates by entity and year (County, School District, City)' },
            taxEntities: { source: 'import', location: 'Various', description: 'Tax entity names and participation rates' },
            
            // Growth rates (may need to be calculated or input)
            growthRates: { source: 'calculated_or_input', location: 'C70-V70', description: 'Annual growth rates for projected years' }
        },
        derivedFields: [],
        missingFields: []
    };
    
    // Analyze formulas to understand dependencies
    console.log('\n=== FORMULA ANALYSIS ===\n');
    
    // Key formula patterns found:
    // 1. Real Property growth: D14 = C69 (base), E14 = D14*(1+D70) (growth projection)
    // 2. Total Assessed Value: C17 = C14 + C15 + C16
    // 3. Tax Increment Revenue: = (Assessed Value - Base Value) * Tax Rate
    // 4. Acreage percentages: AA13 = AB13/$AB$11 (developed %), AA14 = AB14/$AB$11 (undeveloped %)
    
    // Extract key data points from sample data
    const sampleData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    
    console.log('Key Data Points Found:');
    console.log('-'.repeat(80));
    
    // Find row indices for key sections
    let revenueRow = -1;
    let taxableValuationRow = -1;
    let realPropertyRow = -1;
    let personalPropertyRow = -1;
    let centrallyAssessedRow = -1;
    let totalAssessedRow = -1;
    let baseYearRow = -1;
    let taxRatesRow = -1;
    
    sampleData.forEach((row, idx) => {
        const rowStr = row.join(' ').toUpperCase();
        if (rowStr.includes('REVENUE') && rowStr.includes('TAXABLE')) {
            taxableValuationRow = idx;
        }
        if (rowStr.includes('REAL PROPERTY') && !rowStr.includes('BASE')) {
            realPropertyRow = idx;
        }
        if (rowStr.includes('PERSONAL PROPERTY') && !rowStr.includes('BASE')) {
            personalPropertyRow = idx;
        }
        if (rowStr.includes('CENTRALLY ASSESSED')) {
            centrallyAssessedRow = idx;
        }
        if (rowStr.includes('TOTAL ASSESSED VALUE') && !rowStr.includes('BASE')) {
            totalAssessedRow = idx;
        }
        if (rowStr.includes('BASE YEAR VALUE')) {
            baseYearRow = idx;
        }
        if (rowStr.includes('TAX RATE') || rowStr.includes('TOOELE COUNTY')) {
            taxRatesRow = idx;
        }
    });
    
    console.log(`Real Property Row: ${realPropertyRow + 1}`);
    console.log(`Personal Property Row: ${personalPropertyRow + 1}`);
    console.log(`Centrally Assessed Row: ${centrallyAssessedRow + 1}`);
    console.log(`Total Assessed Value Row: ${totalAssessedRow + 1}`);
    console.log(`Base Year Value Row: ${baseYearRow + 1}`);
    console.log(`Tax Rates Row: ${taxRatesRow + 1}`);
    
    // Analyze formulas for Real Property growth
    const realPropertyFormulas = formulas.filter(f => f.cell.match(/^[D-V]14$/));
    console.log('\n=== REAL PROPERTY GROWTH FORMULAS ===');
    realPropertyFormulas.slice(0, 5).forEach(f => {
        console.log(`${f.cell}: ${f.formula} = ${f.value}`);
    });
    console.log('Pattern: Each year = Previous Year * (1 + Growth Rate)');
    console.log('Base Data Needed:');
    console.log('  - Initial Real Property Value (from form: tyValue or realPropertyValue)');
    console.log('  - Growth Rates per year (from form: growthRates array OR calculated)');
    
    // Analyze tax increment calculations
    console.log('\n=== TAX INCREMENT CALCULATIONS ===');
    console.log('Tax Increment = (Total Assessed Value - Base Year Value) * Tax Rate');
    console.log('Base Data Needed:');
    console.log('  - Total Assessed Value (calculated: Real + Personal + Centrally)');
    console.log('  - Base Year Value (from form: baseValue)');
    console.log('  - Tax Rates (from import: tax entity rates by year)');
    
    // Analyze acreage calculations
    console.log('\n=== ACREAGE CALCULATIONS ===');
    const acreageFormulas = formulas.filter(f => f.cell.startsWith('AA') && (f.cell.includes('13') || f.cell.includes('14')));
    acreageFormulas.forEach(f => {
        console.log(`${f.cell}: ${f.formula} = ${f.value}`);
    });
    console.log('Pattern: % Developed = Developed Acreage / Total Acreage');
    console.log('Base Data Needed:');
    console.log('  - Total Acreage (from form: acreage)');
    console.log('  - Developed Acreage (from form: developedAcreage)');
    console.log('  - Undeveloped Acreage (from form: undevelopedAcreage)');
    
    // Check what's in the forms vs what's needed
    console.log('\n=== FIELD MAPPING ANALYSIS ===');
    console.log('\nFields in External Form:');
    const externalFormFields = [
        'acreage', 'creationYear', 'baseYear', 'termLength', 'startYear', 'expirationYear',
        'baseValue', 'fyIncrement', 'fundBalance', 'developedAcreage', 'undevelopedAcreage',
        'residentialAcreage', 'percentResidential', 'totalAuthorizedHousingUnits'
    ];
    externalFormFields.forEach(field => console.log(`  ✓ ${field}`));
    
    console.log('\nFields in Internal Form:');
    const internalFormFields = [
        'tyValue', 'valueIncrease', 'taxEntityName', 'taxEntityParticipationRate',
        'taxEntityRemittance', 'taxEntityCapAmount', 'taxEntityIncrementPaid',
        'taxEntityRemainingAuthorized', 'tyOriginalBudgetRevenues', 'tyActualRevenue',
        'tyBaseYearRevenue', 'lifetimeRevenues', 'lifetimeActualRevenues',
        'lifetimeBaseYearRevenues'
    ];
    internalFormFields.forEach(field => console.log(`  ✓ ${field}`));
    
    // Identify missing fields
    console.log('\n=== MISSING FIELDS ANALYSIS ===');
    const requiredForTIFReport = [
        { name: 'realPropertyValue', description: 'Real Property Assessed Value (separate from total)', status: 'partial', note: 'tyValue exists but may need separation' },
        { name: 'personalPropertyValue', description: 'Personal Property Assessed Value', status: 'missing', note: 'Not in forms - may be 0 for most projects' },
        { name: 'centrallyAssessedValue', description: 'Centrally Assessed Value', status: 'missing', note: 'Not in forms - needed for accurate totals' },
        { name: 'growthRates', description: 'Annual growth rates for projected years', status: 'missing', note: 'Needed for multi-year projections' },
        { name: 'taxRatesByEntity', description: 'Tax rates by entity and year', status: 'import', note: 'Will come from Excel/CSV import' },
        { name: 'taxEntityNames', description: 'Tax entity names', status: 'partial', note: 'taxEntityName exists but may need mapping' }
    ];
    
    requiredForTIFReport.forEach(field => {
        console.log(`\n${field.name}:`);
        console.log(`  Description: ${field.description}`);
        console.log(`  Status: ${field.status}`);
        console.log(`  Note: ${field.note}`);
    });
    
    // Generate field mapping document
    const mappingDoc = {
        excelReportStructure: {
            sheets: ['Updated Multi-Year Budget', 'Sheet1', 'Annual Budget', 'Acreage'],
            keySections: {
                multiYearBudget: {
                    realProperty: 'Row 14',
                    personalProperty: 'Row 15',
                    centrallyAssessed: 'Row 16',
                    totalAssessed: 'Row 17',
                    baseYearValue: 'Row 18-19',
                    taxRates: 'Row 23-25',
                    growthRates: 'Row 70',
                    taxIncrementRevenue: 'Calculated from assessed values and tax rates'
                },
                acreage: {
                    developed: 'Row 3',
                    undeveloped: 'Row 4',
                    total: 'Row 5',
                    percentDeveloped: 'Row 6 (calculated)',
                    percentUndeveloped: 'Row 7 (calculated)'
                }
            }
        },
        formFieldMapping: {
            externalForm: {
                acreage: { mapsTo: 'Total Acreage', usedIn: ['Acreage sheet', 'Percentage calculations'] },
                baseValue: { mapsTo: 'Base Year Value', usedIn: ['Tax increment calculations'] },
                developedAcreage: { mapsTo: 'Developed Acreage', usedIn: ['Acreage sheet', 'Percentage calculations'] },
                undevelopedAcreage: { mapsTo: 'Undeveloped Acreage', usedIn: ['Acreage sheet', 'Percentage calculations'] },
                fundBalance: { mapsTo: 'Fund Balance', usedIn: ['Financial summaries'] }
            },
            internalForm: {
                tyValue: { mapsTo: 'Total Assessed Value', usedIn: ['Multi-year budget', 'Tax increment calculations'], note: 'May need to split into Real/Personal/Centrally' },
                taxEntityName: { mapsTo: 'Tax Entity Names', usedIn: ['Tax rate lookups', 'Revenue calculations'] },
                taxEntityParticipationRate: { mapsTo: 'Participation Rates', usedIn: ['Revenue allocation'] },
                tyOriginalBudgetRevenues: { mapsTo: 'Original Budget Revenues', usedIn: ['Growth analysis'] },
                tyActualRevenue: { mapsTo: 'Actual Revenue', usedIn: ['Growth analysis', 'Variance calculations'] }
            }
        },
        missingFields: {
            needsToBeAdded: [
                {
                    field: 'personalPropertyValue',
                    form: 'internal',
                    type: 'number',
                    description: 'Personal Property Assessed Value',
                    default: 0,
                    required: false
                },
                {
                    field: 'centrallyAssessedValue',
                    form: 'internal',
                    type: 'number',
                    description: 'Centrally Assessed Value',
                    required: true
                },
                {
                    field: 'realPropertyValue',
                    form: 'internal',
                    type: 'number',
                    description: 'Real Property Assessed Value (if tyValue is total, this should be separate)',
                    required: true,
                    note: 'May be calculated as tyValue - personalPropertyValue - centrallyAssessedValue'
                },
                {
                    field: 'growthRates',
                    form: 'internal',
                    type: 'array',
                    description: 'Annual growth rates for projected years (array of rates per year)',
                    required: false,
                    note: 'Can be calculated from historical data or input manually'
                }
            ],
            comesFromImport: [
                {
                    field: 'taxRatesByEntity',
                    source: 'Excel/CSV import',
                    description: 'Tax rates by entity (County, School District, City) and year',
                    format: 'CSV/Excel with columns: Entity, Year, Rate',
                    note: 'From Utah Certified Tax Rates website'
                },
                {
                    field: 'taxEntityNames',
                    source: 'Excel/CSV import or form',
                    description: 'Tax entity names matching the import',
                    note: 'May already exist in taxEntityName fields but needs validation'
                }
            ]
        },
        formulaDependencies: {
            totalAssessedValue: {
                formula: 'Real Property + Personal Property + Centrally Assessed',
                baseFields: ['realPropertyValue', 'personalPropertyValue', 'centrallyAssessedValue'],
                status: 'needsFields'
            },
            taxIncrementRevenue: {
                formula: '(Total Assessed Value - Base Year Value) * Tax Rate',
                baseFields: ['totalAssessedValue', 'baseValue', 'taxRatesByEntity'],
                status: 'needsTaxRates'
            },
            realPropertyGrowth: {
                formula: 'Previous Year * (1 + Growth Rate)',
                baseFields: ['realPropertyValue', 'growthRates'],
                status: 'needsGrowthRates'
            },
            acreagePercentages: {
                formula: 'Developed / Total, Undeveloped / Total',
                baseFields: ['developedAcreage', 'undevelopedAcreage', 'acreage'],
                status: 'complete'
            }
        }
    };
    
    // Save mapping document
    const outputPath = path.join(__dirname, 'TIF_REPORT_FIELD_MAPPING.json');
    fs.writeFileSync(outputPath, JSON.stringify(mappingDoc, null, 2));
    console.log(`\n\n=== MAPPING DOCUMENT SAVED ===`);
    console.log(`Saved to: ${outputPath}`);
    
    // Generate summary
    console.log('\n\n=== SUMMARY ===');
    console.log('\nFields that need to be ADDED to forms:');
    console.log('  1. personalPropertyValue (Internal Form)');
    console.log('  2. centrallyAssessedValue (Internal Form)');
    console.log('  3. realPropertyValue (Internal Form - if tyValue is total)');
    console.log('  4. growthRates (Internal Form - array for projected years)');
    
    console.log('\nFields that come from IMPORT (Excel/CSV):');
    console.log('  1. taxRatesByEntity (Tax rates by entity and year)');
    console.log('  2. taxEntityNames (Validation/mapping)');
    
    console.log('\nFields that are COMPLETE in forms:');
    console.log('  ✓ acreage, baseValue, developedAcreage, undevelopedAcreage (External)');
    console.log('  ✓ tyValue, taxEntityName, taxEntityParticipationRate (Internal)');
    
} catch (error) {
    console.error('Error analyzing formulas:', error);
    process.exit(1);
}


