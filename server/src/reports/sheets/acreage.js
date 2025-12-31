/**
 * Acreage Sheet Generator
 * Creates the "Acreage" sheet with developed/undeveloped tracking
 */

import { calculateAcreagePercentages } from '../calculations.js';

/**
 * Generate Acreage Sheet
 * @param {Object} worksheet - ExcelJS worksheet
 * @param {Object} submission - Submission data
 * @param {number} baseYear - Base year
 * @param {number} numYears - Number of years to show (default: 3)
 */
export async function generateAcreageSheet(worksheet, submission, baseYear, numYears = 3) {
  const totalAcreage = parseFloat(submission.acreage || 0);
  const developedAcreage = parseFloat(submission.developedAcreage || 0);
  const undevelopedAcreage = parseFloat(submission.undevelopedAcreage || 0);
  
  // Headers
  worksheet.getCell('B2').value = 'Tax Year';
  worksheet.getCell('B2').font = { bold: true };
  
  // Year columns
  for (let i = 0; i < Math.min(numYears, 3); i++) {
    const col = String.fromCharCode(67 + i); // C=67, D=68, E=69
    const year = baseYear - 3 + i; // Show 3 years before base year
    worksheet.getCell(`${col}2`).value = year;
  }
  
  // Payment Year row
  worksheet.getCell('B3').value = 'Payment Year';
  worksheet.getCell('B3').font = { bold: true };
  for (let i = 0; i < Math.min(numYears, 3); i++) {
    const col = String.fromCharCode(67 + i);
    const year = baseYear - 2 + i;
    worksheet.getCell(`${col}3`).value = year;
  }
  
  // Developed row
  worksheet.getCell('B4').value = 'Developed';
  worksheet.getCell('B4').font = { bold: true };
  for (let i = 0; i < Math.min(numYears, 3); i++) {
    const col = String.fromCharCode(67 + i);
    // For now, use same value (could be calculated from growth if needed)
    worksheet.getCell(`${col}4`).value = developedAcreage;
    worksheet.getCell(`${col}4`).numFmt = '0.00';
  }
  
  // Undeveloped row
  worksheet.getCell('B5').value = 'Undeveloped';
  worksheet.getCell('B5').font = { bold: true };
  for (let i = 0; i < Math.min(numYears, 3); i++) {
    const col = String.fromCharCode(67 + i);
    worksheet.getCell(`${col}5`).value = undevelopedAcreage;
    worksheet.getCell(`${col}5`).numFmt = '0.00';
  }
  
  // Total Acres row
  worksheet.getCell('B6').value = 'Total Acres';
  worksheet.getCell('B6').font = { bold: true };
  for (let i = 0; i < Math.min(numYears, 3); i++) {
    const col = String.fromCharCode(67 + i);
    worksheet.getCell(`${col}6`).value = totalAcreage;
    worksheet.getCell(`${col}6`).numFmt = '0';
  }
  
  // % Developed row
  worksheet.getCell('B7').value = '% Developed';
  worksheet.getCell('B7').font = { bold: true };
  const percentages = calculateAcreagePercentages(developedAcreage, totalAcreage);
  for (let i = 0; i < Math.min(numYears, 3); i++) {
    const col = String.fromCharCode(67 + i);
    worksheet.getCell(`${col}7`).value = percentages.developedPercent;
    worksheet.getCell(`${col}7`).numFmt = '0.0%';
  }
  
  // % Undeveloped row
  worksheet.getCell('B8').value = '% Undeveloped';
  worksheet.getCell('B8').font = { bold: true };
  for (let i = 0; i < Math.min(numYears, 3); i++) {
    const col = String.fromCharCode(67 + i);
    worksheet.getCell(`${col}8`).value = percentages.undevelopedPercent;
    worksheet.getCell(`${col}8`).numFmt = '0.0%';
  }
  
  // Set column widths
  worksheet.getColumn('A').width = 5;
  worksheet.getColumn('B').width = 20;
  for (let i = 0; i < Math.min(numYears, 3); i++) {
    const col = String.fromCharCode(67 + i);
    worksheet.getColumn(col).width = 15;
  }
}


