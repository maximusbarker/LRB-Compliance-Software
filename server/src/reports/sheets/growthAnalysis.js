/**
 * Growth Analysis Sheet Generator
 * Creates the "Sheet1" sheet with growth in assessed value analysis
 */

import { formatCurrency, formatNumber } from '../calculations.js';

/**
 * Generate Growth Analysis Sheet
 * @param {Object} worksheet - ExcelJS worksheet
 * @param {Object} submission - Submission data
 * @param {Object} multiYearSheet - Reference to multi-year budget sheet
 */
export async function generateGrowthAnalysisSheet(worksheet, submission, multiYearSheet) {
  // Header
  worksheet.mergeCells('C6:D6');
  worksheet.getCell('C6').value = 'GROWTH IN ASSESSED VALUE';
  worksheet.getCell('C6').font = { bold: true, size: 12 };
  
  // Column headers
  worksheet.getCell('C7').value = 'CURRENT YEAR';
  worksheet.getCell('C7').font = { bold: true };
  worksheet.getCell('D7').value = 'COMPARISON YEAR';
  worksheet.getCell('D7').font = { bold: true };
  worksheet.getCell('E7').value = 'GROWTH RATE';
  worksheet.getCell('E7').font = { bold: true };
  worksheet.getCell('F7').value = 'CAGR';
  worksheet.getCell('F7').font = { bold: true };
  
  // Section: Assessed Values in Project Area
  worksheet.getCell('C8').value = 'ASSESSED VALUES IN PROJECT AREA';
  worksheet.getCell('C8').font = { bold: true };
  
  const currentYear = new Date().getFullYear();
  const totalAssessedValue = parseFloat(submission.tyValue || submission.realPropertyValue || 0) +
                            parseFloat(submission.personalPropertyValue || 0) +
                            parseFloat(submission.centrallyAssessedValue || 0);
  
  // Annual Growth row
  worksheet.getCell('C9').value = `Annual Growth in Project Area (${currentYear} vs. ${currentYear - 1})`;
  worksheet.getCell('D9').value = totalAssessedValue;
  worksheet.getCell('D9').numFmt = '$#,##0';
  worksheet.getCell('E9').value = 'N/A';
  worksheet.getCell('F9').value = 'N/A';
  
  // Life Growth row
  const baseYearValue = parseFloat(submission.baseValue || 0);
  worksheet.getCell('C10').value = `Life Growth in Project Area (${currentYear} vs. Base)`;
  worksheet.getCell('D10').value = totalAssessedValue;
  worksheet.getCell('D10').numFmt = '$#,##0';
  worksheet.getCell('E10').value = 'N/A';
  worksheet.getCell('F10').value = 'N/A';
  
  // Empty rows
  worksheet.getRow(11).height = 10;
  worksheet.getRow(12).height = 10;
  
  // Section: Growth in Tax Increment
  worksheet.mergeCells('C13:F13');
  worksheet.getCell('C13').value = 'GROWTH IN TAX INCREMENT';
  worksheet.getCell('C13').font = { bold: true, size: 12 };
  
  // Column headers
  worksheet.getCell('C14').value = 'ORIGINAL BUDGET* REVENUES';
  worksheet.getCell('C14').font = { bold: true };
  worksheet.getCell('D14').value = 'ACTUAL REVENUE';
  worksheet.getCell('D14').font = { bold: true };
  worksheet.getCell('E14').value = 'BASE YEAR VALUE REVENUES';
  worksheet.getCell('E14').font = { bold: true };
  worksheet.mergeCells('F14:F15');
  worksheet.getCell('F14').value = '% ABOVE BASE';
  worksheet.getCell('F14').font = { bold: true };
  worksheet.getCell('F14').alignment = { vertical: 'middle', horizontal: 'center' };
  
  // Tax Increment from Project Area
  worksheet.getCell('C16').value = 'TAX INCREMENT FROM PROJECT AREA';
  worksheet.getCell('C16').font = { bold: true };
  
  const originalBudget = parseFloat(submission.tyOriginalBudgetRevenues || 0);
  const actualRevenue = parseFloat(submission.tyActualRevenue || 0);
  const baseYearRevenue = parseFloat(submission.tyBaseYearRevenue || 0);
  
  worksheet.getCell('C17').value = originalBudget;
  worksheet.getCell('C17').numFmt = '$#,##0';
  worksheet.getCell('D17').value = actualRevenue;
  worksheet.getCell('D17').numFmt = '$#,##0';
  worksheet.getCell('E17').value = baseYearRevenue;
  worksheet.getCell('E17').numFmt = '$#,##0';
  
  // Lifetime Revenue rows
  worksheet.mergeCells('C18:C20');
  worksheet.getCell('C18').value = 'Lifetime Revenue (2017-2026)';
  worksheet.getCell('C18').alignment = { vertical: 'middle' };
  
  const lifetimeRevenues = parseFloat(submission.lifetimeRevenues || 0);
  const lifetimeActual = parseFloat(submission.lifetimeActualRevenues || 0);
  const lifetimeBase = parseFloat(submission.lifetimeBaseYearRevenues || 0);
  
  worksheet.getCell('D18').value = lifetimeRevenues;
  worksheet.getCell('D18').numFmt = '$#,##0';
  worksheet.getCell('E18').value = lifetimeActual;
  worksheet.getCell('E18').numFmt = '$#,##0';
  worksheet.getCell('F18').value = lifetimeBase;
  worksheet.getCell('F18').numFmt = '$#,##0';
  
  // Pass Through Increment section
  worksheet.getCell('C21').value = 'PASS THROUGH INCREMENT (ABOVE BASE)';
  worksheet.getCell('C21').font = { bold: true };
  
  const passThrough = actualRevenue - baseYearRevenue;
  worksheet.getCell('C22').value = passThrough;
  worksheet.getCell('C22').numFmt = '$#,##0';
  
  // Set column widths
  worksheet.getColumn('A').width = 5;
  worksheet.getColumn('B').width = 5;
  worksheet.getColumn('C').width = 40;
  worksheet.getColumn('D').width = 18;
  worksheet.getColumn('E').width = 18;
  worksheet.getColumn('F').width = 15;
}


