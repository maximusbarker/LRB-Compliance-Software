import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const configPath = path.resolve(__dirname, '../src/config.js');
  const configModule = await import(pathToFileURL(configPath).href);
  const config = configModule.default;

  const db = new Database(config.database.filename);

  try {
    const submissionId = process.argv[2];
    let submission;

    if (submissionId) {
      submission = db
        .prepare('SELECT * FROM submissions WHERE id = ?')
        .get(submissionId);
    } else {
      submission = db
        .prepare('SELECT * FROM submissions ORDER BY created_at DESC LIMIT 1')
        .get();
    }

    if (!submission) {
      console.error('No submission found. Provide a submission ID or create test data.');
      process.exit(1);
    }

    const submissionData = JSON.parse(submission.payload_json);
    const county = submissionData.county;
    const agency =
      submissionData.submitterName ||
      submissionData.cityCounty ||
      submissionData.city;
    const project = submissionData.projectAreaName || submissionData.projectArea;
    const reportYear =
      submission.year ||
      parseInt(submissionData.year, 10) ||
      new Date().getFullYear();

    let taxRates = [];
    if (county && agency && project) {
      taxRates = db
        .prepare(
          `SELECT * FROM tax_rates
           WHERE org_id = ? AND county = ? AND agency = ? AND project = ? AND year = ?
           ORDER BY entity_name`
        )
        .all(submission.org_id, county, agency, project, reportYear);

      if (taxRates.length === 0) {
        taxRates = db
          .prepare(
            `SELECT * FROM tax_rates
             WHERE org_id = ? AND county = ? AND agency = ? AND project = ?
             ORDER BY year DESC, entity_name`
          )
          .all(submission.org_id, county, agency, project);
      }

      if (taxRates.length === 0) {
        taxRates = db
          .prepare(
            `SELECT * FROM tax_rates
             WHERE org_id = ? AND county = ? AND agency = ? AND year = ?
             ORDER BY entity_name`
          )
          .all(submission.org_id, county, agency, reportYear);
      }
    }

    if (taxRates.length === 0) {
      taxRates = db
        .prepare(
          `SELECT * FROM tax_rates
           WHERE org_id = ? AND (submission_id = ? OR submission_id IS NULL)
           ORDER BY year DESC, entity_name
           LIMIT 100`
        )
        .all(submission.org_id, submission.id);
    }

    const { generateTIFReport } = await import('../src/reports/tifGenerator.js');
    const buffer = await generateTIFReport({
      submission: submissionData,
      taxRates,
      year: reportYear,
      projectionYears: 20
    });

    const outDir = path.resolve(__dirname, '../../tmp');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const projectName =
      submissionData.projectAreaName ||
      submissionData.projectArea ||
      'Project';
    const outFile = path.join(
      outDir,
      `generated_tif_${projectName.replace(/\s+/g, '_')}_${reportYear}.xlsx`
    );

    fs.writeFileSync(outFile, buffer);
    console.log('Generated TIF report:', outFile);
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error('Failed to generate TIF report:', err);
  process.exit(1);
});

