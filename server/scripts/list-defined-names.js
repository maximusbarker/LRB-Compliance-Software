import ExcelJS from 'exceljs';
import path from 'path';

async function main() {
  const workbook = new ExcelJS.Workbook();
  const templatePath = path.resolve('assets/TIF_Report_Template.xlsx');
  await workbook.xlsx.readFile(templatePath);

  const names = workbook.definedNames?.model || [];
  console.log('Defined names count:', names.length);
  names.forEach((entry) => {
    console.log(`${entry.name}: ${entry.ranges.join(', ')}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

