import ExcelJS from 'exceljs';
import path from 'path';

const args = process.argv.slice(2);
let sheetName = 'Updated Multi-Year Budget';
const targets = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--sheet') {
    sheetName = args[i + 1] || sheetName;
    i++;
  } else {
    targets.push(args[i]);
  }
}

if (!targets.length) {
  console.error('Usage: node log-template-cells.js [--sheet Sheet1] A14 C69 ...');
  process.exit(1);
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  const templatePath = path.resolve('assets/TIF_Report_Template.xlsx');
  await workbook.xlsx.readFile(templatePath);

  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }

  targets.forEach((cellRef) => {
    const cell = sheet.getCell(cellRef);
    console.log(
      `${sheetName}!${cellRef}`,
      'value=',
      cell.value,
      'formula=',
      cell.formula || null,
      'shared=',
      cell.sharedFormula || null
    );
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
