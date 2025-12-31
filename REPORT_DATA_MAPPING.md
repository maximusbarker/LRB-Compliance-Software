# PDF Report Data Mapping

This document outlines all data fields from submissions that are mapped to the PDF report sections.

## Report Structure

The report is generated **by client (city)** and includes all selected projects for that client/year. It contains the following sections:

1. **Cover Page**
2. **Table of Contents**
3. **Executive Summary Intro Page**
4. **Executive Summary**
5. **Governing Board Section**
6. **Combined Budget Section**
7. **Acreage Overview Section**
8. **Individual Project Sections** (one per selected project)

---

## Data Fields Mapped by Section

### 1. Cover Page
- `city` / `cityCounty` / `submitterName` - Client/Agency name
- `year` - Report year

### 2. Table of Contents
- `projectAreaName` / `projectArea` / `submitterName` - Project area names (for TOC entries)

### 3. Executive Summary
- `city` / `cityCounty` / `submitterName` - Agency name
- `submissions.length` - Number of project areas
- `projectAreaName` / `projectArea` / `submitterName` - List of project area names
- Static text content (Utah Code references, agency powers, etc.)

### 4. Governing Board Section
**From submissions:**
- `governingBoardName_0` through `governingBoardName_9` - Board member names
- `governingBoardTitle_0` through `governingBoardTitle_9` - Board member titles
- `agencyStaffName_0` through `agencyStaffName_9` - Staff member names
- `agencyStaffTitle_0` through `agencyStaffTitle_9` - Staff member titles

### 5. Combined Budget Section
**Aggregated across all selected projects:**
- Revenue data (summed from all projects)
- Expenditure data (summed from all projects)
- Tax increment totals
- Budget summaries

### 6. Acreage Overview Section
**Aggregated across all selected projects:**
- `acreage` / `developedAcreage` + `undevelopedAcreage` - Total acreage
- `developedAcreage` - Developed acreage
- `undevelopedAcreage` - Undeveloped acreage
- `residentialAcreage` - Residential acreage
- `percentResidential` - Percentage residential (calculated)
- `totalAuthorizedHousingUnits` - Housing units

### 7. Individual Project Sections (per project)

Each selected project gets its own section with the following pages:

#### A. Project Area Header Page
- `projectAreaName` / `projectArea` / `submitterName` / `cityCounty` - Project name

#### B. Project Area Overview Page
**Basic Information:**
- `type` / `projectType` - Project type (EDA, URA, RDA, CDA, CRA)
- `acreage` / (`developedAcreage` + `undevelopedAcreage`) - Total acreage
- `purpose` / `projectPurpose` - Project purpose
- `taxingDistrict` - Taxing district
- `taxRate` / `taxRate2024` - Tax rate

**Project Area Funds Collection Period:**
- `creationYear` - Creation year
- `baseYear` - Base year
- `termLength` / `term` - Term length
- `startYear` - Start year
- `expirationYear` - Expiration year

**Financial Metrics:**
- `baseValue` / `baseTaxableValue` - Base taxable value
- `tyValue` / `currentTaxableValue` - Current taxable value
- Calculated: Assessed value increase percentage
- `tyActualRevenue` / `currentYearRevenue` / `propertyTax2025` - Current year tax increment
- `remainingLife` - Remaining life (calculated)

**Narrative Text:**
- `descriptionGrowthAssessedValue` / `growthInAssessedValue` - Description of growth
- `descriptionSignificantDevelopment` - Description of significant development
- `descriptionPlanFurthered` - Description of how plan has been furthered
- `descriptionOtherIssues` - Description of other issues

**Interlocal Agreements:**
- `taxEntityName_0` through `taxEntityName_N` - Tax entity names
- `taxEntityParticipationRate_0` through `taxEntityParticipationRate_N` - Participation rates
- `taxEntityRemittance_0` through `taxEntityRemittance_N` - Remittance percentages
- `taxEntityCapAmount_0` through `taxEntityCapAmount_N` - Cap amounts
- `taxEntityIncrementPaid_0` through `taxEntityIncrementPaid_N` - Increment paid
- `taxEntityRemainingAuthorized_0` through `taxEntityRemainingAuthorized_N` - Remaining authorized

#### C. Fund Accountability Page
**Sources of Funds:**
- `propertyTaxIncrementTotal` / `propertyTax2025` / `currentYearRevenue` - 2025 actual
- `propertyTax2026` / `nextYearRevenue` - 2026 forecasted
- `propertyTax2027` / `followingYearRevenue` - 2027 forecasted

**Revenue Information:**
- `tyOriginalBudgetRevenues` - Tax year original budget revenues
- `tyActualRevenue` - Tax year actual revenue
- `tyBaseYearRevenue` - Tax year base year revenue
- `lifetimeRevenues` - Lifetime revenues
- `lifetimeActualRevenues` - Lifetime actual revenues
- `lifetimeBaseYearRevenues` - Lifetime base year revenues

**Project Area Budget:**
- `propertyTaxIncrementTotal` - Property tax increment total
- `propertyTaxIncrementNpv` - Property tax increment NPV
- `administrativeFeeTotal` - Administrative fee total
- `administrativeFeeNpv` - Administrative fee NPV
- `expenseTotal` - Expense total
- `expenseNpv` - Expense NPV
- `totalUsesOfFundsTotal` - Total uses of funds total
- `totalUsesOfFundsNpv` - Total uses of funds NPV

**Total Expenses:**
- `totalExpenseDescription_0` through `totalExpenseDescription_N` - Expense descriptions
- `totalExpenseAmount_0` through `totalExpenseAmount_N` - Expense amounts
- `totalExpenseNpv_0` through `totalExpenseNpv_N` - Expense NPVs

**Sources of Funds (Internal):**
- `revenueSourceDescription_0` through `revenueSourceDescription_N` - Revenue source descriptions
- `revenueSource2025Actual_0` through `revenueSource2025Actual_N` - 2025 actual
- `revenueSource2026Forecast_0` through `revenueSource2026Forecast_N` - 2026 forecast
- `revenueSource2027Forecast_0` through `revenueSource2027Forecast_N` - 2027 forecast

**Tax Increment Summary:**
- `taxIncrementEntity_0` through `taxIncrementEntity_N` - Entity names
- `taxIncrementYearActual_0` through `taxIncrementYearActual_N` - Year actual
- `taxIncrementRemainingAuthorized_0` through `taxIncrementRemainingAuthorized_N` - Remaining authorized

**Increment Distribution:**
- `incrementEntity_0` through `incrementEntity_N` - Entity descriptions
- `incrementActual_0` through `incrementActual_N` - Actual received
- `incrementRemaining_0` through `incrementRemaining_N` - Amount remaining authorized

**Financial Analysis:**
- `administrativePercentage` - Administrative percentage
- `discountRate` - Discount rate
- `aggregateRemainingRevenue` - Aggregate remaining revenue
- `discountedAggregateRemainingRevenue` - Discounted aggregate remaining revenue
- `totalAggregateExpense` - Total aggregate expense
- `totalAggregateExpenseAtNpv` - Total aggregate expense at NPV

#### D. Project Area Development Page
**Acreage Data:**
- `developedAcreage` - Developed acreage
- `undevelopedAcreage` - Undeveloped acreage
- `residentialAcreage` - Residential acreage
- Calculated: `percentResidential` - Percentage residential
- `totalAuthorizedHousingUnits` - Authorized housing units

**Development Descriptions:**
- `descriptionSignificantDevelopment` - Description of significant development
- `descriptionPlanFurthered` - Description of how plan has been furthered

**Expenses (External Form):**
- `expenseTitle_0` through `expenseTitle_N` - Expense titles
- `tyExpense_0` through `tyExpense_N` - Tax year expenses
- `cyExpense_0` through `cyExpense_N` - Current year expenses
- `nyExpense_0` through `nyExpense_N` - Next year expenses
- `tyActualSpentTotal` - Tax year actual spent total (calculated)
- `administrativePercentage` - Administrative percentage (calculated)

**Fund Balance:**
- `fundBalance` - Fund balance
- `plannedUsesFundBalance` - Planned uses for fund balance

#### E. Project Area Map Page
- `projectAreaMaps` - Array of uploaded PDF maps/images
- Maps are embedded in the PDF if available

---

## Field Name Variations

The report generation handles multiple field name variations for compatibility:

**Client/Agency:**
- `cityCounty` (primary)
- `submitterName` (fallback)
- `client` (fallback)
- `agency` (fallback)

**Project Area:**
- `projectAreaName` (primary)
- `projectArea` (fallback)
- `submitterName` (fallback)

**Year:**
- `year` (primary)
- `fy` (fallback)
- `ty` (fallback)

---

## Notes

- All numeric fields are parsed and formatted with commas and currency symbols where appropriate
- Calculated fields (like percentages, totals) are computed from base data
- Missing fields default to 'N/A' or 0 depending on context
- Dynamic arrays (like expenses, tax entities) are iterated through indices (0, 1, 2, etc.)
- The report aggregates data across all selected projects for combined sections
- Individual project sections show data specific to each project

