import { readFile } from "node:fs/promises";

const [owner, repo] = (process.env.GITHUB_REPOSITORY || "Jayashri87/lderly-app").split("/");
const branch = process.env.GITHUB_BRANCH || "main";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

if (!token) {
  console.error("GITHUB_TOKEN or GH_TOKEN is required to apply branch protection.");
  process.exit(1);
}

const config = JSON.parse(
  await readFile(new URL("../.github/branch-protection-main.json", import.meta.url), "utf8")
);
const response = await fetch(
  `https://api.github.com/repos/${owner}/${repo}/branches/${branch}/protection`,
  {
    method: "PUT",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28"
    },
    body: JSON.stringify(config)
  }
);
const text = await response.text();

if (!response.ok) {
  console.error(`Failed to apply branch protection: ${response.status} ${text}`);
  process.exit(1);
}

console.log(`Branch protection applied to ${owner}/${repo}:${branch}`);
