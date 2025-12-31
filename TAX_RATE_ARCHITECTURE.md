# Tax Rate Architecture - Design Proposal

## Problem Statement

- Tax rates can vary by entity (County, School District, City, etc.)
- Number of entities per project can vary
- Tax rates may be project-specific (not static across all projects)
- Rates come from Utah Certified Tax Rates website
- Need to balance ease of import vs. project-specific flexibility

---

## Proposed Solution: Hybrid Approach

### 1. Master Tax Rate Library (Import)
- **Purpose**: Store all available tax rates from Utah website
- **Source**: Bulk import from CSV/Excel
- **Storage**: `tax_rates` table with `submission_id = NULL` (master rates)
- **Structure**: Entity + Year + Rate combinations

### 2. Project-Specific Tax Rate Assignment (Internal Form)
- **Purpose**: Assign/override tax rates for each project
- **Location**: Enhanced Tax Entities table in Internal Form
- **Options**:
  - **Select from Master**: Dropdown of imported rates (Entity + Year)
  - **Manual Entry**: Enter custom rate if project-specific
  - **Override**: Project can override master rate if needed

### 3. Data Flow

```
Utah Website CSV/Excel
    ↓
Import UI → Master Tax Rates (org-wide)
    ↓
Internal Form → Select/Assign Rates to Project
    ↓
TIF Report Generator → Uses assigned rates
```

---

## Database Schema

### Current: `tax_rates` table
```sql
CREATE TABLE tax_rates (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  submission_id TEXT,  -- NULL = master rate, UUID = project-specific
  entity_name TEXT NOT NULL,
  year INTEGER NOT NULL,
  rate REAL NOT NULL,
  created_at TEXT,
  updated_at TEXT
);
```

### Enhanced: Add `is_master` flag (optional)
```sql
ALTER TABLE tax_rates ADD COLUMN is_master INTEGER DEFAULT 0;
-- is_master = 1: Master rate (imported, org-wide)
-- is_master = 0: Project-specific rate
```

---

## UI Design Options

### Option A: Enhanced Tax Entities Table (Recommended)

**Current Tax Entities Table:**
- Tax Entity Name
- Participation Rate (%)
- Remittance
- Cap Amount
- Increment Paid
- Remaining Authorized

**Add Column:**
- **Tax Rate** (dropdown + manual override)
  - Dropdown: "Select from Master Rates" → Shows Entity + Year + Rate
  - Manual: "Enter Custom Rate" → Text input
  - Display: Shows selected rate or custom value

**Benefits:**
- All tax entity data in one place
- Easy to see which rates apply to which entities
- Can override master rates per project
- Maintains existing workflow

---

### Option B: Separate Tax Rate Assignment Section

**New Section in Internal Form:**
- "Tax Rate Assignment"
- Table: Entity | Year | Rate (from Master) | Override Rate
- Checkbox: "Use Master Rate" vs "Use Custom Rate"

**Benefits:**
- Clear separation of concerns
- Easy to see all rates at once
- Can bulk assign from master

**Drawbacks:**
- More UI complexity
- Separate from Tax Entities table

---

## Recommended Implementation: Option A

### Internal Form Enhancement

**Tax Entities Table - Add Tax Rate Column:**

```html
<th>Tax Entity</th>
<th>Tax Rate <span style="background: #4caf50; color: white; padding: 2px 6px; border-radius: 3px; font-size: 9px; font-weight: bold; margin-left: 4px;">TIF</span></th>
<th>Participation Rate (%)</th>
<th>Remittance</th>
...
```

**Tax Rate Cell:**
- Dropdown: "Select from Master Rates"
  - Populated from `tax_rates` where `submission_id IS NULL`
  - Format: "Entity Name (Year): Rate"
  - Example: "Tooele County (2024): 0.001255"
- Manual Input: "Enter Custom Rate"
  - Number input
  - Used if project-specific rate needed
- Display: Shows selected or custom rate

**Data Storage:**
- Store in submission: `taxEntityRate_0`, `taxEntityRate_1`, etc.
- Or store as array: `taxEntityRates: [{entity: "Tooele County", year: 2024, rate: 0.001255}, ...]`

---

## Import UI Flow

### Step 1: Import Master Rates
- Admin/User navigates to "Tax Rates" section
- Uploads CSV/Excel from Utah website
- System imports to master library (`submission_id = NULL`)
- Shows preview: "Imported 15 rates for 3 entities across 5 years"

### Step 2: Assign to Project
- User opens Internal Form for project
- In Tax Entities table, selects "Tax Rate" dropdown
- Sees available rates: "Tooele County (2024): 0.001255"
- Selects appropriate rate OR enters custom
- Saves with submission

---

## API Changes Needed

### 1. Get Master Tax Rates
```
GET /api/tax-rates/master
Returns: All master rates (submission_id IS NULL)
```

### 2. Get Project Tax Rates
```
GET /api/tax-rates/submission/:submissionId
Returns: Rates assigned to this project
```

### 3. Assign Rate to Project
```
POST /api/tax-rates/assign
Body: { submissionId, entityName, year, rate, useMaster: true/false }
```

### 4. Import Master Rates (existing, update)
```
POST /api/tax-rates/import
Body: { file, isMaster: true }  // Add isMaster flag
```

---

## Example Workflow

### Scenario: New Project Setup

1. **Admin imports master rates:**
   - Uploads CSV from Utah website
   - System stores: "Tooele County", 2024, 0.001255 (master)
   - System stores: "Tooele County School District", 2024, 0.008954 (master)
   - System stores: "Tooele City", 2024, 0.002554 (master)

2. **User creates project:**
   - Opens Internal Form
   - Adds Tax Entity: "Tooele County"
   - Clicks Tax Rate dropdown → Sees "Tooele County (2024): 0.001255"
   - Selects it → Rate auto-fills: 0.001255
   - Adds Tax Entity: "Tooele County School District"
   - Selects rate from dropdown
   - Adds Tax Entity: "Custom Entity" (not in master)
   - Enters custom rate manually: 0.001500

3. **TIF Report Generation:**
   - Uses assigned rates from submission
   - Falls back to master rates if project rate missing
   - Uses custom rates if provided

---

## Recommendation

**Go with Option A: Enhanced Tax Entities Table**

**Reasons:**
1. ✅ Keeps all tax entity data together
2. ✅ Minimal UI changes (just add one column)
3. ✅ Flexible: Can use master rates OR custom rates
4. ✅ Maintains existing workflow
5. ✅ Easy to understand: "This entity uses this rate"

**Implementation:**
1. Add "Tax Rate" column to Tax Entities table
2. Add dropdown populated from master rates
3. Add manual input option
4. Store selected/custom rates with submission
5. Update TIF generator to use assigned rates

---

## Questions to Confirm

1. **Should master rates be org-wide or project-specific?**
   - Recommendation: Org-wide (shared across all projects)

2. **Can a project override a master rate?**
   - Recommendation: Yes, allow manual entry

3. **Should we show rate history (multiple years)?**
   - Recommendation: Yes, dropdown shows "Entity (Year): Rate"

4. **What if entity doesn't exist in master?**
   - Recommendation: Allow manual entry

---

## Next Steps

1. ✅ Confirm architecture approach
2. ⏳ Update database schema (if needed)
3. ⏳ Add Tax Rate column to Internal Form Tax Entities table
4. ⏳ Create master rate import UI
5. ⏳ Add API endpoints for master rates
6. ⏳ Update TIF generator to use assigned rates


