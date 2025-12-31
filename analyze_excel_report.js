/**
 * Script to analyze the TIF Report Excel structure
 * Run: node analyze_excel_report.js
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelPath = path.join(__dirname, 'Learning Data', '1000 North Retail CRA Model 2025 (TIF Model Copy for Dad).xlsx');

console.log('Analyzing Excel file:', excelPath);
console.log('='.repeat(80));

try {
    // Read the workbook
    const workbook = XLSX.readFile(excelPath);
    
    console.log(`\nTotal Sheets: ${workbook.SheetNames.length}\n`);
    
    // Analyze each sheet
    workbook.SheetNames.forEach((sheetName, index) => {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`SHEET ${index + 1}: "${sheetName}"`);
        console.log('='.repeat(80));
        
        const worksheet = workbook.Sheets[sheetName];
        
        // Get the range of the sheet
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        console.log(`Range: ${worksheet['!ref']}`);
        console.log(`Rows: ${range.e.r + 1}, Columns: ${range.e.c + 1}`);
        
        // Convert to JSON to see structure
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1, 
            defval: '',
            raw: false 
        });
        
        console.log(`\nFirst 20 rows of data:`);
        console.log('-'.repeat(80));
        jsonData.slice(0, 20).forEach((row, rowIndex) => {
            console.log(`Row ${rowIndex + 1}:`, JSON.stringify(row.slice(0, 10))); // First 10 columns
        });
        
        // Analyze cell types and formulas
        const cellTypes = {};
        const formulas = [];
        Object.keys(worksheet).forEach(cell => {
            if (cell.startsWith('!')) return;
            const cellObj = worksheet[cell];
            if (cellObj.f) {
                formulas.push({ cell, formula: cellObj.f });
            }
            const type = cellObj.t || 'unknown';
            cellTypes[type] = (cellTypes[type] || 0) + 1;
        });
        
        console.log(`\nCell Types:`, cellTypes);
        if (formulas.length > 0) {
            console.log(`\nFormulas found: ${formulas.length}`);
            formulas.slice(0, 10).forEach(f => {
                console.log(`  ${f.cell}: ${f.formula}`);
            });
        }
        
        // Look for merged cells
        if (worksheet['!merges']) {
            console.log(`\nMerged Cells: ${worksheet['!merges'].length}`);
            worksheet['!merges'].slice(0, 10).forEach(merge => {
                console.log(`  ${XLSX.utils.encode_range(merge)}`);
            });
        }
        
        // Analyze column structure (look for headers)
        if (jsonData.length > 0) {
            console.log(`\nColumn Headers (first row):`);
            jsonData[0].forEach((header, colIndex) => {
                if (header) {
                    console.log(`  Column ${colIndex + 1} (${XLSX.utils.encode_col(colIndex)}): "${header}"`);
                }
            });
        }
        
        // Look for data patterns
        console.log(`\nData Patterns:`);
        const numericColumns = [];
        const textColumns = [];
        
        if (jsonData.length > 1) {
            jsonData[0].forEach((header, colIndex) => {
                if (!header) return;
                const sampleValues = jsonData.slice(1, 6).map(row => row[colIndex]).filter(v => v);
                const isNumeric = sampleValues.some(v => !isNaN(parseFloat(v)) && isFinite(v));
                if (isNumeric) {
                    numericColumns.push({ header, colIndex, sampleValues: sampleValues.slice(0, 3) });
                } else {
                    textColumns.push({ header, colIndex, sampleValues: sampleValues.slice(0, 3) });
                }
            });
        }
        
        if (numericColumns.length > 0) {
            console.log(`  Numeric Columns (${numericColumns.length}):`);
            numericColumns.slice(0, 10).forEach(col => {
                console.log(`    "${col.header}": ${col.sampleValues.join(', ')}`);
            });
        }
        
        if (textColumns.length > 0) {
            console.log(`  Text Columns (${textColumns.length}):`);
            textColumns.slice(0, 10).forEach(col => {
                console.log(`    "${col.header}": ${col.sampleValues.join(', ')}`);
            });
        }
    });
    
    // Generate a summary report
    console.log(`\n\n${'='.repeat(80)}`);
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`File: ${path.basename(excelPath)}`);
    console.log(`Total Sheets: ${workbook.SheetNames.length}`);
    console.log(`Sheet Names: ${workbook.SheetNames.join(', ')}`);
    
    // Save detailed analysis to JSON
    const analysis = {
        fileName: path.basename(excelPath),
        sheetCount: workbook.SheetNames.length,
        sheets: workbook.SheetNames.map(sheetName => {
            const ws = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
            return {
                name: sheetName,
                range: ws['!ref'],
                rowCount: jsonData.length,
                columnCount: jsonData[0]?.length || 0,
                headers: jsonData[0] || [],
                sampleData: jsonData.slice(1, 11), // First 10 data rows
                mergedCells: ws['!merges'] || []
            };
        })
    };
    
    const outputPath = path.join(__dirname, 'excel_analysis.json');
    fs.writeFileSync(outputPath, JSON.stringify(analysis, null, 2));
    console.log(`\nDetailed analysis saved to: ${outputPath}`);
    
} catch (error) {
    console.error('Error analyzing Excel file:', error);
    process.exit(1);
}

