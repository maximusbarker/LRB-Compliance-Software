# Tax Rate Scraper Implementation

## ✅ Completed

A web scraper has been created to automatically extract tax rates from the Utah Certified Tax Rates website.

---

## What Was Implemented

### 1. Backend Scraper Module

**File:** `server/src/scrapers/utahTaxRates.js`

**Functions:**
- `scrapeUtahTaxRates()` - Main scraping function
- `getUtahTaxRateOptions()` - Get available counties/agencies/projects

**Technology:** Puppeteer (headless browser automation)

**Process:**
1. Navigate to Utah website
2. Log in as guest
3. Select Tax Year, County, Agency, Project
4. Extract tax rates from table
5. Store in database

### 2. API Endpoints

**POST /api/tax-rates/scrape**
- Scrapes rates from Utah website
- Parameters: `taxYear`, `county`, `agency`, `project`, `isMaster`, `submissionId`
- Returns: Scraped and stored rates

**GET /api/tax-rates/options**
- Gets available options from website
- Returns: Counties, Agencies, Projects

### 3. Frontend UI

**Tax Rate Import Section - Two Methods:**

1. **Upload File** (Original)
   - Drag & drop CSV/Excel
   - Manual file selection

2. **Scrape from Website** (New)
   - Form fields: Tax Year, County, Agency, Project Area
   - Import type: Master or Project-Specific
   - One-click scraping

---

## Website Structure Analysis

Based on browser inspection, the CRA Increment Paid page shows:

**Dropdowns:**
- Tax Year (2025, 2024, 2023, etc.)
- County (e.g., "23_TOOELE")
- Agency (e.g., "Tooele County CDRA")
- Project (e.g., "1000 North Retail CRA")

**Data Table:**
- Entity Name (e.g., "1010_BEAVER", "2010_BEAVER COUNTY SCHOOL DISTRICT")
- Participation Percent
- Tax Rates:
  - (10) Real Property Tax Rate (e.g., 0.001519)
  - (11) Personal Property Tax Rate (e.g., 0.001550)
  - (12) Centrally Assessed Tax Rate (e.g., 0.001519)

---

## Scraper Logic

### Extraction Pattern

1. **Entity Identification:**
   - Pattern: `^\d{4}_` (e.g., "1010_BEAVER")
   - Extract entity name by removing numeric prefix

2. **Rate Extraction:**
   - Pattern: `^0\.\d{4,6}$` (e.g., "0.001519")
   - Collects: Real Property, Personal Property, Centrally Assessed
   - Uses Real Property Rate as primary

3. **Data Storage:**
   - Stores in `tax_rates` table
   - Links to org (master) or submission (project-specific)

---

## Usage

### Via UI

1. Navigate to Internal Database → Tax Rate Management
2. Click "Scrape from Website" tab
3. Fill in:
   - Tax Year: 2024
   - County: 23_TOOELE
   - Agency: Tooele County CDRA
   - Project Area: 1000 North Retail CRA
4. Select Import Type: Master or Project-Specific
5. Click "Scrape Tax Rates"
6. Wait for completion (may take 30-60 seconds)

### Via API

```javascript
const result = await apiClient.scrapeTaxRates({
  taxYear: 2024,
  county: '23_TOOELE',
  agency: 'Tooele County CDRA',
  project: '1000 North Retail CRA',
  isMaster: true
});
```

---

## Known Limitations & Considerations

1. **Website Changes:**
   - Website structure may change
   - Scraper may need updates if HTML structure changes

2. **ASP.NET Postbacks:**
   - Website uses ASP.NET with postbacks
   - Dropdown changes trigger postbacks
   - Scraper waits for navigation/updates

3. **Rate Detection:**
   - Currently uses pattern matching for rates
   - May need refinement based on actual table structure
   - Column positions may vary

4. **Performance:**
   - Puppeteer is resource-intensive
   - Scraping takes 30-60 seconds
   - Consider caching or background jobs for large batches

5. **Error Handling:**
   - Network timeouts
   - Website availability
   - Invalid selections

---

## Testing Recommendations

1. **Test with Real Data:**
   - Use actual County/Agency/Project combinations
   - Verify extracted rates match website

2. **Test Edge Cases:**
   - Missing entities
   - Different table structures
   - Multiple years

3. **Monitor Performance:**
   - Scraping time
   - Memory usage
   - Error rates

---

## Alternative Approach

If scraping proves unreliable, consider:

1. **Manual Export:**
   - Users export from website
   - Upload CSV/Excel (already implemented)

2. **API Integration:**
   - Check if Utah provides API
   - More reliable than scraping

3. **Hybrid:**
   - Scraper as convenience feature
   - Manual upload as fallback

---

## Files Created/Modified

1. **server/src/scrapers/utahTaxRates.js** - Scraper module
2. **server/src/routes.js** - Added scrape endpoints
3. **client/apiClient.js** - Added scrape methods
4. **index LRB compliance skeleton.html** - Added scrape UI

---

## Next Steps

1. ✅ Scraper created
2. ⏳ Test with real website data
3. ⏳ Refine extraction logic if needed
4. ⏳ Add error handling improvements
5. ⏳ Consider background job processing for large batches

---

## Notes

- Puppeteer requires Chrome/Chromium (installed automatically)
- Scraping may be slower than manual upload
- Website structure is complex (nested tables, ASP.NET)
- Rate extraction logic may need adjustment based on actual data


