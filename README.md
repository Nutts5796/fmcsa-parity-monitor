# FMCSA Data Parity Monitor

A weekly, reproducible parity check of public FMCSA carrier registration data on data.transportation.gov, run with the open-source [LogiParity](https://github.com/Nutts5796/logiparity) CLI. Results: https://nutts5796.github.io/fmcsa-parity-monitor/

## What is checked

For carriers based in Iowa and Vermont:

1. **Company Census File (`az4n-8mr2`), JSON API vs CSV export.** The same dataset and filter, read through the paginated API and as a CSV file. These should always agree; a difference would point to a pagination or export problem.
2. **SMS motor carrier census (`kjg3-diqy`, monthly) vs active Company Census records (daily)**, joined by USDOT number. Differences are expected from the different refresh schedules and, for some fields such as the hazmat flag, different definitions. They are not claims that either dataset is wrong.

The first full analysis, with method and caveats: [Two FMCSA files, one carrier, different answers](https://dev.to/nutts5796/two-fmcsa-files-one-carrier-different-answers-what-a-parity-check-found-in-public-us-trucking-3kp0).

## What is published

`docs/data/history.json` and `docs/data/latest.json` hold, per run and state: dataset versions, record counts, server-side counts, totals, the number of differences by type and field, and LogiParity's cause summaries. Carrier names are not compared, and no per-carrier records are published.

## Run it yourself

```sh
npm ci --ignore-scripts
./scripts/fetch.sh VT
STATE=VT npx logiparity check --config parity.yaml
node scripts/summarize.mjs VT
```

No account or API key is needed. The workflow in `.github/workflows/monitor.yml` runs every Monday at 07:00 UTC and commits the new summary.

Data: Federal Motor Carrier Safety Administration. This project is independent and not affiliated with FMCSA or the U.S. Department of Transportation. MIT license.
