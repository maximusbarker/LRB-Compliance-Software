/**
 * Multi-Year Budget Sheet Generator
 * Creates the "Updated Multi-Year Budget" sheet with projections
 */

import {
  calculateTotalAssessedValue,
  calculateRealPropertyGrowth,
  calculateTaxIncrement,
  calculateTotalTaxRate,
  formatCurrency,
  formatNumber,
  parseGrowthRates
} from '../calculations.js';

/**
 * Generate Multi-Year Budget Sheet
 * @param {Object} worksheet - ExcelJS worksheet
 * @param {Object} submission - Submission data
 * @param {Array} taxRates - Tax rates array
 * @param {number} baseYear - Base year for projections
 * @param {number} projectionYears - Number of years to project
 */
export async function generateMultiYearBudgetSheet(worksheet, submission, taxRates, baseYear, projectionYears = 20) {
  const projectAreaName = submission.projectAreaName || submission.projectArea || submission.submitterName || 'Project Area';
  const currentYear = new Date().getFullYear();
  const startYear = baseYear || currentYear;
  
  // Parse growth rates
  const growthRates = parseGrowthRates(submission.growthRates);
  const growthRateMap = {};
  growthRates.forEach(gr => {
    growthRateMap[gr.year] = gr.rate;
  });
  
  // Get base values
  const realPropertyBase = parseFloat(submission.realPropertyValue || submission.tyValue || 0);
  const personalPropertyBase = parseFloat(submission.personalPropertyValue || 0);
  const centrallyAssessedBase = parseFloat(submission.centrallyAssessedValue || 0);
  const baseYearValue = parseFloat(submission.baseValue || 0);
  
  // Header rows
  worksheet.mergeCells('A1:E1');
  worksheet.getCell('A1').value = projectAreaName;
  worksheet.getCell('A1').font = { bold: true, size: 14 };
  worksheet.getCell('A1').alignment = { horizontal: 'left' };
  
  worksheet.mergeCells('A2:E2');
  worksheet.getCell('A2').value = 'Multi-Year Project Area Budget Projections';
  worksheet.getCell('A2').font = { bold: true, size: 12 };
  
  // Empty rows
  worksheet.getRow(3).height = 5;
  worksheet.getRow(4).height = 5;
  worksheet.getRow(5).height = 5;
  
  // Year headers row
  worksheet.mergeCells('D6:E6');
  worksheet.getCell('D6').value = 'PROJECTED ========>';
  worksheet.getCell('D6').font = { bold: true };
  worksheet.getCell('C6').value = 'HISTORIC';
  worksheet.getCell('C6').font = { bold: true };
  
  // Year labels row
  const yearRow = 7;
  worksheet.getCell('B7').value = '';
  worksheet.getCell('C7').value = 'Year 1';
  for (let i = 2; i <= Math.min(projectionYears, 20); i++) {
    const col = String.fromCharCode(67 + i); // C=67, D=68, etc.
    worksheet.getCell(`${col}7`).value = `Year ${i}`;
  }
  
  // Tax Year row
  const taxYearRow = 8;
  worksheet.getCell('A8').value = 'Tax Year';
  worksheet.getCell('A8').font = { bold: true };
  worksheet.getCell('C8').value = startYear - 1; // Historic year
  for (let i = 0; i < Math.min(projectionYears, 20); i++) {
    const col = String.fromCharCode(68 + i); // D=68
    worksheet.getCell(`${col}${taxYearRow}`).value = startYear + i;
  }
  
  // Payment Year row
  const paymentYearRow = 9;
  worksheet.getCell('A9').value = 'Payment Year';
  worksheet.getCell('A9').font = { bold: true };
  worksheet.getCell('C9').value = startYear; // Payment year
  for (let i = 0; i < Math.min(projectionYears, 20); i++) {
    const col = String.fromCharCode(68 + i);
    worksheet.getCell(`${col}${paymentYearRow}`).value = startYear + i + 1;
  }
  
  // Empty row
  worksheet.getRow(10).height = 5;
  
  // REVENUE section
  worksheet.getCell('A11').value = 'REVENUE:';
  worksheet.getCell('A11').font = { bold: true };
  worksheet.getCell('A12').value = 'REVENUES';
  worksheet.getCell('A12').font = { bold: true };
  worksheet.getCell('A13').value = 'TAXABLE VALUATION:';
  worksheet.getCell('A13').font = { bold: true };
  
  // Real Property row
  const realPropertyRow = 14;
  worksheet.getCell(`A${realPropertyRow}`).value = 'Real Property';
  worksheet.getCell(`C${realPropertyRow}`).value = realPropertyBase;
  worksheet.getCell(`C${realPropertyRow}`).numFmt = '$#,##0';
  
  // Calculate projected values with growth
  let currentRealProperty = realPropertyBase;
  for (let i = 0; i < Math.min(projectionYears, 20); i++) {
    const col = String.fromCharCode(68 + i); // D=68
    const year = startYear + i;
    const growthRate = growthRateMap[year] || 0;
    currentRealProperty = calculateRealPropertyGrowth(currentRealProperty, growthRate);
    worksheet.getCell(`${col}${realPropertyRow}`).value = currentRealProperty;
    worksheet.getCell(`${col}${realPropertyRow}`).numFmt = '$#,##0';
  }
  
  // Personal Property row
  const personalPropertyRow = 15;
  worksheet.getCell(`A${personalPropertyRow}`).value = 'Personal Property';
  worksheet.getCell(`C${personalPropertyRow}`).value = personalPropertyBase;
  worksheet.getCell(`C${personalPropertyRow}`).numFmt = '$#,##0';
  // Copy same value across years (typically doesn't change)
  for (let i = 0; i < Math.min(projectionYears, 20); i++) {
    const col = String.fromCharCode(68 + i);
    worksheet.getCell(`${col}${personalPropertyRow}`).value = personalPropertyBase;
    worksheet.getCell(`${col}${personalPropertyRow}`).numFmt = '$#,##0';
  }
  
  // Centrally Assessed row
  const centrallyAssessedRow = 16;
  worksheet.getCell(`A${centrallyAssessedRow}`).value = 'Centrally Assessed';
  worksheet.getCell(`C${centrallyAssessedRow}`).value = centrallyAssessedBase;
  worksheet.getCell(`C${centrallyAssessedRow}`).numFmt = '$#,##0';
  // Copy same value across years (typically constant)
  for (let i = 0; i < Math.min(projectionYears, 20); i++) {
    const col = String.fromCharCode(68 + i);
    worksheet.getCell(`${col}${centrallyAssessedRow}`).value = centrallyAssessedBase;
    worksheet.getCell(`${col}${centrallyAssessedRow}`).numFmt = '$#,##0';
  }
  
  // Total Assessed Value row (formula)
  const totalAssessedRow = 17;
  worksheet.mergeCells(`A${totalAssessedRow}:B${totalAssessedRow}`);
  worksheet.getCell(`A${totalAssessedRow}`).value = 'Total Assessed Value';
  worksheet.getCell(`A${totalAssessedRow}`).font = { bold: true };
  
  // Calculate totals for each year
  for (let i = -1; i < Math.min(projectionYears, 20); i++) {
    const col = i === -1 ? 'C' : String.fromCharCode(68 + i);
    const formula = `=${col}${realPropertyRow}+${col}${personalPropertyRow}+${col}${centrallyAssessedRow}`;
    worksheet.getCell(`${col}${totalAssessedRow}`).formula = formula;
    worksheet.getCell(`${col}${totalAssessedRow}`).numFmt = '$#,##0';
  }
  
  // Base Year Value section
  const baseYearRow = 18;
  worksheet.getCell(`A${baseYearRow}`).value = 'Base Year Value';
  worksheet.getCell(`A${baseYearRow}`).font = { bold: true };
  worksheet.getCell(`A${baseYearRow + 1}`).value = 'Real Property';
  worksheet.getCell(`C${baseYearRow + 1}`).value = baseYearValue;
  worksheet.getCell(`C${baseYearRow + 1}`).numFmt = '$#,##0';
  worksheet.getCell(`A${baseYearRow + 2}`).value = 'Personal Property';
  worksheet.getCell(`C${baseYearRow + 2}`).value = 0;
  worksheet.getCell(`C${baseYearRow + 2}`).numFmt = '$#,##0';
  
  // Tax Rates section (from imported data)
  const taxRatesStartRow = 23;
  worksheet.getCell(`A${taxRatesStartRow}`).value = 'TAX RATES';
  worksheet.getCell(`A${taxRatesStartRow}`).font = { bold: true };
  
  // Get unique entities from tax rates
  const entities = [...new Set(taxRates.map(tr => tr.entity_name))];
  let taxRateRow = taxRatesStartRow + 1;
  
  entities.forEach(entity => {
    worksheet.getCell(`A${taxRateRow}`).value = entity;
    // Get rate for base year and projected years
    for (let i = -1; i < Math.min(projectionYears, 20); i++) {
      const col = i === -1 ? 'C' : String.fromCharCode(68 + i);
      const year = i === -1 ? startYear - 1 : startYear + i;
      const rate = taxRates.find(tr => tr.entity_name === entity && tr.year === year);
      if (rate) {
        worksheet.getCell(`${col}${taxRateRow}`).value = rate.rate;
        worksheet.getCell(`${col}${taxRateRow}`).numFmt = '0.000000';
      }
    }
    taxRateRow++;
  }
  
  // Total Tax Rate row
  worksheet.getCell(`A${taxRateRow}`).value = 'Total Tax Rate';
  worksheet.getCell(`A${taxRateRow}`).font = { bold: true };
  for (let i = -1; i < Math.min(projectionYears, 20); i++) {
    const col = i === -1 ? 'C' : String.fromCharCode(68 + i);
    const year = i === -1 ? startYear - 1 : startYear + i;
    const totalRate = calculateTotalTaxRate(taxRates, year);
    worksheet.getCell(`${col}${taxRateRow}`).value = totalRate;
    worksheet.getCell(`${col}${taxRateRow}`).numFmt = '0.000000';
  }
  
  // Set column widths
  worksheet.getColumn('A').width = 25;
  worksheet.getColumn('B').width = 15;
  for (let i = 0; i < Math.min(projectionYears + 1, 21); i++) {
    const col = i === 0 ? 'C' : String.fromCharCode(68 + i);
    worksheet.getColumn(col).width = 15;
  }
}


