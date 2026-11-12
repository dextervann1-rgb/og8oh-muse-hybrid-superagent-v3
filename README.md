# OG8OH — MuSe Hybrid SuperAgent V3

This public repository contains the reviewable OG8OH site dossier and a guarded design for deploying the MuSe Hybrid SuperAgent V3 contract to Base Mainnet (chain ID 8453).

The repository is intentionally **not production-approved yet**. The critical code blockers from the initial audit have been remediated and validated locally, but the release remains blocked until the exact Base registry, account implementation, EntryPoint, and verifier addresses are independently verified and the final contract receives an independent Solidity review. See [`DEPLOYMENT_STATUS.md`](DEPLOYMENT_STATUS.md) and [`docs/OG8OH-V3-AUDIT.md`](docs/OG8OH-V3-AUDIT.md).

## Workflow design

Deployment is manual-only through GitHub Actions. A maintainer must enter `DEPLOY`, the compile and full Hardhat suite must pass, and the protected `base-mainnet` environment must approve the deploy job. The deployer checks `DEPLOY_CONFIRM=YES`, validates Base chain ID 8453, requires runtime secrets for the registry, account implementation, EntryPoint, and trusted voice verifier, configures that verifier, waits for both receipts, and emits the address, transaction hashes, block number, timestamp, chain ID, and configured integration addresses.

The separate `Dry Run Base Sepolia Deployment` workflow is also manual-only. It runs the same compile/test gate, reads Base Sepolia chain ID 84532 and the latest block through `https://sepolia.base.org`, reports missing configuration, and asserts `transactionsSent: 0`. It does not load a signer or broadcast a transaction.

The post-deploy stage is designed to verify on BaseScan, write a durable JSON deployment report, append the record to the S-C Storage Agent log, pin the report to IPFS, update the Base Grants R2 proof page, and alert after two failed retries. Those external integrations are deliberately left as explicit implementation gates rather than represented as completed by placeholder shell commands.

## Repository contents

The `site/` folder contains the reviewed interactive HTML build. `contracts/` and `test/` contain the hardened draft contract, local integration doubles, and seven security-focused tests. `scripts/` contains the guarded deployer and JSON report validator. `.github/workflows/deploy-base.yml` contains the manual-only deployment workflow. `docs/` contains the audit and workflow design.

Never commit private keys, seed phrases, RPC credentials, BaseScan API keys, signed transactions, or storage tokens. Use GitHub Secrets and the protected environment only.
