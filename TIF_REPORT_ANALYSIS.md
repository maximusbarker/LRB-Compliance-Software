# TIF Report Analysis - Formula Dependencies & Field Mapping

## Executive Summary

This document analyzes the Excel TIF report structure to identify:
1. **Base data fields** required for report generation
2. **Formula-derived fields** and their dependencies
3. **Missing fields** that need to be added to intake forms
4. **Fields that come from tax entity/rate import** (NOT in forms)

---

## Excel Report Structure

The TIF report has **4 sheets**:
1. **Updated Multi-Year Budget** - Main budget projections (20+ years)
2. **Sheet1** - Growth in Assessed Value analysis
3. **Annual Budget** - Year-by-year budget breakdowns
4. **Acreage** - Developed/undeveloped acreage tracking

---

## Key Formula Dependencies

### 1. Total Assessed Value
**Formula:** `Real Property + Personal Property + Centrally Assessed`

**Base Fields Required:**
- `realPropertyValue` - Real Property Assessed Value
- `personalPropertyValue` - Personal Property Assessed Value  
- `centrallyAssessedValue` - Centrally Assessed Value

**Status:** ⚠️ **NEEDS FIELDS** - Currently only `tyValue` (total) exists in forms

---

### 2. Tax Increment Revenue
**Formula:** `(Total Assessed Value - Base Year Value) × Tax Rate`

**Base Fields Required:**
- `totalAssessedValue` - Calculated from above
- `baseValue` - ✅ **EXISTS** in External Form
- `taxRatesByEntity` - ⚠️ **FROM IMPORT** (not in forms)

**Status:** ⚠️ **NEEDS TAX RATES** - Tax rates come from Excel/CSV import

---

### 3. Real Property Growth Projections
**Formula:** `Previous Year × (1 + Growth Rate)`

**Example:** 
- Year 1: `$12,506,715` (base)
- Year 2: `$12,506,715 × (1 + 0.585) = $19,825,000`
- Year 3: `$19,825,000 × (1 + 0.385) = $27,450,000`

**Base Fields Required:**
- `realPropertyValue` - Initial Real Property Value
- `growthRates` - Array of annual growth rates per year

**Status:** ⚠️ **NEEDS GROWTH RATES** - Growth rates not in forms

---

### 4. Acreage Percentages
**Formula:** 
- `% Developed = Developed Acreage / Total Acreage`
- `% Undeveloped = Undeveloped Acreage / Total Acreage`

**Base Fields Required:**
- `acreage` - ✅ **EXISTS** in External Form
- `developedAcreage` - ✅ **EXISTS** in External Form
- `undevelopedAcreage` - ✅ **EXISTS** in External Form

**Status:** ✅ **COMPLETE** - All fields exist in forms

---

## Field Mapping: Forms → Excel Report

### ✅ Fields Already in Forms

#### External Form:
- `acreage` → Total Acreage (used in Acreage sheet)
- `baseValue` → Base Year Value (used in tax increment calculations)
- `developedAcreage` → Developed Acreage (used in percentage calculations)
- `undevelopedAcreage` → Undeveloped Acreage (used in percentage calculations)
- `fundBalance` → Fund Balance (used in financial summaries)

#### Internal Form:
- `tyValue` → Total Assessed Value (used in multi-year budget)
- `taxEntityName` → Tax Entity Names (used in tax rate lookups)
- `taxEntityParticipationRate` → Participation Rates (used in revenue allocation)
- `tyOriginalBudgetRevenues` → Original Budget Revenues (used in growth analysis)
- `tyActualRevenue` → Actual Revenue (used in variance calculations)

---

## ⚠️ Missing Fields - Need to Add to Forms

### 1. Personal Property Value
- **Form:** Internal Form
- **Field Name:** `personalPropertyValue`
- **Type:** `number`
- **Required:** No (default: 0)
- **Description:** Personal Property Assessed Value
- **Note:** May be 0 for most projects, but needed for accurate totals

### 2. Centrally Assessed Value
- **Form:** Internal Form
- **Field Name:** `centrallyAssessedValue`
- **Type:** `number`
- **Required:** Yes
- **Description:** Centrally Assessed Value
- **Note:** Needed for accurate Total Assessed Value calculation

### 3. Real Property Value
- **Form:** Internal Form
- **Field Name:** `realPropertyValue`
- **Type:** `number`
- **Required:** Yes
- **Description:** Real Property Assessed Value (separate from total)
- **Note:** 
  - If `tyValue` is the total, this should be separate
  - Can be calculated as: `tyValue - personalPropertyValue - centrallyAssessedValue`
  - OR: User enters all three separately and `tyValue` becomes calculated

### 4. Growth Rates
- **Form:** Internal Form
- **Field Name:** `growthRates`
- **Type:** `array` (array of numbers, one per projected year)
- **Required:** No (can be calculated from historical data)
- **Description:** Annual growth rates for projected years
- **Note:** 
  - Used for multi-year projections
  - Can be calculated from historical assessed values OR input manually
  - Format: `[{year: 2025, rate: 0.585}, {year: 2026, rate: 0.385}, ...]`

---

## 📥 Fields from Import (NOT in Forms)

### 1. Tax Rates by Entity
- **Source:** Excel/CSV Import
- **Description:** Tax rates by entity (County, School District, City) and year
- **Format:** CSV/Excel with columns: `Entity`, `Year`, `Rate`
- **Source Website:** https://taxrates.utah.gov/CDRAIncrementPaid700.aspx
- **Instructions:**
  1. Log in as a guest
  2. Hover over "Data Entry" tab
  3. Go to "CRA Increment Paid"
  4. Navigate through different cities/counties and project areas
  5. Export/import the tax rates

**Example Structure:**
```
Entity,Year,Rate
Tooele County,2024,0.001255
Tooele County School District,2024,0.008954
Tooele City,2024,0.002554
```

### 2. Tax Entity Names (Validation)
- **Source:** Excel/CSV Import OR Form
- **Description:** Tax entity names matching the import
- **Note:** May already exist in `taxEntityName` fields but needs validation/mapping to imported rates

---

## Implementation Recommendations

### Phase 1: Add Missing Fields to Internal Form
1. Add `personalPropertyValue` field (default: 0)
2. Add `centrallyAssessedValue` field (required)
3. Add `realPropertyValue` field (required)
4. Consider making `tyValue` calculated: `realPropertyValue + personalPropertyValue + centrallyAssessedValue`

### Phase 2: Add Growth Rates
1. Add `growthRates` array field to Internal Form
2. Allow manual input OR auto-calculate from historical data
3. Store as: `[{year: 2025, rate: 0.585}, ...]`

### Phase 3: Tax Rate Import System
1. Create CSV/Excel import interface
2. Parse tax rates by entity and year
3. Store in database linked to project area
4. Validate tax entity names match form entries

### Phase 4: Report Generation
1. Use base data from forms
2. Lookup tax rates from import
3. Calculate all derived fields using formulas
4. Generate 4-sheet TIF report matching Excel structure

---

## Formula Reference

### Multi-Year Budget Calculations

**Real Property Growth:**
```
Year N = Year (N-1) × (1 + Growth Rate N)
```

**Total Assessed Value:**
```
Total = Real Property + Personal Property + Centrally Assessed
```

**Tax Increment:**
```
Increment = (Total Assessed Value - Base Year Value) × Tax Rate
```

**Acreage Percentages:**
```
% Developed = Developed Acreage / Total Acreage
% Undeveloped = Undeveloped Acreage / Total Acreage
```

---

## Next Steps

1. ✅ **Analysis Complete** - Formula dependencies identified
2. ⏳ **Add Missing Fields** - Add 4 fields to Internal Form
3. ⏳ **Build Import System** - Create tax rate import functionality
4. ⏳ **Implement Formulas** - Code calculation logic
5. ⏳ **Generate Report** - Build 4-sheet TIF report generator

---

## Files Generated

- `TIF_REPORT_FIELD_MAPPING.json` - Detailed field mapping (JSON)
- `TIF_REPORT_ANALYSIS.md` - This document (Markdown)
- `excel_analysis.json` - Raw Excel structure analysis


