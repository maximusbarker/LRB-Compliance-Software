import path from 'path';
import ExcelJS from 'exceljs';

const [startArg, endArg, sheetNameArg] = process.argv.slice(2);
if (!startArg || !endArg) {
  console.error('Usage: node inspect-template-rows.js <startRow> <endRow> [sheetName]');
  process.exit(1);
}

const startRow = parseInt(startArg, 10);
const endRow = parseInt(endArg, 10);
if (Number.isNaN(startRow) || Number.isNaN(endRow)) {
  console.error('Row arguments must be numbers');
  process.exit(1);
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  const templatePath = path.resolve('assets/TIF_Report_Template.xlsx');
  await workbook.xlsx.readFile(templatePath);
  const sheetName = sheetNameArg || 'Updated Multi-Year Budget';
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw new Error('Sheet not found');

  for (let r = startRow; r <= endRow; r++) {
    const row = sheet.getRow(r);
    const cells = [];
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const colLetter = columnToLetter(colNumber);
      let repr = cell.value;
      if (repr && typeof repr === 'object') {
        repr = JSON.stringify(repr);
      }
      cells.push(`${colLetter}${r}:${repr}`);
    });
    if (cells.length) {
      console.log(`[${sheetName}] Row ${r}: ${cells.join(' | ')}`);
    }
  }
}

function columnToLetter(num) {
  let letters = '';
  while (num > 0) {
    const rem = (num - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    num = Math.floor((num - 1) / 26);
  }
  return letters;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

