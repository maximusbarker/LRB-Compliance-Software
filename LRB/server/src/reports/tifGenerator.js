/**
 * TIF Report Generator
 * Main module that generates the complete TIF Excel report
 */

import ExcelJS from 'exceljs';
import { generateMultiYearBudgetSheet } from './sheets/multiYearBudget.js';
import { generateGrowthAnalysisSheet } from './sheets/growthAnalysis.js';
import { generateAnnualBudgetSheet } from './sheets/annualBudget.js';
import { generateAcreageSheet } from './sheets/acreage.js';

/**
 * Generate TIF Report Excel File
 * @param {Object} options - Generation options
 * @param {Object} options.submission - Submission data object
 * @param {Array} options.taxRates - Array of tax rate objects
 * @param {number} options.year - Report year
 * @param {number} options.projectionYears - Number of years to project (default: 20)
 * @returns {Promise<Buffer>} Excel file buffer
 */
export async function generateTIFReport({ submission, taxRates = [], year, projectionYears = 20 }) {
  // Create new workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'LRB Compliance Software';
  workbook.created = new Date();
  
  // Parse submission data
  const submissionData = typeof submission === 'string' 
    ? JSON.parse(submission) 
    : submission;
  
  // Determine base year
  const baseYear = year || 
                   parseInt(submissionData.year) || 
                   parseInt(submissionData.fy) || 
                   new Date().getFullYear();
  
  // Sheet 1: Updated Multi-Year Budget
  const multiYearSheet = workbook.addWorksheet('Updated Multi-Year Budget');
  await generateMultiYearBudgetSheet(
    multiYearSheet, 
    submissionData, 
    taxRates, 
    baseYear, 
    projectionYears
  );
  
  // Sheet 2: Growth Analysis (Sheet1)
  const growthSheet = workbook.addWorksheet('Sheet1');
  await generateGrowthAnalysisSheet(growthSheet, submissionData, multiYearSheet);
  
  // Sheet 3: Annual Budget
  const annualSheet = workbook.addWorksheet('Annual Budget');
  await generateAnnualBudgetSheet(annualSheet, submissionData, multiYearSheet, baseYear, 3);
  
  // Sheet 4: Acreage
  const acreageSheet = workbook.addWorksheet('Acreage');
  await generateAcreageSheet(acreageSheet, submissionData, baseYear, 3);
  
  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}


