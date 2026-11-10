#!/usr/bin/env bash
# Downloads the CSV side of the comparison and records dataset versions.
# Usage: ./fetch.sh IA   (two-letter physical state; default IA)
set -euo pipefail
STATE="${1:-IA}"
cd "$(dirname "$0")/.."
mkdir -p data
UA="Mozilla/5.0 (compatible; fmcsa-parity-monitor)"
HOST="https://data.transportation.gov"
LOG="data/fetch-log-${STATE}.txt"
FIELDS="dot_number,status_code,carrier_operation,phy_state,phy_zip,power_units,truck_units,bus_units,total_drivers,total_cdl,mcs150_date,add_date,mcs150_mileage,mcs150_mileage_year,hm_ind,safety_rating,fleetsize,classdef"
version() { curl -fsS --retry 6 --retry-all-errors --retry-delay 20 --max-time 600 -A "$UA" "$HOST/api/views/$1.json" | python3 -I -c 'import json,sys,datetime;d=json.load(sys.stdin);print(datetime.datetime.fromtimestamp(d["rowsUpdatedAt"],datetime.timezone.utc).isoformat())'; }
{
  echo "fetch started (UTC): $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "az4n-8mr2 rowsUpdatedAt: $(version az4n-8mr2)"
  echo "kjg3-diqy rowsUpdatedAt: $(version kjg3-diqy)"
} | tee -a "$LOG"
URL="$HOST/resource/az4n-8mr2.csv?\$select=$FIELDS&\$where=phy_state='$STATE'&\$order=dot_number&\$limit=100000"
echo "GET $URL" | tee -a "$LOG"
curl -fsS --retry 6 --retry-all-errors --retry-delay 20 --max-time 600 -A "$UA" --globoff "$URL" -o "data/census_${STATE}.csv"
echo "saved data/census_${STATE}.csv at $(date -u +%Y-%m-%dT%H:%M:%SZ); data lines: $(( $(python3 -I -c 'import csv,sys;print(sum(1 for _ in csv.reader(open(sys.argv[1],newline=""))))' "data/census_${STATE}.csv") - 1 ))" | tee -a "$LOG"
echo "shasum: $(shasum -a 256 "data/census_${STATE}.csv")" | tee -a "$LOG"
for q in "az4n-8mr2|phy_state='$STATE'" "az4n-8mr2|phy_state='$STATE' AND status_code='A'" "kjg3-diqy|phy_state='$STATE'"; do
  id="${q%%|*}"; where="${q#*|}"
  n=$(curl -fsS --retry 6 --retry-all-errors --retry-delay 20 --max-time 600 -A "$UA" -G "$HOST/resource/$id.json" --data-urlencode "\$select=count(*)" --data-urlencode "\$where=$where" | python3 -I -c 'import json,sys;print(json.load(sys.stdin)[0]["count"])')
  echo "server count $id where $where: $n" | tee -a "$LOG"
done
