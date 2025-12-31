# Bulk Tax Rate Scraper Implementation

## ✅ Completed

A comprehensive bulk scraper has been created to automatically collect ALL tax rate data from the Utah Certified Tax Rates website for a given tax year (2025).

---

## What Was Implemented

### 1. Bulk Scraper Function

**File:** `server/src/scrapers/utahTaxRates.js`

**Function:** `scrapeAllUtahTaxRates()`

**Process:**
1. Logs in as guest to Utah website
2. Selects tax year (2025)
3. Iterates through ALL counties
4. For each county, gets ALL agencies
5. For each agency, gets ALL projects
6. For each project, scrapes tax rates
7. Stores rates in database with metadata (county, agency, project)
8. Prevents duplicates by checking existing records

**Features:**
- Progress callback for real-time updates
- Error handling per county/agency/project
- Comprehensive error reporting
- Duplicate prevention
- Metadata tracking (county, agency, project for each rate)

---

### 2. Database Schema Enhancement

**Added Columns to `tax_rates` table:**
- `county TEXT` - County name (e.g., "23_TOOELE")
- `agency TEXT` - Agency name (e.g., "Tooele City Redevelopment Agency")
- `project TEXT` - Project name (e.g., "8017_1000 NORTH RETAIL COMMUNITY REINVESTMENT AREA")

**Purpose:**
- Track where each rate came from
- Enable filtering by location
- Prevent duplicate imports
- Organize data by geographic/project hierarchy

---

### 3. API Endpoint

**POST /api/tax-rates/scrape-all**

**Parameters:**
- `taxYear` (optional, defaults to 2025)

**Response:**
- Returns immediately with status message
- Runs scraping in background (non-blocking)
- Process continues even if client disconnects

**Usage:**
```javascript
await apiClient.scrapeAllTaxRates({ taxYear: 2025 });
```

---

### 4. Frontend UI

**Location:** Internal Database → Tax Rate Management → Scrape from Website tab

**New Button:** "Scrape All (2025)"
- Green button next to "Scrape Selected Project"
- Confirmation dialog before starting
- Status display showing progress
- Warning about 1-2 hour processing time

**Features:**
- One-click bulk scraping
- Background processing indicator
- User-friendly status messages

---

## How It Works

### Scraping Flow

```
1. Login as Guest
   ↓
2. Select Tax Year (2025)
   ↓
3. For Each County:
   ├─ Select County
   ├─ Get All Agencies
   │  └─ For Each Agency:
   │     ├─ Select Agency
   │     ├─ Get All Projects
   │     │  └─ For Each Project:
   │     │     ├─ Select Project
   │     │     ├─ Extract Tax Rates
   │     │     └─ Store in Database
   │     └─ Continue to Next Agency
   └─ Continue to Next County
```

### Data Storage

Each tax rate is stored with:
- Entity name (e.g., "TOOELE", "TOOELE COUNTY SCHOOL DISTRICT")
- Year (2025)
- Rates (Real Property, Personal Property, Centrally Assessed)
- Metadata (County, Agency, Project)
- Organization ID
- Master rate flag (`submission_id = NULL`)

---

## Performance Considerations

### Estimated Time
- **Per Project:** ~5-10 seconds (navigation + extraction)
- **Total Projects:** Varies by county/agency (could be 100-500+ projects)
- **Total Time:** 1-2 hours for all data

### Optimization
- Single browser session (reuses login)
- Efficient duplicate checking
- Background processing (non-blocking API)
- Progress tracking for monitoring

### Error Handling
- Errors per project don't stop entire process
- Comprehensive error logging
- Continues to next project on failure
- Error summary in final results

---

## Usage

### Via UI

1. Navigate to **Internal Database** → **Tax Rate Management**
2. Click **"Scrape from Website"** tab
3. Click **"Scrape All (2025)"** button
4. Confirm the action
5. Wait for confirmation message
6. Process runs in background
7. Check back later to see imported rates

### Via API

```javascript
// Start bulk scraping
const result = await apiClient.scrapeAllTaxRates({ taxYear: 2025 });
console.log(result.message); // "Bulk scraping started"
```

---

## Results Structure

After completion, the scraper returns:

```javascript
{
  totalCounties: 29,
  totalAgencies: 150,
  totalProjects: 450,
  totalRates: 1350,
  errors: [],
  counties: [
    {
      county: "23_TOOELE",
      countyValue: "23",
      agencies: [
        {
          agency: "Tooele City Redevelopment Agency",
          agencyValue: "233050A",
          projects: [
            {
              project: "8017_1000 NORTH RETAIL COMMUNITY REINVESTMENT AREA",
              totalRates: 3,
              errors: []
            }
          ],
          totalRates: 9,
          errors: []
        }
      ],
      totalRates: 9,
      errors: []
    }
  ]
}
```

---

## Database Queries

### View All Scraped Rates

```sql
SELECT 
  county,
  agency,
  project,
  entity_name,
  year,
  rate,
  real_property_rate,
  personal_property_rate,
  centrally_assessed_rate
FROM tax_rates
WHERE org_id = ? 
  AND submission_id IS NULL
  AND year = 2025
ORDER BY county, agency, project, entity_name;
```

### Count Rates by County

```sql
SELECT 
  county,
  COUNT(*) as rate_count
FROM tax_rates
WHERE org_id = ? 
  AND submission_id IS NULL
  AND year = 2025
GROUP BY county
ORDER BY county;
```

### Find Rates for Specific Project

```sql
SELECT *
FROM tax_rates
WHERE org_id = ?
  AND county = '23_TOOELE'
  AND agency = 'Tooele City Redevelopment Agency'
  AND project = '8017_1000 NORTH RETAIL COMMUNITY REINVESTMENT AREA'
  AND year = 2025;
```

---

## Notes

1. **Background Processing:** The bulk scrape runs in the background, so you can close the browser/UI and it will continue.

2. **Duplicate Prevention:** The scraper checks for existing rates before inserting, preventing duplicates if run multiple times.

3. **Error Recovery:** If a specific project fails, the scraper continues with the next project. All errors are logged for review.

4. **Resource Usage:** Puppeteer uses significant memory. Ensure the server has adequate resources for long-running processes.

5. **Network Stability:** The process requires stable internet connection. Network interruptions may cause some projects to fail.

---

## Next Steps

1. ✅ Bulk scraper created
2. ✅ UI button added
3. ✅ API endpoint implemented
4. ⏳ Test with small subset (1-2 counties)
5. ⏳ Monitor first full run
6. ⏳ Add progress tracking/status endpoint (optional)
7. ⏳ Add email notification on completion (optional)

---

## Files Modified

1. **server/src/scrapers/utahTaxRates.js** - Added `scrapeAllUtahTaxRates()` function
2. **server/src/db.js** - Added county, agency, project columns to tax_rates table
3. **server/src/routes.js** - Added `/tax-rates/scrape-all` endpoint
4. **client/apiClient.js** - Added `scrapeAllTaxRates()` method
5. **index LRB compliance skeleton.html** - Added bulk scrape button and handler

---

## Testing Recommendations

1. **Small Test:** Run with 1-2 counties first to verify functionality
2. **Monitor Logs:** Watch server logs for errors and progress
3. **Check Database:** Verify rates are being stored correctly
4. **Full Run:** Once verified, run for all counties
5. **Verify Data:** Spot-check a few projects to ensure accuracy


