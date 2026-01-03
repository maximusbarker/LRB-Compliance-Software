# TIF Template Integration Plan

Source of truth: `server/assets/TIF_Report_Template.xlsx` (copied from *1000 North Retail CRA Model 2025 (TIF Model Copy for Dad).xlsx*).

## 1. Generation Flow

1. **Load template** with ExcelJS inside `generateTIFReport`.
2. **Duplicate workbook** per request (`const workbook = await ExcelJS.Workbook.xlsx.readFile(templatePath); const workingCopy = workbook;`).
3. **Populate input cells** only (leave formulas/formatting intact).
4. **Recalculate** – Excel will do this when the user opens the file; we just ensure dependency cells are filled.
5. **Return buffer** for download (later we will persist to disk + DB history).

## 2. Submission → Template Mapping

| Template Sheet / Cells | Purpose | Submission / Tax-Rate Source | Notes |
| --- | --- | --- | --- |
| Updated Multi-Year Budget `A1:E2` | Project / CRA name headers | `submission.projectAreaName` (fallback: `projectArea`, `submitterName`) | Write same string across merged cells. |
| Updated Multi-Year Budget `C8:L8` | Tax Year labels | Derived from `reportYear` (`year`, `fy`, `ty+1`) | Template already has 2024–2033; update to match base year (shift range). |
| Updated Multi-Year Budget `C9:L9` | Payment Year labels | `taxYear + 1` | Keep aligned with tax-year row. |
| Updated Multi-Year Budget `C14:L16` | Real, Personal, Centrally Assessed values (historic + projections) | `realPropertyValue`, `personalPropertyValue`, `centrallyAssessedValue` + growth projections | Template drives formulas via row 69. Strategy: write Year-0 values into `C14/C15/C16`, then compute per-year targets in helper arrays and push into `C69:V69`. |
| Updated Multi-Year Budget `C69:V69` | Manual projection inputs that feed formulas (e.g., `D14 = C69`) | Derived from growth-rate table (JSON) | Build 20-year projection array and write into row 69 (columns `C`..). |
| Updated Multi-Year Budget `C70:V70` | Calculated growth rates | Leave formula intact (no writes). |
| Updated Multi-Year Budget `C58:V58` | CRA Housing requirement percentages | `submission.percentResidential` / computed targets | If no data, leave zeros. |
| Updated Multi-Year Budget `C59:V66` etc. | Narrative + financial fields | Map from submission fields: `plannedUsesFundBalance`, `fundBalance`, `tyOriginalBudgetRevenues`, `tyActualRevenue`, `tyBaseYearRevenue`, `lifetime*`, `administrativePercent`, etc. |
| Updated Multi-Year Budget `A26` onward | Tax rate table per entity | Fetch tax rates for county/agency/project (`tax_rates` query) | For each entity, write row: entity name + rate per year (`B?` for historic, `C..V`). If more than template rows, truncate or append at bottom. |
| Updated Multi-Year Budget `A35`.. (Entity participation / remittance table) | Submission tax entity data (`taxEntityName_*` fields) | Iterate numeric suffixes until missing; map to rows (name, participation %, remittance %, caps, paid, remaining). |
| Updated Multi-Year Budget `C47`, `C48`, etc. | Aggregate sums, discount rates, NPV inputs | `discountRate`, `aggregateRemainingRevenue`, `totalAggregateExpense`, etc. |
| Updated Multi-Year Budget `C52` etc. | Narrative text (growth descriptions, plan notes, benefits) | `descriptionGrowthAssessedValue`, `descriptionOfBenefitsToTaxingEntities`, `descriptionSignificantDevelopment`, `descriptionPlanFurthered`, `descriptionOtherIssues`, `plannedUsesFundBalance`. |
| Sheet1 (Growth Analysis) | Mostly formula-driven referencing multi-year sheet | No direct writes except textual titles if needed | Ensure multi-year sheet inputs exist so formulas resolve. |
| Annual Budget | Year-by-year budget detail | Template formulas expect values; only inputs are header text and possibly revenue/expense arrays (if blank, leave). |
| Acreage | Developed/undeveloped acreage data | `acreage`, `developedAcreage`, `undevelopedAcreage`, `residentialAcreage`, `totalAuthorizedHousingUnits` | Map values to `C4:E8` etc. |
| Governing Board / Staff (within Updated Multi-Year Budget lower section) | Contact list | `governingBoardName_*`, `governingBoardTitle_*`, `agencyStaffName_*`, `agencyStaffTitle_*` | Populate sequentially; blank rows if not enough entries. |

## 3. Data Preparation Rules

1. **Growth Projections:**
   - Parse `submission.growthRates` (JSON array). If missing, fall back to constant growth or use reported property value trajectory.
   - Build 20-year list of projected real property values.
   - Row 69 receives Year1..Year20 values (columns `C`..`V`), with column `B` storing base/historic.

2. **Tax Rates:**
   - Query `tax_rates` table for the submission’s county/agency/project/year.
   - Normalize to map `{ entity_name: { [year]: rate } }`.
   - Fill template rows top-down; if fewer entities than template rows, blank fill; if more, append new rows (insert rows via ExcelJS before total row).

3. **Narrative Fields:**
   - Multi-line strings → Excel cell text (auto wrap). Keep punctuation from submission.
   - If field missing, leave template placeholder text (do not overwrite with blanks).

4. **Lists with `_0`, `_1`, … suffix:**
   - Iterate indexes until encountering undefined fields.
   - Write into consecutive rows; if template supplies more rows than data, clear remaining rows.

5. **Numeric Formatting:**
   - Use numbers only; let template’s existing formats (currency, percent) display correctly.
   - When writing percentages (e.g., 10%), write decimal (0.10) so Excel formatting handles `%`.

## 4. Implementation Tasks

1. **Config constants:**
   - Add `const TEMPLATE_PATH = path.resolve(__dirname, '../assets/TIF_Report_Template.xlsx');`

2. **Helper utilities:**
   - `loadTemplate()` returning workbook copy.
   - `setValue(sheet, address, value)` wrappers with null-guard.
   - `writeArray(sheet, startCell, values)` for row 69 / tax-rate rows.

3. **Mapping module:** create `server/src/reports/tifTemplateMapper.js` exporting functions:
   - `applyProjectMetadata(sheet, submission, year)`
   - `applyValuationInputs(sheet, submission, growthData)`
   - `applyTaxRates(sheet, rates)`
   - `applyNarratives(sheet, submission)`
   - `applyAcreage(sheet, submission)`

4. **Update `tifGenerator.js`:**
   - Replace manual worksheet creation with template loader.
   - Call mapping functions sequentially.
   - Return workbook buffer.

5. **Testing:**
   - Use `server/scripts/generate-tif-report.js` to regenerate sample.
   - Compare with template via `inspect-workbook.js`.
   - Manually open Excel to confirm formulas remain.

## 5. Open Questions / Follow-ups

1. Template includes fixed instructions in many cells (rows 30+). Confirm which ones should remain static vs overwritten with data (e.g., CRA Housing).
2. Tax rate table capacity — template shows specific number of entities; confirm max needed.
3. Some template cells currently contain `#REF!` due to missing ranges. Need to verify after data insertion whether these resolve; if not, inspect original workbook to understand intended named ranges.


