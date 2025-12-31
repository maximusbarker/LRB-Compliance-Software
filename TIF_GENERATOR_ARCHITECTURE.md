# TIF Report Generator Architecture

## Overview

The TIF (Tax Increment Financing) report generator will create a 4-sheet Excel workbook matching the structure of the provided Excel template. This document outlines the architecture and implementation approach.

---

## Architecture Decision: Backend API Endpoint

**Recommendation: Backend API Endpoint**

### Why Backend?

1. **Excel Generation**: Excel file generation is better suited for backend processing
2. **Data Security**: Complex calculations and tax rate data stay on the server
3. **Performance**: Large Excel files with formulas are better generated server-side
4. **Tax Rate Import**: Tax rates from CSV/Excel imports are stored on the backend
5. **Caching**: Generated reports can be cached/stored on the server
6. **Consistency**: Matches the pattern of other backend operations (submissions, uploads)

### Alternative: Frontend Generation
- Current PDF reports use PDFMake on the frontend
- Excel generation on frontend is possible but more complex
- Would require loading all data and tax rates into the browser
- Less secure for sensitive financial data

---

## Proposed Architecture

### API Endpoint

```
POST /api/reports/tif
GET  /api/reports/tif/:submissionId
```

### Request Format

**POST /api/reports/tif**
```json
{
  "submissionId": "uuid-of-submission",
  "year": 2025,
  "includeSheets": ["multiYearBudget", "growthAnalysis", "annualBudget", "acreage"],
  "projectionYears": 20
}
```

**GET /api/reports/tif/:submissionId**
- Generates report for a specific submission
- Returns Excel file as download

### Response Format

- **Content-Type**: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- **Content-Disposition**: `attachment; filename="TIF_Report_[ProjectArea]_[Year].xlsx"`
- **Body**: Excel file binary data

---

## Implementation Plan

### Phase 1: Backend Setup

1. **Install Excel Generation Library**
   ```bash
   cd server
   npm install exceljs
   ```

2. **Create Report Generator Module**
   - `server/src/reports/tifGenerator.js`
   - Functions for each sheet:
     - `generateMultiYearBudgetSheet()`
     - `generateGrowthAnalysisSheet()`
     - `generateAnnualBudgetSheet()`
     - `generateAcreageSheet()`

3. **Add API Route**
   - `server/src/routes.js`
   - Add `/api/reports/tif` endpoint
   - Requires authentication
   - Fetches submission data
   - Fetches tax rates (from import)
   - Generates Excel file
   - Returns file as download

### Phase 2: Data Collection

1. **Fetch Submission Data**
   - Get submission by ID
   - Extract all form fields
   - Validate required fields

2. **Fetch Tax Rates**
   - Query tax rates table (to be created)
   - Filter by entity and year
   - Match to tax entities in submission

3. **Calculate Derived Values**
   - Total Assessed Value = Real + Personal + Centrally
   - Tax Increment = (Total - Base) × Tax Rate
   - Growth projections using growth rates array

### Phase 3: Excel Generation

1. **Create Workbook**
   ```javascript
   const ExcelJS = require('exceljs');
   const workbook = new ExcelJS.Workbook();
   ```

2. **Sheet 1: Updated Multi-Year Budget**
   - Header rows (Project Area Name, Title)
   - Year columns (Tax Year, Payment Year)
   - Real Property row (with growth formulas)
   - Personal Property row
   - Centrally Assessed row
   - Total Assessed Value (formula)
   - Base Year Value section
   - Tax Rates section (from import)
   - Tax Increment Revenue calculations
   - Growth rates row

3. **Sheet 2: Growth Analysis (Sheet1)**
   - Growth in Assessed Value table
   - Growth in Tax Increment table
   - References to Multi-Year Budget sheet

4. **Sheet 3: Annual Budget**
   - Multiple year columns (Year 1, Year 2, Year 3)
   - Taxable Valuation section
   - Tax Rates section
   - Property Tax Increment Revenues
   - References to Multi-Year Budget sheet

5. **Sheet 4: Acreage**
   - Tax Year / Payment Year columns
   - Developed / Undeveloped rows
   - Total Acres
   - Percentage calculations

### Phase 4: Frontend Integration

1. **Add "Generate TIF Report" Button**
   - In Internal Database view
   - In Project Details view
   - Triggers API call

2. **API Client Method**
   ```javascript
   // client/apiClient.js
   async generateTIFReport(submissionId, options = {}) {
     const response = await fetch(`${this.baseURL}/reports/tif`, {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${this.token}`,
         'Content-Type': 'application/json'
       },
       body: JSON.stringify({ submissionId, ...options })
     });
     
     if (!response.ok) throw new Error('Report generation failed');
     
     // Trigger download
     const blob = await response.blob();
     const url = window.URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `TIF_Report_${submissionId}.xlsx`;
     a.click();
   }
   ```

---

## Database Schema for Tax Rates

### New Table: `tax_rates`

```sql
CREATE TABLE tax_rates (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  project_area_id TEXT, -- Links to submission
  entity_name TEXT NOT NULL, -- e.g., "Tooele County"
  year INTEGER NOT NULL,
  rate REAL NOT NULL, -- e.g., 0.001255
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (org_id) REFERENCES organizations(id)
);
```

### Import Endpoint

```
POST /api/tax-rates/import
Content-Type: multipart/form-data

- file: CSV/Excel file
- projectAreaId: UUID
```

---

## File Structure

```
server/
├── src/
│   ├── routes.js (add /api/reports/tif endpoint)
│   ├── reports/
│   │   ├── tifGenerator.js (main generator)
│   │   ├── sheets/
│   │   │   ├── multiYearBudget.js
│   │   │   ├── growthAnalysis.js
│   │   │   ├── annualBudget.js
│   │   │   └── acreage.js
│   │   └── calculations.js (formula helpers)
│   └── db.js (add tax_rates table)
```

---

## Example Code Structure

### Backend Route

```javascript
// server/src/routes.js
import { generateTIFReport } from './reports/tifGenerator.js';

router.post('/reports/tif', requireAuth, async (req, res) => {
  try {
    const { submissionId, year, projectionYears = 20 } = req.body;
    
    // Fetch submission
    const submission = db.prepare('SELECT * FROM submissions WHERE id=? AND org_id=?')
      .get(submissionId, req.user.org_id);
    
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    // Fetch tax rates
    const taxRates = db.prepare(`
      SELECT * FROM tax_rates 
      WHERE org_id=? AND project_area_id=?
      ORDER BY year, entity_name
    `).all(req.user.org_id, submissionId);
    
    // Generate Excel file
    const excelBuffer = await generateTIFReport({
      submission: JSON.parse(submission.payload_json),
      taxRates,
      year: year || submission.year,
      projectionYears
    });
    
    // Return as download
    const filename = `TIF_Report_${submissionId}_${year || 'all'}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(excelBuffer);
    
  } catch (error) {
    console.error('TIF report generation error:', error);
    res.status(500).json({ error: 'Report generation failed' });
  }
});
```

### Generator Function

```javascript
// server/src/reports/tifGenerator.js
const ExcelJS = require('exceljs');

export async function generateTIFReport({ submission, taxRates, year, projectionYears }) {
  const workbook = new ExcelJS.Workbook();
  
  // Sheet 1: Multi-Year Budget
  const multiYearSheet = workbook.addWorksheet('Updated Multi-Year Budget');
  await generateMultiYearBudgetSheet(multiYearSheet, submission, taxRates, year, projectionYears);
  
  // Sheet 2: Growth Analysis
  const growthSheet = workbook.addWorksheet('Sheet1');
  await generateGrowthAnalysisSheet(growthSheet, submission, multiYearSheet);
  
  // Sheet 3: Annual Budget
  const annualSheet = workbook.addWorksheet('Annual Budget');
  await generateAnnualBudgetSheet(annualSheet, submission, multiYearSheet);
  
  // Sheet 4: Acreage
  const acreageSheet = workbook.addWorksheet('Acreage');
  await generateAcreageSheet(acreageSheet, submission);
  
  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}
```

---

## Next Steps

1. ✅ **Fields Added** - 4 new TIF fields added to both forms
2. ⏳ **Install Dependencies** - Install `exceljs` in server
3. ⏳ **Create Tax Rates Table** - Database migration
4. ⏳ **Build Generator Module** - Create `tifGenerator.js` and sheet generators
5. ⏳ **Add API Endpoint** - Add route to `routes.js`
6. ⏳ **Frontend Integration** - Add "Generate TIF Report" button and API client method
7. ⏳ **Tax Rate Import** - Build CSV/Excel import functionality

---

## Testing Strategy

1. **Unit Tests**: Test each sheet generator function
2. **Integration Tests**: Test API endpoint with sample data
3. **Validation**: Compare generated Excel to original template
4. **Formula Verification**: Ensure formulas match Excel template
5. **Data Accuracy**: Verify calculations match expected results


