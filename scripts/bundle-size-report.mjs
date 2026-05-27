import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = process.cwd();
const staticDir = path.join(root, ".next", "static");
const reportDir = path.join(root, "reports", "performance");
const reportPath = path.join(reportDir, "bundle-size.json");

const walk = (dir) => {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
};

const gzipSize = (buffer) => zlib.gzipSync(buffer, { level: 9 }).length;
const jsFiles = walk(staticDir).filter((file) => file.endsWith(".js"));
const cssFiles = walk(staticDir).filter((file) => file.endsWith(".css"));

const summarize = (files) =>
  files
    .map((file) => {
      const buffer = fs.readFileSync(file);
      return {
        file: path.relative(root, file).replace(/\\/g, "/"),
        bytes: buffer.length,
        gzipBytes: gzipSize(buffer)
      };
    })
    .sort((a, b) => b.bytes - a.bytes);

const js = summarize(jsFiles);
const css = summarize(cssFiles);
const totals = {
  jsBytes: js.reduce((sum, item) => sum + item.bytes, 0),
  jsGzipBytes: js.reduce((sum, item) => sum + item.gzipBytes, 0),
  cssBytes: css.reduce((sum, item) => sum + item.bytes, 0),
  cssGzipBytes: css.reduce((sum, item) => sum + item.gzipBytes, 0)
};

const report = {
  generatedAt: new Date().toISOString(),
  totals,
  largestJs: js.slice(0, 20),
  largestCss: css.slice(0, 10)
};

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.table({
  "JS raw KB": (totals.jsBytes / 1024).toFixed(1),
  "JS gzip KB": (totals.jsGzipBytes / 1024).toFixed(1),
  "CSS raw KB": (totals.cssBytes / 1024).toFixed(1),
  "CSS gzip KB": (totals.cssGzipBytes / 1024).toFixed(1)
});
console.log(`Bundle size report written to ${reportPath}`);
