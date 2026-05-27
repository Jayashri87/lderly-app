import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

const baseUrl = process.env.LOAD_TEST_BASE_URL || "http://127.0.0.1:3100";
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY || 100);
const durationSeconds = Number(process.env.LOAD_TEST_DURATION_SECONDS || 300);
const paths = (process.env.LOAD_TEST_PATHS || "/,/login,/partner,/ops,/api/system/status")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const reportDir = path.join(process.cwd(), "reports", "performance");
const reportPath = path.join(reportDir, "load-test.json");

const results = [];
let totalRequests = 0;
let failedRequests = 0;
let stop = false;

const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
};

const worker = async (id) => {
  let cursor = id % paths.length;

  while (!stop) {
    const requestPath = paths[cursor % paths.length];
    cursor += 1;
    const url = new URL(requestPath, baseUrl).toString();
    const startedAt = performance.now();

    try {
      const response = await fetch(url, {
        headers: {
          "cache-control": "no-cache",
          "x-lderly-load-test": "local"
        }
      });
      const elapsedMs = performance.now() - startedAt;
      await response.arrayBuffer();
      totalRequests += 1;
      if (!response.ok) {
        failedRequests += 1;
      }
      results.push({ status: response.status, elapsedMs, path: requestPath });
    } catch {
      failedRequests += 1;
      totalRequests += 1;
      results.push({ status: 0, elapsedMs: performance.now() - startedAt, path: requestPath });
    }
  }
};

const startedAt = Date.now();
console.log(
  `Starting load test: ${concurrency} concurrent users, ${durationSeconds}s, base=${baseUrl}`
);
const workers = Array.from({ length: concurrency }, (_, index) => worker(index));
await new Promise((resolve) => setTimeout(resolve, durationSeconds * 1000));
stop = true;
await Promise.all(workers);

const elapsedSeconds = (Date.now() - startedAt) / 1000;
const latencies = results.map((item) => item.elapsedMs);
const maxLatency = latencies.reduce((max, value) => Math.max(max, value), 0);
const byStatus = results.reduce((acc, item) => {
  acc[item.status] = (acc[item.status] || 0) + 1;
  return acc;
}, {});
const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  concurrency,
  durationSeconds,
  elapsedSeconds,
  paths,
  totalRequests,
  failedRequests,
  requestsPerSecond: totalRequests / elapsedSeconds,
  errorRate: totalRequests ? failedRequests / totalRequests : 0,
  latencyMs: {
    avg: latencies.reduce((sum, value) => sum + value, 0) / Math.max(1, latencies.length),
    p50: percentile(latencies, 50),
    p90: percentile(latencies, 90),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    max: maxLatency
  },
  byStatus
};

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.table({
  requests: totalRequests,
  failed: failedRequests,
  rps: report.requestsPerSecond.toFixed(2),
  errorRate: `${(report.errorRate * 100).toFixed(2)}%`,
  p50: `${report.latencyMs.p50.toFixed(0)}ms`,
  p95: `${report.latencyMs.p95.toFixed(0)}ms`,
  p99: `${report.latencyMs.p99.toFixed(0)}ms`
});
console.log(`Load test report written to ${reportPath}`);
