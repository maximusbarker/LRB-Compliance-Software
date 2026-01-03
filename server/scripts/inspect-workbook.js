import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

function columnLetter(index) {
  let letter = '';
  let num = index;
  while (num > 0) {
    const rem = (num - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    num = Math.floor((num - 1) / 26);
  }
  return letter;
}

async function summarizeWorkbook(filePath, maxRows = 30, maxCols = 12) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const summary = {
    path: filePath,
    sheetCount: workbook.worksheets.length,
    sheets: []
  };

  for (const sheet of workbook.worksheets) {
    const sheetSummary = {
      name: sheet.name,
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount,
      samples: []
    };

    for (let row = 1; row <= Math.min(maxRows, sheet.rowCount); row++) {
      const rowData = { row };
      for (let col = 1; col <= maxCols; col++) {
        const cellAddress = `${columnLetter(col)}${row}`;
        const cell = sheet.getCell(cellAddress);

        if (
          cell.value !== null &&
          cell.value !== undefined &&
          cell.value !== ''
        ) {
          rowData[cellAddress] = {
            value: cell.value,
            formula: cell.formula || null
          };
        }
      }
      if (Object.keys(rowData).length > 1) {
        sheetSummary.samples.push(rowData);
      }
    }

    summary.sheets.push(sheetSummary);
  }

  return summary;
}

async function main() {
  const [filePath, outputPath, rowsArg, colsArg] = process.argv.slice(2);
  if (!filePath) {
    console.error('Usage: node inspect-workbook.js <path-to-xlsx> [output-json] [maxRows] [maxCols]');
    process.exit(1);
  }

  const absolutePath = path.resolve(filePath);
  const maxRows = rowsArg ? parseInt(rowsArg, 10) : 30;
  const maxCols = colsArg ? parseInt(colsArg, 10) : 12;
  const summary = await summarizeWorkbook(absolutePath, maxRows, maxCols);

  if (outputPath) {
    fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
    console.log(`Summary written to ${outputPath}`);
  } else {
    console.log(JSON.stringify(summary, null, 2));
  }
}

main().catch((err) => {
  console.error('Failed to inspect workbook:', err);
  process.exit(1);
});

