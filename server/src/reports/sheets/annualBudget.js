/**
 * Annual Budget Sheet Generator
 * Creates the "Annual Budget" sheet with year-by-year breakdowns
 */

/**
 * Generate Annual Budget Sheet
 * @param {Object} worksheet - ExcelJS worksheet
 * @param {Object} submission - Submission data
 * @param {Object} multiYearSheet - Reference to multi-year budget sheet
 * @param {number} baseYear - Base year
 * @param {number} numYears - Number of years to show (default: 3)
 */
export async function generateAnnualBudgetSheet(worksheet, submission, multiYearSheet, baseYear, numYears = 3) {
  const projectAreaName = submission.projectAreaName || submission.projectArea || submission.submitterName || 'Project Area';
  const currentYear = new Date().getFullYear();
  
  // Header rows for each year column
  const yearColumns = ['C', 'J', 'N']; // Columns for Year 1, Year 2, Year 3
  
  for (let i = 0; i < Math.min(numYears, 3); i++) {
    const col = yearColumns[i];
    const year = baseYear + i;
    
    // Project Area Name header
    worksheet.mergeCells(`${col}1:${String.fromCharCode(col.charCodeAt(0) + 2)}1`);
    worksheet.getCell(`${col}1`).value = projectAreaName;
    worksheet.getCell(`${col}1`).font = { bold: true, size: 12 };
    
    // Annual Budget header
    worksheet.mergeCells(`${col}2:${String.fromCharCode(col.charCodeAt(0) + 2)}2`);
    worksheet.getCell(`${col}2`).value = `${year} Annual Budget`;
    worksheet.getCell(`${col}2`).font = { bold: true };
    
    // Empty row
    worksheet.getRow(3).height = 5;
    
    // Year label
    worksheet.getCell(`${col}4`).value = 'Year';
    worksheet.getCell(`${String.fromCharCode(col.charCodeAt(0) + 1)}4`).value = i + 1;
    
    // Tax Year
    worksheet.getCell(`${col}5`).value = 'Tax Year';
    worksheet.getCell(`${String.fromCharCode(col.charCodeAt(0) + 1)}5`).value = year - 1;
    
    // Payment Year
    worksheet.getCell(`${col}6`).value = 'Payment Year';
    worksheet.getCell(`${String.fromCharCode(col.charCodeAt(0) + 1)}6`).value = year;
    
    // REVENUES section
    worksheet.getCell(`${col}7`).value = 'REVENUES';
    worksheet.getCell(`${col}7`).font = { bold: true };
    worksheet.getCell(`${col}8`).value = 'TAXABLE VALUATION:';
    worksheet.getCell(`${col}8`).font = { bold: true };
    
    // Real Property
    const realPropertyValue = parseFloat(submission.realPropertyValue || submission.tyValue || 0);
    worksheet.getCell(`${col}9`).value = 'Real Property';
    worksheet.getCell(`${String.fromCharCode(col.charCodeAt(0) + 1)}9`).value = realPropertyValue;
    worksheet.getCell(`${String.fromCharCode(col.charCodeAt(0) + 1)}9`).numFmt = '$#,##0';
    
    // Personal Property
    const personalPropertyValue = parseFloat(submission.personalPropertyValue || 0);
    worksheet.getCell(`${col}10`).value = 'Personal Property';
    worksheet.getCell(`${String.fromCharCode(col.charCodeAt(0) + 1)}10`).value = personalPropertyValue;
    worksheet.getCell(`${String.fromCharCode(col.charCodeAt(0) + 1)}10`).numFmt = '$#,##0';
    
    // Centrally Assessed
    const centrallyAssessedValue = parseFloat(submission.centrallyAssessedValue || 0);
    worksheet.getCell(`${col}11`).value = 'Centrally Assessed';
    worksheet.getCell(`${String.fromCharCode(col.charCodeAt(0) + 1)}11`).value = centrallyAssessedValue;
    worksheet.getCell(`${String.fromCharCode(col.charCodeAt(0) + 1)}11`).numFmt = '$#,##0';
    
    // Total Assessed Value
    const totalAssessed = realPropertyValue + personalPropertyValue + centrallyAssessedValue;
    worksheet.getCell(`${col}12`).value = 'Total Assessed Value';
    worksheet.getCell(`${col}12`).font = { bold: true };
    worksheet.getCell(`${String.fromCharCode(col.charCodeAt(0) + 1)}12`).value = totalAssessed;
    worksheet.getCell(`${String.fromCharCode(col.charCodeAt(0) + 1)}12`).numFmt = '$#,##0';
    
    // Base Year Value
    const baseYearValue = parseFloat(submission.baseValue || 0);
    worksheet.getCell(`${col}13`).value = 'Base Year Value';
    worksheet.getCell(`${col}13`).font = { bold: true };
    worksheet.getCell(`${String.fromCharCode(col.charCodeAt(0) + 1)}13`).value = baseYearValue;
    worksheet.getCell(`${String.fromCharCode(col.charCodeAt(0) + 1)}13`).numFmt = '$#,##0';
    
    // Total Incremental Assessed Value
    const incremental = totalAssessed - baseYearValue;
    worksheet.getCell(`${col}14`).value = 'Total Incremental Assessed Value';
    worksheet.getCell(`${col}14`).font = { bold: true };
    worksheet.getCell(`${String.fromCharCode(col.charCodeAt(0) + 1)}14`).value = incremental;
    worksheet.getCell(`${String.fromCharCode(col.charCodeAt(0) + 1)}14`).numFmt = '$#,##0';
  }
  
  // Set column widths
  worksheet.getColumn('A').width = 5;
  worksheet.getColumn('B').width = 5;
  worksheet.getColumn('C').width = 20;
  worksheet.getColumn('J').width = 20;
  worksheet.getColumn('N').width = 20;
}


