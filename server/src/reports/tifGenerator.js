/**
 * TIF Report Generator
 * Main module that generates the complete TIF Excel report
 */

import ExcelJS from 'exceljs';
import { applyTemplateMappings, TEMPLATE_PATH } from './tifTemplateMapper.js';

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
  try {
    console.log('[generateTIFReport] Starting report generation...');
    console.log('[generateTIFReport] Submission data keys:', Object.keys(submission || {}));
    console.log('[generateTIFReport] Tax rates count:', taxRates?.length || 0);
    console.log('[generateTIFReport] Year:', year);
    
    // Load template workbook
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(TEMPLATE_PATH);
    
    // Parse submission data
    const submissionData = typeof submission === 'string' 
      ? JSON.parse(submission) 
      : submission;
    
    if (!submissionData) {
      throw new Error('Submission data is required');
    }
    
    // Determine base year
    const baseYear = year || 
                     parseInt(submissionData.year) || 
                     parseInt(submissionData.fy) || 
                     new Date().getFullYear();
    
    console.log('[generateTIFReport] Base year:', baseYear);
    
    // Apply submission data to template
    console.log('[generateTIFReport] Applying submission data to template...');
    applyTemplateMappings(workbook, submissionData, taxRates, { baseYear, projectionYears });
    
    // Generate buffer
    console.log('[generateTIFReport] Writing workbook to buffer...');
    const buffer = await workbook.xlsx.writeBuffer();
    console.log('[generateTIFReport] Report generation complete. Buffer size:', buffer.length);
    return buffer;
  } catch (error) {
    console.error('[generateTIFReport] Error in report generation:', error);
    console.error('[generateTIFReport] Error stack:', error.stack);
    throw error;
  }
}


