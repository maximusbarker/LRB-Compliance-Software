# Scraper Flexibility - Variable Entity Counts

## ✅ Design is Fully Flexible

The scraper is designed to handle **any number of entities** per project - from 1 entity to 100+ entities. There are **no hardcoded limits**.

---

## How It Works

### 1. Dynamic Row Detection

The scraper finds ALL rows in the table that match the entity pattern:

```javascript
// Finds ALL rows matching entity pattern (no limit)
let rows = document.querySelectorAll('[role="grid"] [role="row"]');
// Falls back to regular table rows if needed
if (rows.length === 0) {
  rows = document.querySelectorAll('table tbody tr, table tr');
}
// Filters by entity pattern (4 digits + underscore)
rows = Array.from(rows).filter(row => {
  const text = row.textContent || '';
  return text.match(/\d{4}_/);  // Matches "1010_", "2010_", etc.
});
```

### 2. Iterative Processing

Uses `forEach()` to process **every** matching row:

```javascript
// Processes ALL rows found (1, 3, 10, 100, etc.)
rows.forEach((row) => {
  // Extract entity name
  // Extract rates
  // Add to results array
});
```

### 3. Dynamic Array Building

Entities are added to an array with no size limit:

```javascript
const rates = [];  // Empty array, grows dynamically

// For each entity found:
rates.push({
  entityName: entityName,
  year: year,
  rate: primaryRate,
  // ... other fields
});
```

### 4. Database Storage

All entities are stored individually:

```javascript
// Loop through ALL entities found
for (const rate of taxRates) {
  // Insert each entity as separate database record
  db.prepare('INSERT INTO tax_rates ...').run(...);
}
```

---

## Examples

### Project with 1 Entity
```
Found: 1 entity
- TOOELE COUNTY
Stored: 1 rate record
```

### Project with 3 Entities (Example)
```
Found: 3 entities
- TOOELE
- TOOELE COUNTY SCHOOL DISTRICT  
- TOOELE CITY
Stored: 3 rate records
```

### Project with 10 Entities
```
Found: 10 entities
- Entity 1
- Entity 2
- ...
- Entity 10
Stored: 10 rate records
```

### Project with 100 Entities
```
Found: 100 entities
- Entity 1
- Entity 2
- ...
- Entity 100
Stored: 100 rate records
```

---

## Validation & Logging

The scraper includes logging to show entity counts:

```javascript
console.log(`Project "${project.text}": Found ${entityCount} entity/entities`);
```

If a project has many entities (>10), it logs a note:
```javascript
console.log(`Note: Large number of entities (${entityCount}) - scraper handles this automatically`);
```

---

## Why This Design Works

1. **No Hardcoded Limits**: Uses dynamic arrays and loops
2. **Pattern Matching**: Identifies entities by pattern, not position
3. **Iterative Processing**: Processes each row independently
4. **Scalable**: Handles 1 entity or 1000 entities the same way

---

## Edge Cases Handled

✅ **1 Entity**: Works fine - processes the single row
✅ **3 Entities**: Works fine - processes all 3 rows
✅ **10+ Entities**: Works fine - processes all rows
✅ **100+ Entities**: Works fine - processes all rows
✅ **No Entities**: Logs warning, continues to next project
✅ **Missing Rates**: Skips entity if rates not found, continues with others

---

## Database Structure

Each entity gets its own database record:

```sql
tax_rates table:
- id (unique)
- entity_name (e.g., "TOOELE", "TOOELE COUNTY SCHOOL DISTRICT")
- year (2025)
- rate (primary rate)
- real_property_rate
- personal_property_rate
- centrally_assessed_rate
- county (metadata)
- agency (metadata)
- project (metadata)
```

**No limit on number of records per project.**

---

## Testing Recommendations

To verify flexibility:

1. **Check logs** during scraping - should show varying entity counts
2. **Query database** after scraping:
   ```sql
   SELECT project, COUNT(*) as entity_count 
   FROM tax_rates 
   WHERE year = 2025 
   GROUP BY project 
   ORDER BY entity_count DESC;
   ```
3. **Spot check** projects with different entity counts
4. **Verify** all entities from a known project are captured

---

## Summary

✅ **Fully Flexible**: Handles 1 to 100+ entities
✅ **No Limits**: No hardcoded maximums
✅ **Dynamic**: Adapts to whatever is on the page
✅ **Robust**: Continues even if some entities fail
✅ **Logged**: Shows entity counts for monitoring

The scraper will automatically adapt to whatever number of entities each project has.


