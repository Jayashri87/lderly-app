import fs from "node:fs";
import path from "node:path";

const appDir = path.join(process.cwd(), "app");
const componentDir = path.join(process.cwd(), "components");

const maxPageBytes = 180_000;
const maxClientMapWrapperBytes = 2_500;
const failures = [];

const fileSize = (filePath) => fs.statSync(filePath).size;

const checkFileSize = (filePath, maxBytes, label) => {
  if (!fs.existsSync(filePath)) {
    failures.push(`${label}: missing ${filePath}`);
    return;
  }

  const bytes = fileSize(filePath);
  if (bytes > maxBytes) {
    failures.push(`${label}: ${bytes} bytes exceeds ${maxBytes} bytes`);
  }
};

checkFileSize(path.join(appDir, "page.tsx"), maxPageBytes, "Customer route file");
checkFileSize(
  path.join(componentDir, "LiveMap.tsx"),
  maxClientMapWrapperBytes,
  "Lazy map wrapper"
);

const liveMapWrapper = fs.readFileSync(path.join(componentDir, "LiveMap.tsx"), "utf8");
if (!liveMapWrapper.includes("dynamic(() => import(\"./LiveMapClient\")")) {
  failures.push("LiveMap must dynamically import LiveMapClient");
}

const liveMapClient = fs.readFileSync(path.join(componentDir, "LiveMapClient.tsx"), "utf8");
if (!liveMapClient.includes("refreshMs = activeTracking ? 30_000 : 60_000")) {
  failures.push("Route ETA polling budget must remain 30s active / 60s otherwise");
}
if (!liveMapClient.includes("/api/locations/route-stream")) {
  failures.push("Route ETA must use SSE stream before polling fallback");
}
if (liveMapClient.includes("decodePolyline") || liveMapClient.includes("polylineCache")) {
  failures.push("Polyline decoding must stay server-side, not in LiveMapClient");
}
const locationProvider = fs.readFileSync(path.join(process.cwd(), "server", "locationProvider.ts"), "utf8");
if (!locationProvider.includes("decodePolyline") || !locationProvider.includes("decodedPath")) {
  failures.push("Server route provider must decode polylines and return decodedPath");
}
if (!locationProvider.includes("UPSTASH_REDIS_REST_URL")) {
  failures.push("Route cache must remain Redis REST compatible");
}
if (!liveMapClient.includes("distanceMeters < 10")) {
  failures.push("Tiny GPS movement animation guard is missing");
}

if (failures.length) {
  console.error("Performance budget check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Performance budget check passed.");
