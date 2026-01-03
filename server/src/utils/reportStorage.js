/**
 * Report Storage Utility
 * Handles saving generated reports to disk and database
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import config from '../config.js';
import { db } from '../db.js';

// Ensure reports directory exists
const reportsDir = config.reportsDir;
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

/**
 * Generate filename with format: yymmddHHMM_<project_name>_<suffix>.xlsx
 * @param {string} projectName - Project name
 * @param {string} suffix - Report suffix (TIF or JUN30)
 * @returns {string} Formatted filename
 */
export function generateReportFilename(projectName, suffix) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const HH = String(now.getHours()).padStart(2, '0');
  const MM = String(now.getMinutes()).padStart(2, '0');
  
  // Sanitize project name for filename
  const sanitizedProjectName = projectName
    .replace(/[^a-zA-Z0-9\s_-]/g, '') // Remove special chars
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .substring(0, 100); // Limit length
  
  return `${yy}${mm}${dd}${HH}${MM}_${sanitizedProjectName}_${suffix}.xlsx`;
}

/**
 * Organize report storage by County/Agency/Project structure
 * @param {string} county - County name
 * @param {string} agency - Agency name
 * @param {string} project - Project name
 * @returns {string} Directory path
 */
function getReportStoragePath(county, agency, project) {
  // Sanitize names for directory structure
  const sanitize = (str) => {
    if (!str) return 'Unknown';
    return str
      .replace(/[^a-zA-Z0-9\s_-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
  };
  
  const countyDir = sanitize(county);
  const agencyDir = sanitize(agency);
  const projectDir = sanitize(project);
  
  const storagePath = path.join(reportsDir, countyDir, agencyDir, projectDir);
  
  // Ensure directory exists
  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true });
  }
  
  return storagePath;
}

/**
 * Save a generated report to disk and database
 * @param {Object} options - Save options
 * @param {Buffer} options.buffer - Report file buffer
 * @param {string} options.reportType - Report type (TIF or JUN30)
 * @param {string} options.filename - Generated filename
 * @param {string} options.orgId - Organization ID
 * @param {string} options.userId - User ID
 * @param {string} options.submissionId - Submission ID (optional)
 * @param {string} options.county - County name
 * @param {string} options.agency - Agency name
 * @param {string} options.project - Project name
 * @param {number} options.year - Report year
 * @returns {Object} Saved report record
 */
export async function saveReport({
  buffer,
  reportType,
  filename,
  orgId,
  userId,
  submissionId = null,
  county = null,
  agency = null,
  project = null,
  year = null,
  mimeType = null
}) {
  try {
    // Get storage path based on County/Agency/Project structure
    const storageDir = getReportStoragePath(county, agency, project);
    const storedPath = path.join(storageDir, filename);
    
    // Write file to disk
    fs.writeFileSync(storedPath, buffer);
    const fileSize = buffer.length;
    
    // Determine mime type based on filename extension or provided value
    let finalMimeType = mimeType;
    if (!finalMimeType) {
      if (filename.endsWith('.pdf')) {
        finalMimeType = 'application/pdf';
      } else if (filename.endsWith('.xlsx')) {
        finalMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      } else {
        finalMimeType = 'application/octet-stream';
      }
    }
    
    // Save record to database
    const reportId = uuid();
    db.prepare(`
      INSERT INTO generated_reports (
        id, org_id, submission_id, user_id, report_type,
        filename, stored_path, county, agency, project,
        year, file_size, mime_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reportId,
      orgId,
      submissionId,
      userId,
      reportType,
      filename,
      storedPath,
      county,
      agency,
      project,
      year,
      fileSize,
      finalMimeType
    );
    
    return {
      id: reportId,
      filename,
      storedPath,
      fileSize,
      reportType,
      county,
      agency,
      project,
      year
    };
  } catch (error) {
    console.error('[reportStorage] Error saving report:', error);
    throw error;
  }
}

/**
 * Get reports for a specific project
 * @param {string} orgId - Organization ID
 * @param {string} county - County name (optional)
 * @param {string} agency - Agency name (optional)
 * @param {string} project - Project name (optional)
 * @param {string} reportType - Report type filter (optional)
 * @returns {Array} Array of report records
 */
export function getReports(orgId, county = null, agency = null, project = null, reportType = null) {
  let query = 'SELECT * FROM generated_reports WHERE org_id = ?';
  const params = [orgId];
  
  if (county) {
    query += ' AND county = ?';
    params.push(county);
  }
  if (agency) {
    query += ' AND agency = ?';
    params.push(agency);
  }
  if (project) {
    query += ' AND project = ?';
    params.push(project);
  }
  if (reportType) {
    query += ' AND report_type = ?';
    params.push(reportType);
  }
  
  query += ' ORDER BY created_at DESC';
  
  return db.prepare(query).all(...params);
}

/**
 * Get a specific report by ID
 * @param {string} reportId - Report ID
 * @param {string} orgId - Organization ID (for security)
 * @returns {Object|null} Report record or null
 */
export function getReportById(reportId, orgId) {
  return db.prepare(`
    SELECT * FROM generated_reports 
    WHERE id = ? AND org_id = ?
  `).get(reportId, orgId);
}

/**
 * Delete a report from disk and database
 * @param {string} reportId - Report ID
 * @param {string} orgId - Organization ID (for security)
 * @returns {boolean} Success status
 */
export function deleteReport(reportId, orgId) {
  try {
    const report = getReportById(reportId, orgId);
    if (!report) {
      return false;
    }
    
    // Delete file from disk
    if (fs.existsSync(report.stored_path)) {
      fs.unlinkSync(report.stored_path);
    }
    
    // Delete record from database
    db.prepare('DELETE FROM generated_reports WHERE id = ? AND org_id = ?')
      .run(reportId, orgId);
    
    return true;
  } catch (error) {
    console.error('[reportStorage] Error deleting report:', error);
    return false;
  }
}

