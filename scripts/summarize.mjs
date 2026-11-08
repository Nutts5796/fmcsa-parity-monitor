// Builds the public summary from LogiParity JSON reports.
// Publishes aggregates and cause summaries only: no carrier names, no per-carrier keys.
// Usage: node scripts/summarize.mjs IA VT
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const states = process.argv.slice(2);
if (!states.length) throw new Error('Usage: node scripts/summarize.mjs <STATE>...');
const logiparityVersion = JSON.parse(readFileSync('node_modules/logiparity/package.json', 'utf8')).version;

const readText = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : '');
const datasetVersion = (log, id) => {
  const match = [...log.matchAll(new RegExp(`${id} rowsUpdatedAt: (\\S+)`, 'g'))].pop();
  return match ? match[1] : null;
};
const serverCounts = (log) =>
  Object.fromEntries(
    [...log.matchAll(/server count (\S+) where (.+): (\d+)/g)].map((m) => [`${m[1]} where ${m[2]}`, Number(m[3])]),
  );

const run = { runAt: new Date().toISOString(), logiparityVersion, datasets: {}, states: {} };
for (const state of states) {
  const log = readText(`data/fetch-log-${state}.txt`);
  run.datasets.companyCensus ??= datasetVersion(log, 'az4n-8mr2');
  run.datasets.smsCensus ??= datasetVersion(log, 'kjg3-diqy');
  const exitText = readText(`report-${state}.exit`).trim();
  const result = { exitCode: exitText === '' ? null : Number(exitText), serverCounts: serverCounts(log), entities: {} };
  const file = `report-${state}/report.json`;
  if (!existsSync(file) || result.exitCode === 2) {
    const console = readText(`report-${state}.log`);
    result.error = (console.split('\n').find((line) => line.startsWith('LogiParity:')) ?? 'No report produced').slice(0, 300);
  }
  if (existsSync(file)) {
    const report = JSON.parse(readFileSync(file, 'utf8'));
    for (const entity of report.entities) {
      const findings = report.findings.filter((finding) => finding.entity === entity.entity);
      const byType = {};
      for (const finding of findings) byType[finding.type] = (byType[finding.type] ?? 0) + 1;
      const byField = {};
      for (const finding of findings.filter((item) => item.type === 'field_mismatch'))
        byField[finding.field] = (byField[finding.field] ?? 0) + 1;
      result.entities[entity.entity] = {
        reference: entity.reference,
        counts: entity.counts,
        findings: findings.length,
        byType,
        byField,
        aggregates: (entity.aggregates ?? []).map((aggregate) => ({
          name: aggregate.name,
          values: aggregate.values,
        })),
        causes: report.groups
          .filter((group) => group.entity === entity.entity)
          .sort((a, b) => b.count - a.count)
          .slice(0, 12)
          .map((group) => ({ field: group.field ?? null, kind: group.kind, count: group.count, summary: group.summary })),
      };
    }
    result.coverage = report.coverage ?? null;
  }
  run.states[state] = result;
}

mkdirSync('docs/data', { recursive: true });
const historyFile = 'docs/data/history.json';
const history = existsSync(historyFile) ? JSON.parse(readFileSync(historyFile, 'utf8')) : [];
history.push(run);
writeFileSync(historyFile, JSON.stringify(history, null, 1) + '\n');
writeFileSync('docs/data/latest.json', JSON.stringify(run, null, 1) + '\n');
console.log(`Summarized ${states.join(', ')} with LogiParity ${logiparityVersion}; history has ${history.length} runs.`);
