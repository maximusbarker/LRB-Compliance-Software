# TIF Report Testing Guide

This guide explains how to test the TIF report generation with the new county/agency/project structure.

## Overview

The TIF report system now matches tax rates by **county**, **agency**, and **project** from the submission data, rather than just by `submission_id`. This ensures that reports use the correct tax rates from the master tax rate database.

## Changes Made

### 1. Updated TIF Report Route (`server/src/routes.js`)

The `/reports/tif` endpoint now:
- Extracts `county`, `agency` (from `submitterName`/`cityCounty`/`city`), and `project` (from `projectAreaName`/`projectArea`) from the submission payload
- Matches tax rates in this priority order:
  1. **Exact match**: `county` + `agency` + `project` + `year`
  2. **Project match**: `county` + `agency` + `project` (any year)
  3. **Agency match**: `county` + `agency` + `year`
  4. **Fallback**: Org-wide rates (by `submission_id` or `org_id`)

### 2. Test Data Script (`server/scripts/create-test-submission.js`)

A new script that:
- Finds available county/agency/project combinations from the tax_rates table
- Creates a test submission with matching location data
- Verifies that tax rates exist for that combination
- Provides the submission ID for testing

## Testing Steps

### Step 1: Ensure Tax Rate Data Exists

First, verify you have tax rate data in the database:

```bash
cd server
npm run report:tax-rates
```

This will show you:
- Total tax rate rows
- Counties with data
- Agencies per county
- Projects per agency

### Step 2: Create Test Submission

Run the test submission script:

```bash
cd server
npm run test:submission
```

This will:
1. Find the first available county/agency/project combination from your tax rates
2. Create a test submission with:
   - Matching `county`, `submitterName` (agency), and `projectAreaName` (project)
   - Sample property values (Real Property: $50M, Personal: $0, Centrally Assessed: $10M)
   - Growth rates for 2025-2027
   - Other required TIF fields
3. Display the submission ID and verify matching tax rates

**Example Output:**
```
Available County/Agency/Project combinations:
  1. 18_Salt Lake > 01_Salt Lake City > Project Name (Year: 2025)

✅ Using: 18_Salt Lake > 01_Salt Lake City > Project Name

✅ Created test submission:
   ID: abc123-def456-...
   County: 18_Salt Lake
   Agency: 01_Salt Lake City
   Project: Project Name
   Year: 2025

📊 Tax rates matching this submission: 15
✅ Tax rates found - TIF report should work correctly.
```

### Step 3: Test TIF Report Generation

1. **Log into the application** (if not already logged in)

2. **Navigate to Internal Database tab**

3. **Find your test submission**:
   - Look for the submission ID from Step 2
   - Or search by the project name/agency

4. **Generate TIF Report**:
   - Click the "Generate TIF Report" button for that submission
   - The report should download as an Excel file

5. **Verify the Report**:
   - Open the Excel file
   - Check that tax rates are populated in the "Updated Multi-Year Budget" sheet
   - Verify the tax rates match the entities from the master tax rate database
   - Check that property values and growth rates are correctly applied

## Expected Behavior

### ✅ Success Case

When a submission has matching county/agency/project data:
- Tax rates are automatically matched from the master database
- The TIF report includes all relevant tax entities
- Calculations use the correct tax rates for projections

### ⚠️ Fallback Case

If no exact match is found:
- The system falls back to org-wide tax rates
- A warning may appear in the console
- The report will still generate, but may use generic tax rates

## Troubleshooting

### No Tax Rates Found

**Problem**: The script reports "No tax rates found matching this county/agency/project/year combination."

**Solutions**:
1. Run the bulk scraper to populate tax rates:
   ```bash
   cd server
   node scripts/scrape-counties.js
   ```
2. Verify the county/agency/project names match exactly (case-sensitive)
3. Check that the year matches (default is 2025)

### Submission Not Found

**Problem**: Can't find the test submission in the UI.

**Solutions**:
1. Verify you're logged in as the correct user
2. Check that the submission was created for your organization
3. Refresh the Internal Database tab
4. Check the browser console for errors

### Report Generation Fails

**Problem**: TIF report generation returns an error.

**Solutions**:
1. Check server console for detailed error messages
2. Verify all required fields are present in the submission:
   - `realPropertyValue`
   - `personalPropertyValue`
   - `centrallyAssessedValue`
   - `baseValue`
   - `growthRates`
3. Ensure tax rates exist (even if not matching exactly, fallback should work)

## Data Flow

```
1. User submits External Data Request
   ↓
   Form captures: county, submitterName (agency), projectAreaName (project)
   ↓
2. Submission stored in database with payload_json
   ↓
3. User requests TIF Report
   ↓
4. Backend extracts county/agency/project from submission
   ↓
5. Backend queries tax_rates table:
   WHERE county=? AND agency=? AND project=? AND year=?
   ↓
6. Tax rates passed to TIF Report Generator
   ↓
7. Excel report generated with correct tax rates
```

## Next Steps

After successful testing:
1. Create additional test submissions for different counties/agencies/projects
2. Test edge cases (missing data, partial matches)
3. Verify reports match expected calculations
4. Document any issues or improvements needed

