# TIF Report Field Indicators

## Visual Indicators Added

All fields used by the TIF report now have visual indicators to help users identify which data is used in report generation.

---

## Indicator Style

**Green "TIF" Badge**: Small green badge next to field labels
- Background: `#4caf50` (green)
- Text: White, bold
- Size: 10px font, 2px padding
- Location: Inline with field label

**New Fields**: Light green background on entire field section
- Background: `#e8f5e9` (light green)
- Border: `#c8e6c9` (green border)
- Section header: Green accent bar

---

## External Form - TIF Fields

### Existing Fields (with TIF badge):
1. **TOTAL ACREAGE** - Used in Acreage sheet
2. **BASE VALUE** - Used in tax increment calculations
3. **DEVELOPED ACREAGE** - Used in percentage calculations
4. **UNDEVELOPED ACREAGE** - Used in percentage calculations
5. **FUND BALANCE** - Used in financial summaries

### New Fields (light green section):
1. **REAL PROPERTY VALUE** - Real Property Assessed Value
2. **PERSONAL PROPERTY VALUE** - Personal Property Assessed Value (default: 0)
3. **CENTRALLY ASSESSED VALUE** - Centrally Assessed Value
4. **GROWTH RATES (JSON Array)** - Annual growth rates for projected years

---

## Internal Form - TIF Fields

### Existing Fields (with TIF badge):
1. **Total Assessed Value** (`tyValue`) - Used in multi-year budget
2. **Tax Entity** (table header) - Used in tax rate lookups
3. **Participation Rate (%)** (table header) - Used in revenue allocation
4. **ORIGINAL BUDGET REVENUES** (table header) - Used in growth analysis
5. **ACTUAL REVENUE** (table header) - Used in variance calculations

### New Fields (light green section):
1. **REAL PROPERTY VALUE** - Real Property Assessed Value
2. **PERSONAL PROPERTY VALUE** - Personal Property Assessed Value (default: 0)
3. **CENTRALLY ASSESSED VALUE** - Centrally Assessed Value
4. **GROWTH RATES (JSON Array)** - Annual growth rates for projected years

---

## Field Usage in TIF Report

### Sheet 1: Updated Multi-Year Budget
- Real Property Value (with growth projections)
- Personal Property Value
- Centrally Assessed Value
- Total Assessed Value (calculated)
- Base Year Value
- Tax Rates (from import)
- Growth Rates

### Sheet 2: Growth Analysis
- Total Assessed Value
- Base Year Value
- Original Budget Revenues
- Actual Revenue

### Sheet 3: Annual Budget
- All assessed values
- Tax rates
- Tax increment calculations

### Sheet 4: Acreage
- Total Acreage
- Developed Acreage
- Undeveloped Acreage
- Percentage calculations

---

## Notes

- **Green badges** indicate existing fields used by TIF report
- **Light green section** indicates newly added fields for TIF report
- All TIF fields will be clearly visible during testing
- After TIF generator is confirmed working, green styling can be removed if desired


