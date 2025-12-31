/**
 * Utah Tax Rates Scraper
 * Scrapes tax rates from Utah Certified Tax Rates website
 * https://taxrates.utah.gov/CDRAIncrementPaid700.aspx
 */

import puppeteer from 'puppeteer';
import { db } from '../db.js';
import { v4 as uuid } from 'uuid';

/**
 * Scrape tax rates for a specific project
 * @param {Object} options - Scraping options
 * @param {number} options.taxYear - Tax year (e.g., 2024)
 * @param {string} options.county - County name (e.g., "23_TOOELE")
 * @param {string} options.agency - Agency name (e.g., "Tooele County CDRA")
 * @param {string} options.project - Project name (e.g., "1000 North Retail CRA")
 * @param {string} options.orgId - Organization ID for storing rates
 * @param {string} options.submissionId - Optional submission ID (null for master rates)
 * @returns {Promise<Array>} Array of tax rate objects
 */
export async function scrapeUtahTaxRates({ taxYear, county, agency, project, orgId, submissionId = null }) {
  let browser = null;
  
  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to page
    await page.goto('https://taxrates.utah.gov/CDRAIncrementPaid700.aspx', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    
    // Wait a bit for page to fully render
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if we're on login page, if so, click "Log In As Guest"
    const currentUrl = page.url();
    if (currentUrl.includes('Login.aspx')) {
      console.log('[utahTaxRates] On login page, attempting to log in as guest...');
      
      // Wait for page to be ready
      await page.waitForSelector('body', { timeout: 5000 });
      
      // Find and click the "Log In As Guest" submit button
      const guestButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
        return buttons.find(btn => {
          const text = (btn.textContent || btn.value || btn.innerText || '').trim();
          return text.toLowerCase().includes('log in as guest') || text.toLowerCase().includes('guest');
        });
      });
      
      let clicked = false;
      if (guestButton) {
        const buttonElement = await guestButton.asElement();
        if (buttonElement) {
          await buttonElement.click();
          clicked = true;
          console.log('[utahTaxRates] Clicked "Log In As Guest" button');
        }
      }
      
      if (clicked) {
        console.log('[utahTaxRates] Clicked guest login button, waiting for navigation...');
        try {
          await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
        } catch (error) {
          // Navigation might have already happened or page might reload
          console.log('[utahTaxRates] Navigation wait completed or timed out');
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('[utahTaxRates] After login, current URL:', page.url());
        
        // If we're on Guest.aspx, navigate to the CRA Increment Paid page
        if (page.url().includes('Guest.aspx')) {
          console.log('[utahTaxRates] Navigating to CRA Increment Paid page...');
          await page.goto('https://taxrates.utah.gov/CDRAIncrementPaid700.aspx', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } else {
        console.log('[utahTaxRates] Could not find guest login button');
      }
    }
    
    // Wait for the page to load - try multiple selector strategies
    try {
      await page.waitForSelector('select', { timeout: 15000 });
    } catch (error) {
      // Try waiting for body content instead
      await page.waitForSelector('body', { timeout: 5000 });
      // Check if selects exist and get page info for debugging
      const pageInfo = await page.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          hasSelects: document.querySelectorAll('select').length > 0,
          selectCount: document.querySelectorAll('select').length,
          bodyText: document.body?.textContent?.substring(0, 200) || 'No body'
        };
      });
      console.log('[utahTaxRates] Page info:', pageInfo);
      
      if (!pageInfo.hasSelects) {
        // Take a screenshot for debugging
        await page.screenshot({ path: 'scraper-debug.png', fullPage: true });
        throw new Error(`No select elements found on page. URL: ${pageInfo.url}, Title: ${pageInfo.title}`);
      }
    }
    
    // Select Tax Year
    const taxYearSelect = await page.$('select[name*="TaxYear"], select[id*="TaxYear"]');
    if (!taxYearSelect) {
      throw new Error('Tax Year dropdown not found');
    }
    await page.select('select[name*="TaxYear"], select[id*="TaxYear"]', taxYear.toString());
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for dropdown to update
    console.log('[utahTaxRates] Selected Tax Year:', taxYear);
    
    // Select County - need to match exact option value or text
    const countySelect = await page.$('select[name*="County"], select[id*="County"]');
    if (countySelect) {
      const countyOptions = await page.evaluate((select) => {
        return Array.from(select.options).map(opt => ({ value: opt.value, text: opt.text }));
      }, countySelect);
      console.log('[utahTaxRates] County options:', countyOptions.slice(0, 5));
      
      // Try to find matching option
      const matchingCounty = countyOptions.find(opt => 
        opt.value === county || opt.text === county || opt.value.includes(county) || opt.text.includes(county)
      );
      
      if (matchingCounty) {
        await page.select('select[name*="County"], select[id*="County"]', matchingCounty.value);
        console.log('[utahTaxRates] Selected County:', matchingCounty.value);
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for postback
      } else {
        console.log('[utahTaxRates] County not found, trying direct value:', county);
        await page.evaluate((select, value) => {
          select.value = value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }, countySelect, county);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // Select Agency
    const agencySelect = await page.$('select[name*="Agency"], select[id*="Agency"]');
    if (agencySelect) {
      const agencyOptions = await page.evaluate((select) => {
        return Array.from(select.options).map(opt => ({ value: opt.value, text: opt.text }));
      }, agencySelect);
      console.log('[utahTaxRates] Agency options:', agencyOptions);
      
      const matchingAgency = agencyOptions.find(opt => 
        opt.value === agency || opt.text === agency || opt.value.includes(agency) || opt.text.includes(agency)
      );
      
      if (matchingAgency) {
        await page.select('select[name*="Agency"], select[id*="Agency"]', matchingAgency.value);
        console.log('[utahTaxRates] Selected Agency:', matchingAgency.value);
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for postback and project dropdown to populate
      }
    }
    
    // Select Project
    const projectSelect = await page.$('select[name*="Project"], select[id*="Project"]');
    if (projectSelect) {
      const projectOptions = await page.evaluate((select) => {
        return Array.from(select.options).map(opt => ({ value: opt.value, text: opt.text }));
      }, projectSelect);
      console.log('[utahTaxRates] Project options:', projectOptions);
      
      const matchingProject = projectOptions.find(opt => 
        opt.value === project || opt.text === project || opt.value.includes(project) || opt.text.includes(project)
      );
      
      if (matchingProject) {
        await page.select('select[name*="Project"], select[id*="Project"]', matchingProject.value);
        console.log('[utahTaxRates] Selected Project:', matchingProject.value);
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for table to load
      }
    }
    
    // Wait for the data table to load
    try {
      await page.waitForSelector('table[role="grid"], [role="grid"]', { timeout: 15000 });
    } catch (error) {
      // Try alternative selectors
      await page.waitForSelector('table', { timeout: 10000 });
    }
    await new Promise(resolve => setTimeout(resolve, 3000)); // Additional wait for data to render
    
    // Debug: Check what's on the page
    const pageDebug = await page.evaluate(() => {
      return {
        hasGrid: document.querySelectorAll('[role="grid"]').length,
        hasTable: document.querySelectorAll('table').length,
        gridRows: document.querySelectorAll('[role="grid"] [role="row"]').length,
        allRows: document.querySelectorAll('tr, [role="row"]').length
      };
    });
    console.log('[utahTaxRates] Page debug info:', pageDebug);
    
    // Extract tax rates from the table
    const taxRates = await page.evaluate((year) => {
      const rates = [];
      
      // Try multiple strategies to find entity rows
      // Strategy 1: Look in grid rows
      let rows = document.querySelectorAll('[role="grid"] [role="row"]');
      
      // Strategy 2: If no grid rows, look in regular table rows
      if (rows.length === 0) {
        rows = document.querySelectorAll('table tbody tr, table tr');
      }
      
      // Strategy 3: Look for any row containing entity pattern
      if (rows.length === 0) {
        const allRows = document.querySelectorAll('tr, [role="row"]');
        rows = Array.from(allRows).filter(row => {
          const text = row.textContent || '';
          return text.match(/\d{4}_/);
        });
      }
      
      rows.forEach((row, rowIndex) => {
        // Get all cells (td, th, or gridcell)
        const cells = row.querySelectorAll('td, th, [role="gridcell"]');
        if (cells.length < 3) return;
        
        // First cell should contain entity name
        const firstCell = cells[0];
        const entityText = firstCell?.textContent?.trim() || '';
        
        // Check if this looks like an entity row (has entity code pattern like "1010_" or "2010_")
        if (!entityText.match(/^\d{4}_/)) return;
        
        // Extract entity name - remove the numeric prefix
        const entityName = entityText.trim();
        if (!entityName) return;
        
        // Get all text from all cells in the row to find rates
        const allCellTexts = Array.from(cells).map(cell => cell.textContent?.trim() || '');
        
        // Look for rates in all cells
        // Rates appear as: 0.001255, 0.000951, 0.001255 (Real, Personal, Centrally Assessed)
        let realPropertyRate = null;
        let personalPropertyRate = null;
        let centrallyAssessedRate = null;
        
        allCellTexts.forEach((text, index) => {
          // Match rate pattern: 0.001519 or 0.001550 (decimal with 4-6 digits after decimal)
          const rateMatch = text.match(/^0\.\d{4,6}$/);
          if (rateMatch) {
            const rate = parseFloat(text);
            
            // Collect the first three rates we find (they should be in order: Real, Personal, Centrally Assessed)
            if (realPropertyRate === null) {
              realPropertyRate = rate;
            } else if (personalPropertyRate === null) {
              personalPropertyRate = rate;
            } else if (centrallyAssessedRate === null) {
              centrallyAssessedRate = rate;
            }
          }
        });
        
        // Use Real Property Rate as primary (most common), or first available rate
        const primaryRate = realPropertyRate || personalPropertyRate || centrallyAssessedRate;
        
        if (entityName && primaryRate !== null) {
          rates.push({
            entityName: entityName,
            year: year,
            rate: primaryRate,
            realPropertyRate: realPropertyRate,
            personalPropertyRate: personalPropertyRate,
            centrallyAssessedRate: centrallyAssessedRate
          });
        }
      });
      
      return rates;
    }, taxYear);
    
    console.log('[utahTaxRates] Extracted', taxRates.length, 'entity/entities with tax rates');
    if (taxRates.length > 0) {
      console.log('[utahTaxRates] Sample rate:', taxRates[0]);
      if (taxRates.length > 1) {
        console.log('[utahTaxRates] Entity count distribution: 1-' + taxRates.length + ' entities (flexible design handles any number)');
      }
    }
    
    // Store rates in database
    const now = new Date().toISOString();
    const storedRates = [];
    
    for (const rate of taxRates) {
      const id = uuid();
      db.prepare(`
        INSERT INTO tax_rates (id, org_id, submission_id, entity_name, year, rate, real_property_rate, personal_property_rate, centrally_assessed_rate, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        orgId,
        submissionId,
        rate.entityName,
        rate.year,
        rate.rate,
        rate.realPropertyRate,
        rate.personalPropertyRate,
        rate.centrallyAssessedRate,
        now,
        now
      );
      
      storedRates.push({
        id,
        entityName: rate.entityName,
        year: rate.year,
        rate: rate.rate,
        realPropertyRate: rate.realPropertyRate,
        personalPropertyRate: rate.personalPropertyRate,
        centrallyAssessedRate: rate.centrallyAssessedRate
      });
    }
    
    return {
      success: true,
      scraped: taxRates.length,
      stored: storedRates.length,
      rates: storedRates
    };
    
  } catch (error) {
    console.error('[utahTaxRates] Scraping error:', error);
    throw new Error(`Scraping failed: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Scrape all tax rates for a given tax year across all counties, agencies, and projects
 * @param {Object} options - Bulk scraping options
 * @param {number} options.taxYear - Tax year (e.g., 2025)
 * @param {string} options.orgId - Organization ID for storing rates
 * @param {Function} options.onProgress - Optional progress callback (county, agency, project, ratesCount)
 * @returns {Promise<Object>} Summary of scraping results
 */
export async function scrapeAllUtahTaxRates({ taxYear, orgId, countyFilters = null, onProgress = null }) {
  let browser = null;
  const results = {
    availableCounties: 0,
    totalCounties: 0,
    totalAgencies: 0,
    totalProjects: 0,
    totalRates: 0,
    errors: [],
    counties: [],
    countyFilters: null
  };
  const normalizedCountyFilters =
    Array.isArray(countyFilters) && countyFilters.length
      ? countyFilters
          .map((value) => (value ?? '').toString().trim())
          .filter(Boolean)
          .map((value) => value.toUpperCase())
      : null;
  if (normalizedCountyFilters) {
    results.countyFilters = normalizedCountyFilters;
  }
  
  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate and login
    await page.goto('https://taxrates.utah.gov/CDRAIncrementPaid700.aspx', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Login as guest
    const currentUrl = page.url();
    if (currentUrl.includes('Login.aspx')) {
      const guestButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
        return buttons.find(btn => {
          const text = (btn.textContent || btn.value || btn.innerText || '').trim();
          return text.toLowerCase().includes('log in as guest') || text.toLowerCase().includes('guest');
        });
      });
      
      if (guestButton) {
        const buttonElement = await guestButton.asElement();
        if (buttonElement) {
          await buttonElement.click();
          await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          if (page.url().includes('Guest.aspx')) {
            await page.goto('https://taxrates.utah.gov/CDRAIncrementPaid700.aspx', {
              waitUntil: 'domcontentloaded',
              timeout: 30000
            });
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
    }
    
    // Select tax year first
    const taxYearSelect = await page.$('select[name*="TaxYear"], select[id*="TaxYear"]');
    if (!taxYearSelect) {
      throw new Error('Tax Year dropdown not found');
    }
    await page.select('select[name*="TaxYear"], select[id*="TaxYear"]', taxYear.toString());
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get all counties
    const counties = await page.evaluate(() => {
      const select = document.querySelector('select[name*="County"], select[id*="County"]');
      if (!select) return [];
      return Array.from(select.options)
        .filter(opt => opt.value && opt.value !== '')
        .map(opt => ({ value: opt.value, text: opt.text }));
    });
    
    results.availableCounties = counties.length;
    let countiesToProcess = counties;
    if (normalizedCountyFilters) {
      countiesToProcess = counties.filter((county) => {
        const valueKey = (county.value || '').toString().trim().toUpperCase();
        const textKey = (county.text || '').toString().trim().toUpperCase();
        return normalizedCountyFilters.includes(valueKey) || normalizedCountyFilters.includes(textKey);
      });
      console.log(
        `[bulkScrape] County filter applied (${normalizedCountyFilters.join(
          ', '
        )}). Processing ${countiesToProcess.length} of ${counties.length} counties`
      );
    }
    
    if (countiesToProcess.length === 0) {
      console.warn('[bulkScrape] No counties matched the provided filter. Aborting scrape.');
      results.totalCounties = 0;
      return results;
    }
    
    results.totalCounties = countiesToProcess.length;
    console.log(`[bulkScrape] Found ${counties.length} counties (processing ${countiesToProcess.length})`);
    
    // Iterate through each county
    for (const county of countiesToProcess) {
      const countyResult = {
        county: county.text,
        countyValue: county.value,
        agencies: [],
        totalRates: 0,
        errors: []
      };
      
      try {
        // Select county
        await page.select('select[name*="County"], select[id*="County"]', county.value);
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for postback
        
        // Get all agencies for this county
        const agencies = await page.evaluate(() => {
          const select = document.querySelector('select[name*="Agency"], select[id*="Agency"]');
          if (!select) return [];
          return Array.from(select.options)
            .filter(opt => opt.value && opt.value !== '' && opt.text && opt.text.trim() !== '')
            .map(opt => ({ 
              value: opt.value || '', 
              text: opt.text ? opt.text.trim() : opt.value || 'Unknown Agency'
            }));
        });
        
        countyResult.agencies = agencies;
        results.totalAgencies += agencies.length;
        console.log(`[bulkScrape] County ${county.text}: Found ${agencies.length} agencies`);
        
        // Iterate through each agency
        for (const agency of agencies) {
          // Validate agency has required properties
          if (!agency || !agency.value) {
            console.log(`[bulkScrape] Skipping invalid agency in ${county.text}`);
            continue;
          }
          
          const agencyName = agency.text || agency.value || 'Unknown Agency';
          const agencyResult = {
            agency: agencyName,
            agencyValue: agency.value,
            projects: [],
            totalRates: 0,
            errors: []
          };
          
          try {
            // Select agency
            await page.select('select[name*="Agency"], select[id*="Agency"]', agency.value);
            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for postback and project dropdown
            
            // Get all projects for this agency
            const projects = await page.evaluate(() => {
              const select = document.querySelector('select[name*="Project"], select[id*="Project"]');
              if (!select) return [];
              return Array.from(select.options)
                .filter(opt => opt.value && opt.value !== '' && opt.text && opt.text.trim() !== '')
                .map(opt => ({ 
                  value: opt.value || '', 
                  text: opt.text ? opt.text.trim() : opt.value || 'Unknown Project'
                }));
            });
            
            agencyResult.projects = projects;
            results.totalProjects += projects.length;
            console.log(`[bulkScrape] Agency ${agencyName}: Found ${projects.length} projects`);
            
            // Iterate through each project
            for (const project of projects) {
              // Validate project has required properties
              if (!project || !project.value) {
                console.log(`[bulkScrape] Skipping invalid project in ${county.text} > ${agencyName}`);
                continue;
              }
              
              const projectName = project.text || project.value || 'Unknown Project';
              
              try {
                // Select project
                await page.select('select[name*="Project"], select[id*="Project"]', project.value);
                await new Promise(resolve => setTimeout(resolve, 4000)); // Wait for postback and table to load
                
                // Wait for data table or "no data" message
                try {
                  await page.waitForSelector('table[role="grid"], [role="grid"], table', { timeout: 15000 });
                } catch (error) {
                  // Table might not exist if there's no data
                  console.log(`[bulkScrape] No table found for project "${projectName}", checking for no data message`);
                }
                await new Promise(resolve => setTimeout(resolve, 3000)); // Additional wait for data to render
                
                // Check for "No Participating Entities Found" or similar no-data messages
                const pageContent = await page.evaluate(() => {
                  const bodyText = document.body.textContent || '';
                  const hasNoDataMessage = bodyText.includes('No Participating Entities Found') || 
                                          bodyText.includes('No entities found') ||
                                          bodyText.includes('No data available');
                  
                  // Check if entity table exists and has data rows
                  let rows = document.querySelectorAll('[role="grid"] [role="row"]');
                  if (rows.length === 0) {
                    rows = document.querySelectorAll('table tbody tr, table tr');
                  }
                  
                  // Filter for entity rows (those with entity code pattern)
                  const entityRows = Array.from(rows).filter(row => {
                    const text = row.textContent || '';
                    return text.match(/^\d{4}_/);
                  });
                  
                  return {
                    hasNoDataMessage: hasNoDataMessage,
                    totalRows: rows.length,
                    entityRows: entityRows.length,
                    sampleText: bodyText.substring(0, 500)
                  };
                });
                
                // If no data message found, store a "no data" record
                if (pageContent.hasNoDataMessage || (pageContent.entityRows === 0 && pageContent.totalRows > 0)) {
                  console.log(`[bulkScrape] Project "${projectName}": No data found (No Participating Entities)`);
                  
                  // Store a "no data" record in database
                  const existing = db.prepare(`
                    SELECT id FROM tax_rates 
                    WHERE org_id = ? AND submission_id IS NULL 
                      AND entity_name = ? AND year = ?
                      AND county = ? AND agency = ? AND project = ?
                  `).get(
                    orgId,
                    'NO_DATA',
                    taxYear,
                    county.text || '',
                    agencyName || '',
                    projectName || ''
                  );
                  
                  if (!existing) {
                    const id = uuid();
                    const now = new Date().toISOString();
                    db.prepare(`
                      INSERT INTO tax_rates (
                        id, org_id, submission_id, entity_name, year, rate,
                        real_property_rate, personal_property_rate, centrally_assessed_rate,
                        county, agency, project, created_at, updated_at
                      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                      id,
                      orgId,
                      null,
                      'NO_DATA',
                      taxYear,
                      0, // No rate
                      null,
                      null,
                      null,
                      county.text || '',
                      agencyName || '',
                      projectName || '',
                      now,
                      now
                    );
                    console.log(`[bulkScrape] Stored "NO_DATA" record for project "${projectName}"`);
                  }
                  
                  if (onProgress) {
                    onProgress(county.text, agencyName, projectName, 0);
                  }
                  
                  console.log(`[bulkScrape] ${county.text} > ${agencyName} > ${projectName}: No data (stored NO_DATA record)`);
                  continue; // Skip to next project
                }
                
                // Extract tax rates (handles any number of entities - 1, 3, 10, 100, etc.)
                const taxRates = await page.evaluate((year) => {
                  const rates = [];
                  
                  // Find all rows that might contain entity data
                  let rows = document.querySelectorAll('[role="grid"] [role="row"]');
                  if (rows.length === 0) {
                    rows = document.querySelectorAll('table tbody tr, table tr');
                  }
                  if (rows.length === 0) {
                    const allRows = document.querySelectorAll('tr, [role="row"]');
                    rows = Array.from(allRows).filter(row => {
                      const text = row.textContent || '';
                      return text.match(/\d{4}_/);
                    });
                  }
                  
                  // Process ALL rows that match entity pattern (no limit)
                  rows.forEach((row) => {
                    const cells = row.querySelectorAll('td, th, [role="gridcell"]');
                    if (cells.length < 3) return;
                    
                    const firstCell = cells[0];
                    const entityText = firstCell?.textContent?.trim() || '';
                    
                    // Skip if this is a header row or doesn't match entity pattern
                    if (!entityText.match(/^\d{4}_/)) return;
                    
                    const entityName = entityText.trim();
                    if (!entityName) return;
                    
                    const allCellTexts = Array.from(cells).map(cell => cell.textContent?.trim() || '');
                    
                    let realPropertyRate = null;
                    let personalPropertyRate = null;
                    let centrallyAssessedRate = null;
                    
                    allCellTexts.forEach((text) => {
                      // Match rate pattern: 0.001519 or 0.001550 (decimal with 4-6 digits after decimal)
                      const rateMatch = text.match(/^0\.\d{4,6}$/);
                      if (rateMatch) {
                        const rate = parseFloat(text);
                        // Collect the first three rates we find (Real, Personal, Centrally Assessed)
                        if (realPropertyRate === null) {
                          realPropertyRate = rate;
                        } else if (personalPropertyRate === null) {
                          personalPropertyRate = rate;
                        } else if (centrallyAssessedRate === null) {
                          centrallyAssessedRate = rate;
                        }
                      }
                    });
                    
                    const primaryRate = realPropertyRate || personalPropertyRate || centrallyAssessedRate;
                    
                    if (entityName && primaryRate !== null) {
                      rates.push({
                        entityName: entityName,
                        year: year,
                        rate: primaryRate,
                        realPropertyRate: realPropertyRate,
                        personalPropertyRate: personalPropertyRate,
                        centrallyAssessedRate: centrallyAssessedRate
                      });
                    }
                  });
                  
                  return rates;
                }, taxYear);
                
                // Log entity count for this project
                const entityCount = taxRates.length;
                console.log(`[bulkScrape] Project "${projectName}": Found ${entityCount} entity/entities`);
                if (entityCount > 10) {
                  console.log(`[bulkScrape] Note: Large number of entities (${entityCount}) - scraper handles this automatically`);
                }
                if (entityCount === 0) {
                  // Double-check: if we got here but have 0 entities, it might be a no-data case
                  // Store NO_DATA record
                  const existing = db.prepare(`
                    SELECT id FROM tax_rates 
                    WHERE org_id = ? AND submission_id IS NULL 
                      AND entity_name = ? AND year = ?
                      AND county = ? AND agency = ? AND project = ?
                  `).get(
                    orgId,
                    'NO_DATA',
                    taxYear,
                    county.text || '',
                    agencyName || '',
                    projectName || ''
                  );
                  
                  if (!existing) {
                    const id = uuid();
                    const now = new Date().toISOString();
                    db.prepare(`
                      INSERT INTO tax_rates (
                        id, org_id, submission_id, entity_name, year, rate,
                        real_property_rate, personal_property_rate, centrally_assessed_rate,
                        county, agency, project, created_at, updated_at
                      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                      id,
                      orgId,
                      null,
                      'NO_DATA',
                      taxYear,
                      0,
                      null,
                      null,
                      null,
                      county.text || '',
                      agencyName || '',
                      projectName || '',
                      now,
                      now
                    );
                    console.log(`[bulkScrape] Stored "NO_DATA" record for project "${projectName}" (no entities found)`);
                  }
                  
                  if (onProgress) {
                    onProgress(county.text, agencyName, projectName, 0);
                  }
                  
                  console.log(`[bulkScrape] ${county.text} > ${agencyName} > ${projectName}: No data (0 entities found)`);
                  continue; // Skip to next project
                }
                
                // Use the rates array directly
                const ratesArray = taxRates;
                
                // Store rates in database
                const now = new Date().toISOString();
                let storedCount = 0;
                
                // Process ALL entities found (1, 3, 10, 100, etc. - no limit)
                for (const rate of ratesArray) {
                  // Check if rate already exists (avoid duplicates)
                  const existing = db.prepare(`
                    SELECT id FROM tax_rates 
                    WHERE org_id = ? AND submission_id IS NULL 
                      AND entity_name = ? AND year = ?
                      AND county = ? AND agency = ? AND project = ?
                  `).get(
                    orgId,
                    rate.entityName,
                    rate.year,
                    county.text || '',
                    agencyName || '',
                    projectName || ''
                  );
                  
                  if (!existing) {
                    const id = uuid();
                    db.prepare(`
                      INSERT INTO tax_rates (
                        id, org_id, submission_id, entity_name, year, rate,
                        real_property_rate, personal_property_rate, centrally_assessed_rate,
                        county, agency, project, created_at, updated_at
                      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                      id,
                      orgId,
                      null, // Master rate
                      rate.entityName,
                      rate.year,
                      rate.rate,
                      rate.realPropertyRate,
                      rate.personalPropertyRate,
                      rate.centrallyAssessedRate,
                      county.text || '',
                      agencyName || '',
                      projectName || '',
                      now,
                      now
                    );
                    storedCount++;
                  }
                }
                
                agencyResult.totalRates += storedCount;
                countyResult.totalRates += storedCount;
                results.totalRates += storedCount;
                
                if (onProgress) {
                  onProgress(county.text, agencyName, projectName, storedCount);
                }
                
                console.log(`[bulkScrape] ${county.text} > ${agencyName} > ${projectName}: ${entityCount} entity/entities, ${storedCount} rates stored`);
                
              } catch (error) {
                const errorMsg = `Error scraping ${county.text} > ${agencyName} > ${projectName}: ${error.message}`;
                console.error(`[bulkScrape] ${errorMsg}`);
                agencyResult.errors.push(errorMsg);
                countyResult.errors.push(errorMsg);
                results.errors.push(errorMsg);
              }
            }
            
          } catch (error) {
            const errorMsg = `Error processing agency ${county.text} > ${agencyName}: ${error.message}`;
            console.error(`[bulkScrape] ${errorMsg}`);
            countyResult.errors.push(errorMsg);
            results.errors.push(errorMsg);
          }
          
          countyResult.agencies.push(agencyResult);
        }
        
      } catch (error) {
        const errorMsg = `Error processing county ${county.text}: ${error.message}`;
        console.error(`[bulkScrape] ${errorMsg}`);
        countyResult.errors.push(errorMsg);
        results.errors.push(errorMsg);
      }
      
      results.counties.push(countyResult);
    }
    
    return results;
    
  } catch (error) {
    console.error('[bulkScrape] Fatal error:', error);
    throw new Error(`Bulk scraping failed: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Get available options from the website (counties, agencies, projects)
 * @returns {Promise<Object>} Object with available options
 */
export async function getUtahTaxRateOptions() {
  let browser = null;
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.goto('https://taxrates.utah.gov/CDRAIncrementPaid700.aspx', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Login as guest if needed
    try {
      const loginButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"]'));
        return buttons.find(btn => {
          const text = btn.textContent?.trim() || '';
          return text.includes('Log In As Guest') || text.includes('Guest Login') || text.includes('Login as Guest');
        });
      });
      
      if (loginButton) {
        const buttonExists = await loginButton.evaluate(el => el !== null);
        if (buttonExists) {
          await loginButton.click();
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
        }
      }
    } catch (error) {
      // No login button found or already logged in - continue
      console.log('[utahTaxRates] No login required or already logged in');
    }
    
    // Extract dropdown options
    const options = await page.evaluate(() => {
      const result = {
        counties: [],
        agencies: [],
        projects: []
      };
      
      // Get counties
      const countySelect = document.querySelector('select[name*="County"], select[id*="County"]');
      if (countySelect) {
        Array.from(countySelect.options).forEach(opt => {
          if (opt.value) {
            result.counties.push({
              value: opt.value,
              text: opt.text
            });
          }
        });
      }
      
      // Get agencies (may need to select a county first)
      const agencySelect = document.querySelector('select[name*="Agency"], select[id*="Agency"]');
      if (agencySelect) {
        Array.from(agencySelect.options).forEach(opt => {
          if (opt.value) {
            result.agencies.push({
              value: opt.value,
              text: opt.text
            });
          }
        });
      }
      
      // Get projects (may need to select agency first)
      const projectSelect = document.querySelector('select[name*="Project"], select[id*="Project"]');
      if (projectSelect) {
        Array.from(projectSelect.options).forEach(opt => {
          if (opt.value) {
            result.projects.push({
              value: opt.value,
              text: opt.text
            });
          }
        });
      }
      
      return result;
    });
    
    return options;
    
  } catch (error) {
    console.error('[utahTaxRates] Options error:', error);
    throw new Error(`Failed to get options: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

