# TIF Report Backend Implementation

## ✅ Completed

The backend TIF report generator has been fully implemented.

---

## File Structure

```
server/src/
├── db.js (updated - added tax_rates table)
├── routes.js (updated - added TIF endpoints)
└── reports/
    ├── tifGenerator.js (main generator)
    ├── calculations.js (formula helpers)
    └── sheets/
        ├── multiYearBudget.js
        ├── growthAnalysis.js
        ├── annualBudget.js
        └── acreage.js
```

---

## Database Changes

### New Table: `tax_rates`

```sql
CREATE TABLE tax_rates (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  submission_id TEXT,
  entity_name TEXT NOT NULL,
  year INTEGER NOT NULL,
  rate REAL NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (org_id) REFERENCES organizations(id),
  FOREIGN KEY (submission_id) REFERENCES submissions(id)
);
```

**Indexes:**
- `idx_tax_rates_org_submission` on `(org_id, submission_id)`
- `idx_tax_rates_year` on `(year)`

---

## API Endpoints

### 1. Generate TIF Report (POST)

**Endpoint:** `POST /api/reports/tif`

**Request Body:**
```json
{
  "submissionId": "uuid",
  "year": 2025,
  "projectionYears": 20
}
```

**Response:**
- Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- File download: `TIF_Report_[ProjectArea]_[Year].xlsx`

**Example:**
```javascript
const response = await fetch('/api/reports/tif', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    submissionId: 'abc-123',
    year: 2025,
    projectionYears: 20
  })
});

const blob = await response.blob();
// Trigger download
```

---

### 2. Generate TIF Report (GET)

**Endpoint:** `GET /api/reports/tif/:submissionId`

**Query Parameters:**
- `year` (optional) - Report year
- `projectionYears` (optional) - Number of projection years (default: 20)

**Response:** Excel file download

**Example:**
```
GET /api/reports/tif/abc-123?year=2025&projectionYears=20
```

---

### 3. Import Tax Rates

**Endpoint:** `POST /api/tax-rates/import`

**Request:**
- Content-Type: `multipart/form-data`
- File: CSV/Excel file
- Body: `{ submissionId: "uuid" }`

**Expected File Format:**
```csv
Entity,Year,Rate
Tooele County,2024,0.001255
Tooele County School District,2024,0.008954
Tooele City,2024,0.002554
```

**Response:**
```json
{
  "ok": true,
  "imported": 3,
  "rates": [
    { "entityName": "Tooele County", "year": 2024, "rate": 0.001255 },
    ...
  ]
}
```

---

## Report Generation

### Sheet 1: Updated Multi-Year Budget
- Project Area Name header
- Year columns (Tax Year, Payment Year)
- Real Property row (with growth projections)
- Personal Property row
- Centrally Assessed row
- Total Assessed Value (calculated)
- Base Year Value section
- Tax Rates section (from import)
- Formulas for projections

### Sheet 2: Growth Analysis (Sheet1)
- Growth in Assessed Value analysis
- Growth in Tax Increment analysis
- Current year vs. comparison year
- Lifetime revenue tracking

### Sheet 3: Annual Budget
- Year-by-year budget breakdowns
- Taxable Valuation section
- Tax Rates section
- Property Tax Increment Revenues

### Sheet 4: Acreage
- Developed/Undeveloped acreage tracking
- Total Acres
- Percentage calculations

---

## Calculation Functions

All calculations are in `server/src/reports/calculations.js`:

- `calculateTotalAssessedValue()` - Sum of property values
- `calculateTaxIncrement()` - (Total - Base) × Tax Rate
- `calculateRealPropertyGrowth()` - Previous Year × (1 + Growth Rate)
- `calculateAcreagePercentages()` - Developed/Total, Undeveloped/Total
- `getTaxRateForEntity()` - Lookup tax rate by entity and year
- `calculateTotalTaxRate()` - Sum of all entity rates for a year
- `parseGrowthRates()` - Parse JSON growth rates array

---

## Dependencies

- `exceljs` - Excel file generation
- `xlsx` - Excel file parsing (for tax rate import)

---

## Next Steps

1. ✅ Backend implementation complete
2. ⏳ Frontend integration - Add "Generate TIF Report" button
3. ⏳ Frontend integration - Add tax rate import UI
4. ⏳ Testing - Test with real submission data
5. ⏳ Validation - Compare generated Excel to template

---

## Usage Example

```javascript
// In frontend API client
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
  window.URL.revokeObjectURL(url);
}
```

---

## Notes

- All endpoints require authentication (`requireAuth`)
- Tax rates are linked to submissions via `submission_id`
- Growth rates are parsed from JSON string/array in submission data
- Excel formulas are generated using ExcelJS formula syntax
- File downloads use proper Content-Type headers


