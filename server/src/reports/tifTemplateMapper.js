import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const TEMPLATE_PATH = path.resolve(__dirname, '../../assets/TIF_Report_Template.xlsx');

export function applyTemplateMappings(workbook, submission, taxRates, { baseYear, projectionYears = 20 }) {
  const submissionData = submission || {};
  const multiYearSheet = workbook.getWorksheet('Updated Multi-Year Budget');
  if (!multiYearSheet) {
    throw new Error('Template is missing the "Updated Multi-Year Budget" sheet.');
  }

  const yearColumns = getYearColumns(multiYearSheet);
  const displayYear = determineDisplayYear(submissionData, baseYear);
  fillProjectHeaders(multiYearSheet, submissionData);
  fillRealPropertyProjections(multiYearSheet, submissionData, yearColumns, baseYear, projectionYears);
  fillPersonalAndCentrallyAssessed(multiYearSheet, submissionData, yearColumns);
  fillBaseYearValues(multiYearSheet, submissionData, yearColumns);
  fillFundBalance(multiYearSheet, submissionData, yearColumns);
  fillHousingRequirementAndPayments(multiYearSheet, submissionData, yearColumns);
  fillRevenueInformation(multiYearSheet, submissionData, displayYear);
  fillNarrativeFields(multiYearSheet, submissionData);
  fillTaxRatesTable(multiYearSheet, taxRates, yearColumns);
  fillTaxEntitySections(multiYearSheet, submissionData);
  fillGoverningBoard(multiYearSheet, submissionData);

  const acreageSheet = workbook.getWorksheet('Acreage');
  if (acreageSheet) {
    fillAcreageSheet(acreageSheet, submissionData);
  }
}

function fillProjectHeaders(sheet, submission) {
  const projectName =
    submission.projectAreaName ||
    submission.projectArea ||
    submission.submitterName ||
    submission.client ||
    'Project Area';

  ['A1', 'B1', 'C1', 'D1', 'E1'].forEach((cellRef) => {
    sheet.getCell(cellRef).value = projectName;
  });
}

function fillRealPropertyProjections(sheet, submission, yearColumns, baseYear, projectionYears) {
  const realSeries = buildRealPropertySeries(submission, baseYear, projectionYears);
  const row = sheet.getRow(69);

  yearColumns.forEach(({ col, year }) => {
    const index = year - baseYear;
    const value = index >= 0 && index < realSeries.length ? realSeries[index] : realSeries[0];
    row.getCell(col).value = value;

    if (col === 2 || col === 3) {
      sheet.getRow(14).getCell(col).value = value;
    }
  });

  row.commit();
}

function fillPersonalAndCentrallyAssessed(sheet, submission, yearColumns) {
  const personalValue = parseNumber(submission.personalPropertyValue, 0);
  const centrallyValue = parseNumber(submission.centrallyAssessedValue, 0);

  const personalRow = sheet.getRow(15);
  const centrallyRow = sheet.getRow(16);

  yearColumns.forEach(({ col }) => {
    personalRow.getCell(col).value = personalValue;
    centrallyRow.getCell(col).value = centrallyValue;
  });

  personalRow.commit();
  centrallyRow.commit();
}

function fillBaseYearValues(sheet, submission, yearColumns) {
  const startRow = findRowIndex(sheet, 'A', 'Base Year Value');
  if (!startRow) return;

  const realRow = sheet.getRow(startRow + 1);
  const personalRow = sheet.getRow(startRow + 2);
  const centrallyRow = sheet.getRow(startRow + 3);
  const totalRow = sheet.getRow(startRow + 4);

  const realValue = parseNumber(submission.baseValue ?? submission.baseTaxableValue, null);
  const personalValue = parseNumber(submission.basePersonalPropertyValue, null);
  const centrallyValue = parseNumber(submission.baseCentrallyAssessedValue, null);

  if (realValue !== null) realRow.getCell(yearColumns[0]?.col || 3).value = realValue;
  if (personalValue !== null) personalRow.getCell(yearColumns[0]?.col || 3).value = personalValue;
  if (centrallyValue !== null) centrallyRow.getCell(yearColumns[0]?.col || 3).value = centrallyValue;

  if (realValue !== null || personalValue !== null || centrallyValue !== null) {
    totalRow.getCell(yearColumns[0]?.col || 3).value =
      parseNumber(realValue, 0) + parseNumber(personalValue, 0) + parseNumber(centrallyValue, 0);
  }
}

function fillFundBalance(sheet, submission, yearColumns) {
  const rowIndex = findRowIndex(sheet, 'A', 'RDA Fund Balance');
  if (!rowIndex) return;
  const balance = parseNumber(submission.fundBalance ?? submission.rdaFundBalance, null);
  if (balance === null) return;

  const row = sheet.getRow(rowIndex);
  yearColumns.forEach(({ col }) => {
    row.getCell(col).value = balance;
  });
  row.commit();
}

function fillHousingRequirementAndPayments(sheet, submission, yearColumns) {
  const housingRow = findRowIndexContains(sheet, 'A', 'CRA Housing Requirement');
  if (housingRow) {
    const perYear = parseNumberOrNull(
      submission.craHousingRequirement ??
        submission.housingRequirement ??
        submission.housingRequirementAnnual
    );
    if (perYear !== null) {
      let total = 0;
      yearColumns.forEach(({ col }) => {
        sheet.getRow(housingRow).getCell(col).value = perYear;
        total += perYear;
      });
      sheet.getRow(housingRow).commit();
      setNumberIfPresent(sheet, `AM${housingRow}`, total);
      setNumberIfPresent(sheet, `AN${housingRow}`, total);
    }
  }

  const guaranteedRow = findRowIndexContains(sheet, 'A', 'Guaranteed Developer Payment');
  if (guaranteedRow) {
    const payment = parseNumberOrNull(
      submission.guaranteedDeveloperPayment ??
        submission.developerGuaranteedPayment ??
        submission.developerPayment
    );
    if (payment !== null) {
      const limitYears =
        parseNumber(submission.guaranteedDeveloperPaymentYears, yearColumns.length) ||
        yearColumns.length;
      yearColumns.forEach(({ col }, idx) => {
        const amount = idx < limitYears ? payment : 0;
        sheet.getRow(guaranteedRow).getCell(col).value = amount;
      });
      sheet.getRow(guaranteedRow).commit();
      const total = payment * Math.min(limitYears, yearColumns.length);
      setNumberIfPresent(sheet, `W${guaranteedRow}`, total);
    }
  }

  const reimbursementRow = findRowIndexContains(sheet, 'A', 'Developer Reimbursement');
  if (reimbursementRow) {
    const reimbursementNote =
      submission.developerReimbursementNote ||
      submission.developerReimbursementDetails ||
      null;
    const reimbursementRate = parseNumberOrNull(submission.developerReimbursementRate);
    const noteParts = [];
    if (reimbursementRate !== null) {
      noteParts.push(`Reimbursement ${formatPercent(reimbursementRate)}`);
    }
    if (submission.developerReimbursementCap) {
      noteParts.push(`Cap ${formatCurrency(submission.developerReimbursementCap)}`);
    }
    if (reimbursementNote) {
      noteParts.push(reimbursementNote);
    }
    if (noteParts.length) {
      sheet.getRow(reimbursementRow).getCell(24).value = noteParts.join(' | ');
    }
  }
}

function fillNarrativeFields(sheet, submission) {
  setIfPresent(sheet, 'C52', submission.descriptionGrowthAssessedValue);
  setIfPresent(sheet, 'C53', submission.descriptionSignificantDevelopment);
  setIfPresent(sheet, 'C54', submission.plannedUsesFundBalance);
  setIfPresent(sheet, 'C55', submission.descriptionOfBenefitsToTaxingEntities);
  setIfPresent(sheet, 'C56', submission.descriptionPlanFurthered);
  setIfPresent(sheet, 'C57', submission.descriptionOtherIssues);
}

function setIfPresent(sheet, cellRef, value) {
  if (value !== undefined && value !== null && value !== '') {
    sheet.getCell(cellRef).value = value;
  }
}

function fillRevenueInformation(sheet, submission, displayYear) {
  const tyRow = findRowIndexContains(sheet, 'C', 'Tax Year', { startRow: 18 });
  if (tyRow) {
    sheet.getCell(`C${tyRow}`).value = `Tax Year ${displayYear}`;
    setNumberIfPresent(sheet, `E${tyRow}`, submission.tyOriginalBudgetRevenues);
    setNumberIfPresent(sheet, `F${tyRow}`, submission.tyActualRevenue);
    setNumberIfPresent(sheet, `G${tyRow}`, submission.tyBaseYearRevenue);
  }

  const lifetimeRow = findRowIndexContains(sheet, 'C', 'Lifetime Revenue', {
    startRow: tyRow ? tyRow + 1 : 19
  });
  if (lifetimeRow) {
    setNumberIfPresent(sheet, `E${lifetimeRow}`, submission.lifetimeRevenues);
    setNumberIfPresent(sheet, `F${lifetimeRow}`, submission.lifetimeActualRevenues);
    setNumberIfPresent(sheet, `G${lifetimeRow}`, submission.lifetimeBaseYearRevenues);
  }
}

function fillTaxRatesTable(sheet, taxRates = [], yearColumns) {
  const grouped = groupTaxRatesByEntity(taxRates);
  const headerRowIndex = findRowIndex(sheet, 'A', 'TAX RATES');
  if (!headerRowIndex) return;
  let totalRowIndex = findRowIndex(sheet, 'A', 'Total Tax Rate');

  const entityNames = Object.keys(grouped);
  const capacity = totalRowIndex ? totalRowIndex - headerRowIndex - 1 : entityNames.length;

  if (totalRowIndex && entityNames.length > capacity) {
    const rowsToInsert = entityNames.length - capacity;
    sheet.spliceRows(totalRowIndex, rowsToInsert, ...Array(rowsToInsert).fill([]));
    totalRowIndex += rowsToInsert;
  }

  let currentRowIndex = headerRowIndex + 1;
  entityNames.forEach((entity) => {
    const row = sheet.getRow(currentRowIndex++);
    row.getCell(1).value = entity;

    yearColumns.forEach(({ col, year }) => {
      const match = grouped[entity].find((rate) => Number(rate.year) === Number(year));
      row.getCell(col).value = match ? parseNumber(match.rate, null) : null;
    });

    row.commit();
  });

  if (totalRowIndex) {
    while (currentRowIndex < totalRowIndex) {
      const row = sheet.getRow(currentRowIndex++);
      row.eachCell((cell) => (cell.value = null));
      row.commit();
    }
  }
}

function fillTaxEntitySections(sheet, submission) {
  const entities = collectTaxEntityDetails(submission);
  if (!entities.length) return;

  const participationStart = findRowIndex(sheet, 'A', 'PARTICIPATION PERCENTAGES');
  const projectPortionStart = findRowIndex(sheet, 'A', 'PROJECT PORTION');
  if (!participationStart || !projectPortionStart) return;

  const capacity = projectPortionStart - participationStart - 1;
  const usable = Math.min(capacity, entities.length);

  for (let i = 0; i < usable; i++) {
    const entry = entities[i];

    const participationRow = sheet.getRow(participationStart + 1 + i);
    participationRow.getCell(1).value = entry.name || '';
    if (entry.participationRate !== null) {
      const decimal = entry.participationRate > 1 ? entry.participationRate / 100 : entry.participationRate;
      participationRow.getCell(3).value = decimal;
    }
    participationRow.commit();

    const projectRow = sheet.getRow(projectPortionStart + 1 + i);
    projectRow.getCell(1).value = entry.name || '';
    if (entry.remittance !== null) {
      projectRow.getCell(23).value = `Remittance ${formatPercent(entry.remittance)}`;
    }
    const notes = [];
    if (entry.capAmount !== null) notes.push(`Cap ${formatCurrency(entry.capAmount)}`);
    if (entry.incrementPaid !== null) notes.push(`Paid ${formatCurrency(entry.incrementPaid)}`);
    if (entry.remainingAuthorized !== null) {
      notes.push(`Remaining ${formatCurrency(entry.remainingAuthorized)}`);
    }
    if (notes.length) {
      projectRow.getCell(24).value = notes.join(' | ');
    }
    projectRow.commit();
  }

  // Clear unused rows
  for (let i = usable; i < capacity; i++) {
    const participationRow = sheet.getRow(participationStart + 1 + i);
    participationRow.getCell(1).value = null;
    participationRow.getCell(3).value = null;
    participationRow.commit();

    const projectRow = sheet.getRow(projectPortionStart + 1 + i);
    projectRow.getCell(1).value = null;
    projectRow.getCell(24).value = null;
    projectRow.commit();
  }
}

function fillGoverningBoard(sheet, submission) {
  const startRow = findRowIndex(sheet, 'A', 'Governing Board');
  if (!startRow) return;
  let rowIndex = startRow + 1;

  const entries = collectIndexedEntries(submission, 'governingBoardName_', 'governingBoardTitle_');
  entries.forEach(({ name, title }) => {
    const row = sheet.getRow(rowIndex++);
    row.getCell(1).value = name;
    row.getCell(2).value = title;
    row.commit();
  });

  const staffHeaderRow = findRowIndex(sheet, 'C', 'Agency Staff');
  if (!staffHeaderRow) return;
  rowIndex = staffHeaderRow + 1;
  const staffEntries = collectIndexedEntries(submission, 'agencyStaffName_', 'agencyStaffTitle_');
  staffEntries.forEach(({ name, title }) => {
    const row = sheet.getRow(rowIndex++);
    row.getCell(3).value = name;
    row.getCell(4).value = title;
    row.commit();
  });
}

function fillAcreageSheet(sheet, submission) {
  const acreage = parseNumber(submission.acreage, 0);
  const developed = parseNumber(submission.developedAcreage, 0);
  const undeveloped = parseNumber(submission.undevelopedAcreage, 0);
  const residential = parseNumber(submission.residentialAcreage, 0);
  const housingUnits = parseNumber(submission.totalAuthorizedHousingUnits, 0);

  sheet.getCell('C4').value = developed;
  sheet.getCell('C5').value = undeveloped;
  sheet.getCell('C6').value = acreage;
  sheet.getCell('C7').value = acreage ? developed / acreage : 0;
  sheet.getCell('C8').value = acreage ? undeveloped / acreage : 0;
  sheet.getCell('C9').value = residential;
  sheet.getCell('C10').value = housingUnits;
}

function getYearColumns(sheet) {
  const row = sheet.getRow(8);
  const columns = [];
  row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const year = parseNumber(cell.value, null);
    if (typeof year === 'number') {
      columns.push({ col: colNumber, year });
    }
  });
  return columns;
}

function buildRealPropertySeries(submission, baseYear, projectionYears) {
  const growthRates = parseGrowthRates(submission.growthRates);
  const growthMap = new Map();
  growthRates.forEach(({ year, rate }) => {
    const y = Number(year);
    const r = Number(rate);
    if (!Number.isNaN(y) && !Number.isNaN(r)) {
      growthMap.set(y, r);
    }
  });

  const initial = parseNumber(
    submission.realPropertyValue ??
      submission.tyValue ??
      submission.currentTaxableValue ??
      submission.baseValue,
    0
  );

  const defaultRate = growthRates.length ? Number(growthRates[0].rate) || 0 : 0.03;
  let current = initial;
  const series = [];

  for (let i = 0; i < projectionYears; i++) {
    const year = baseYear + i;
    const rate = resolveGrowthRate(growthMap, year, defaultRate);
    current = current * (1 + rate);
    series.push(Math.round(current));
  }

  if (!series.length) {
    series.push(initial);
  }

  return series;
}

function resolveGrowthRate(map, year, fallback) {
  if (map.has(year)) return map.get(year);
  for (let offset = 1; offset <= 5; offset++) {
    if (map.has(year - offset)) return map.get(year - offset);
  }
  return fallback;
}

function groupTaxRatesByEntity(taxRates = []) {
  return taxRates.reduce((acc, rate) => {
    const name = rate.entity_name || rate.entityName;
    if (!name) return acc;
    if (!acc[name]) acc[name] = [];
    acc[name].push(rate);
    return acc;
  }, {});
}

function collectIndexedEntries(source, namePrefix, titlePrefix) {
  const entries = [];
  for (let i = 0; i < 50; i++) {
    const name = source?.[`${namePrefix}${i}`];
    const title = source?.[`${titlePrefix}${i}`];
    if (!name && !title) continue;
    entries.push({
      name: name || '',
      title: title || ''
    });
  }
  return entries;
}

function collectTaxEntityDetails(source) {
  const entries = [];
  for (let i = 0; i < 20; i++) {
    const name = source?.[`taxEntityName_${i}`];
    const participationRate = parseNumberOrNull(source?.[`taxEntityParticipationRate_${i}`]);
    const remittance = parseNumberOrNull(source?.[`taxEntityRemittance_${i}`]);
    const capAmount = parseNumberOrNull(source?.[`taxEntityCapAmount_${i}`]);
    const incrementPaid = parseNumberOrNull(source?.[`taxEntityIncrementPaid_${i}`]);
    const remainingAuthorized = parseNumberOrNull(source?.[`taxEntityRemainingAuthorized_${i}`]);

    if (
      name ||
      participationRate !== null ||
      remittance !== null ||
      capAmount !== null ||
      incrementPaid !== null ||
      remainingAuthorized !== null
    ) {
      entries.push({
        name: name || '',
        participationRate,
        remittance,
        capAmount,
        incrementPaid,
        remainingAuthorized
      });
    }
  }
  return entries;
}

function findRowIndex(sheet, columnLetter, targetValue) {
  const columnIndex = columnLetter.toUpperCase().charCodeAt(0) - 64;
  for (let i = 1; i <= sheet.rowCount; i++) {
    const value = sheet.getRow(i).getCell(columnIndex).value;
    if (
      typeof value === 'string' &&
      value.trim().toLowerCase() === targetValue.toLowerCase()
    ) {
      return i;
    }
  }
  return null;
}

function findRowIndexContains(sheet, columnLetter, substring, { startRow = 1 } = {}) {
  const columnIndex = columnLetter.toUpperCase().charCodeAt(0) - 64;
  const lowered = substring.toLowerCase();
  for (let i = startRow; i <= sheet.rowCount; i++) {
    const value = sheet.getRow(i).getCell(columnIndex).value;
    if (typeof value === 'string' && value.toLowerCase().includes(lowered)) {
      return i;
    }
  }
  return null;
}

function parseGrowthRates(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function parseNumberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function setNumberIfPresent(sheet, cellRef, value) {
  const number = parseNumber(value, null);
  if (number !== null) {
    sheet.getCell(cellRef).value = number;
  }
}

function determineDisplayYear(submission, fallbackYear) {
  return (
    parseNumber(submission.fy, null) ||
    parseNumber(submission.year, null) ||
    fallbackYear
  );
}

function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '$0';
  return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '0%';
  const numeric = Number(value);
  return `${numeric > 1 ? numeric : numeric * 100}%`;
}

