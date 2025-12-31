/**
 * TIF Report Calculation Helpers
 * Contains formulas and calculation logic for TIF report generation
 */

/**
 * Calculate Total Assessed Value
 * @param {number} realProperty - Real Property Assessed Value
 * @param {number} personalProperty - Personal Property Assessed Value
 * @param {number} centrallyAssessed - Centrally Assessed Value
 * @returns {number} Total Assessed Value
 */
export function calculateTotalAssessedValue(realProperty, personalProperty, centrallyAssessed) {
  return (realProperty || 0) + (personalProperty || 0) + (centrallyAssessed || 0);
}

/**
 * Calculate Tax Increment Revenue
 * @param {number} totalAssessedValue - Total Assessed Value
 * @param {number} baseYearValue - Base Year Value
 * @param {number} taxRate - Tax Rate (as decimal, e.g., 0.012763)
 * @returns {number} Tax Increment Revenue
 */
export function calculateTaxIncrement(totalAssessedValue, baseYearValue, taxRate) {
  const increment = (totalAssessedValue || 0) - (baseYearValue || 0);
  return increment * (taxRate || 0);
}

/**
 * Calculate Real Property Growth Projection
 * @param {number} previousYearValue - Previous year's Real Property Value
 * @param {number} growthRate - Growth rate (as decimal, e.g., 0.585 for 58.5%)
 * @returns {number} Projected Real Property Value
 */
export function calculateRealPropertyGrowth(previousYearValue, growthRate) {
  return (previousYearValue || 0) * (1 + (growthRate || 0));
}

/**
 * Calculate Acreage Percentages
 * @param {number} developed - Developed Acreage
 * @param {number} total - Total Acreage
 * @returns {object} Object with developed and undeveloped percentages
 */
export function calculateAcreagePercentages(developed, total) {
  if (!total || total === 0) {
    return { developedPercent: 0, undevelopedPercent: 0 };
  }
  const developedPercent = (developed || 0) / total;
  const undevelopedPercent = 1 - developedPercent;
  return {
    developedPercent,
    undevelopedPercent,
    developedPercentFormatted: `${(developedPercent * 100).toFixed(1)}%`,
    undevelopedPercentFormatted: `${(undevelopedPercent * 100).toFixed(1)}%`
  };
}

/**
 * Get Tax Rate for Entity and Year
 * @param {Array} taxRates - Array of tax rate objects
 * @param {string} entityName - Entity name (e.g., "Tooele County")
 * @param {number} year - Tax year
 * @returns {number} Tax rate or 0 if not found
 */
export function getTaxRateForEntity(taxRates, entityName, year) {
  if (!taxRates || !Array.isArray(taxRates)) return 0;
  const rate = taxRates.find(tr => 
    tr.entity_name === entityName && tr.year === year
  );
  return rate ? rate.rate : 0;
}

/**
 * Calculate Total Tax Rate (sum of all entity rates for a year)
 * @param {Array} taxRates - Array of tax rate objects
 * @param {number} year - Tax year
 * @returns {number} Total tax rate
 */
export function calculateTotalTaxRate(taxRates, year) {
  if (!taxRates || !Array.isArray(taxRates)) return 0;
  return taxRates
    .filter(tr => tr.year === year)
    .reduce((sum, tr) => sum + (tr.rate || 0), 0);
}

/**
 * Parse Growth Rates from JSON string or array
 * @param {string|Array} growthRates - Growth rates as JSON string or array
 * @returns {Array} Array of {year, rate} objects
 */
export function parseGrowthRates(growthRates) {
  if (!growthRates) return [];
  if (Array.isArray(growthRates)) return growthRates;
  try {
    const parsed = typeof growthRates === 'string' ? JSON.parse(growthRates) : growthRates;
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error parsing growth rates:', e);
    return [];
  }
}

/**
 * Format currency value
 * @param {number} value - Numeric value
 * @returns {string} Formatted currency string
 */
export function formatCurrency(value) {
  if (value === null || value === undefined || isNaN(value)) return '$0';
  return `$${parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format number with commas
 * @param {number} value - Numeric value
 * @returns {string} Formatted number string
 */
export function formatNumber(value) {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return parseFloat(value).toLocaleString('en-US');
}


