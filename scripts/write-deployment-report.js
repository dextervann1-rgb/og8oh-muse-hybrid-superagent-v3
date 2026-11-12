const fs = require("node:fs");
const path = require("node:path");

const required = [
  "address",
  "transactionHash",
  "block",
  "timestamp",
  "chainId",
  "registry",
  "accountImplementation",
  "entryPoint",
  "voiceVerifier",
  "voiceVerifierTransactionHash"
];
const report = JSON.parse(fs.readFileSync(process.argv[2] || 0, "utf8"));
for (const key of required) {
  if (report[key] === undefined || report[key] === null || report[key] === "") {
    throw new Error(`Missing deployment report field: ${key}`);
  }
}
if (Number(report.chainId) !== 8453) throw new Error("Deployment report is not for Base Mainnet (8453)");
const output = path.resolve(process.env.GITHUB_WORKSPACE || process.cwd(), "deployment-report.json");
fs.writeFileSync(output, JSON.stringify({
  ...report,
  verification: report.verification || "pending",
  ipfsPin: report.ipfsPin || "pending",
  storageLog: report.storageLog || "pending",
  alert: report.alert || "none"
}, null, 2) + "\n");
console.log(`Wrote ${output}`);
