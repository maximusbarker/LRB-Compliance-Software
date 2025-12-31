# How to Run Bulk Tax Rate Scraper

## Quick Start

### Option 1: Via UI (Recommended)

1. **Open the application** in your browser
2. **Log in** to your account
3. Navigate to: **Internal Database** → **Tax Rate Management**
4. Click the **"Scrape from Website"** tab
5. Click the **"Scrape All (2025)"** button (green button)
6. Confirm the action when prompted
7. You'll see a success message: "Bulk scraping started. This will run in the background."

### Option 2: Via API (Advanced)

If you have an auth token, you can trigger it via API:

```bash
curl -X POST http://localhost:4000/api/tax-rates/scrape-all \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{"taxYear": 2025}'
```

---

## What Happens

1. **Immediate Response**: API returns immediately with status message
2. **Background Processing**: Scraper runs in background (1-2 hours)
3. **Progress Logging**: Check server console for progress updates
4. **Data Storage**: Rates stored as master rates in database

---

## Monitoring Progress

### Check Server Logs

The scraper logs progress to the server console:

```
[bulkScrape] County 23_TOOELE: Found 3 agencies
[bulkScrape] Agency Tooele City Redevelopment Agency: Found 2 projects
[bulkScrape] Project "1000 North Retail": Found 3 entity/entities, 3 rates stored
[bulkScrape] Progress: 23_TOOELE > Tooele City Redevelopment Agency > 1000 North Retail: 3 rates
```

### Check Database

After completion, query the database:

```sql
-- Count total rates scraped
SELECT COUNT(*) as total_rates 
FROM tax_rates 
WHERE org_id = 'YOUR_ORG_ID' 
  AND submission_id IS NULL 
  AND year = 2025;

-- Count by county
SELECT county, COUNT(*) as rate_count 
FROM tax_rates 
WHERE org_id = 'YOUR_ORG_ID' 
  AND submission_id IS NULL 
  AND year = 2025 
GROUP BY county 
ORDER BY county;

-- View sample rates
SELECT county, agency, project, entity_name, rate 
FROM tax_rates 
WHERE org_id = 'YOUR_ORG_ID' 
  AND submission_id IS NULL 
  AND year = 2025 
LIMIT 10;
```

---

## Expected Results

- **Counties**: ~29 counties in Utah
- **Agencies**: Varies by county (typically 1-10 per county)
- **Projects**: Varies by agency (typically 1-5 per agency)
- **Total Projects**: Estimated 100-500 projects
- **Total Rates**: Estimated 300-1500 rate records
- **Processing Time**: 1-2 hours

---

## Troubleshooting

### Server Not Running
```bash
cd server
npm start
```

### Check Server Logs
Look for:
- `[bulkScrape]` log messages
- Error messages
- Progress updates

### Verify Database
Check if rates are being stored:
```sql
SELECT COUNT(*) FROM tax_rates WHERE year = 2025;
```

### Common Issues

1. **"No auth token"**: Log in via UI first
2. **"Server not responding"**: Check if server is running
3. **"Scraping failed"**: Check server logs for specific errors
4. **"No rates stored"**: Verify database connection and permissions

---

## Completion

When finished, you'll see in server logs:

```
[bulkScrape] Completed: {
  totalCounties: 29,
  totalAgencies: 150,
  totalProjects: 450,
  totalRates: 1350,
  errors: []
}
```

All rates will be available as **Master Rates** in the Tax Rate Management section.


