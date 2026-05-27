import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const reportDir = path.join(process.cwd(), "reports", "performance");
const url = process.env.LIGHTHOUSE_URL || "http://127.0.0.1:3100";
fs.mkdirSync(reportDir, { recursive: true });

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(
  npxCommand,
  [
    "-y",
    "lighthouse@latest",
    url,
    "--output=json",
    "--output=html",
    "--output-path=./reports/performance/lighthouse",
    "--chrome-flags=--headless=new --no-sandbox",
    "--quiet"
  ],
  {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: process.platform === "win32"
  }
);

if (result.status !== 0) {
  if (result.error) {
    console.error(result.error);
  }
  process.exit(result.status || 1);
}

const jsonPath = path.join(reportDir, "lighthouse.report.json");
if (fs.existsSync(jsonPath)) {
  const report = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const categories = report.categories || {};
  const audits = report.audits || {};
  console.table({
    performance: Math.round((categories.performance?.score || 0) * 100),
    accessibility: Math.round((categories.accessibility?.score || 0) * 100),
    bestPractices: Math.round((categories["best-practices"]?.score || 0) * 100),
    seo: Math.round((categories.seo?.score || 0) * 100),
    fcp: audits["first-contentful-paint"]?.displayValue || "n/a",
    lcp: audits["largest-contentful-paint"]?.displayValue || "n/a",
    cls: audits["cumulative-layout-shift"]?.displayValue || "n/a",
    tbt: audits["total-blocking-time"]?.displayValue || "n/a"
  });
}
