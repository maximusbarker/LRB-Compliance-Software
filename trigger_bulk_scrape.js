/**
 * Script to trigger bulk tax rate scraping
 * This will start the background process to scrape all counties, agencies, and projects
 */

const API_BASE = 'http://localhost:4000/api';

// You'll need to provide a valid auth token
// For testing, you can get one by logging in via the UI first
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

async function triggerBulkScrape() {
  try {
    console.log('🚀 Starting bulk tax rate scraper for 2025...');
    console.log('');
    
    const response = await fetch(`${API_BASE}/tax-rates/scrape-all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': AUTH_TOKEN ? `Bearer ${AUTH_TOKEN}` : ''
      },
      body: JSON.stringify({ taxYear: 2025 })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Bulk scraping started successfully!');
      console.log('');
      console.log('Status:', data.message);
      console.log('Tax Year:', data.taxYear);
      console.log('');
      console.log('📊 The process is running in the background.');
      console.log('   - This will take approximately 1-2 hours');
      console.log('   - Check server logs for progress');
      console.log('   - Rates will be stored as master rates in the database');
      console.log('');
      console.log('💡 Tip: Monitor progress in server console logs');
    } else {
      console.error('❌ Failed to start bulk scraping:');
      console.error(data.error || 'Unknown error');
      if (data.details) {
        console.error('Details:', data.details);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('');
    console.error('💡 Make sure:');
    console.error('   1. Server is running (npm start in server directory)');
    console.error('   2. You have a valid auth token (log in via UI first)');
    console.error('   3. Server is accessible at http://localhost:4000');
  }
}

triggerBulkScrape();


