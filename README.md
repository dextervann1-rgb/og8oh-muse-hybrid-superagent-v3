# OG8OH — MuSe Hybrid SuperAgent V3

This public repository contains the reviewable OG8OH site dossier and a guarded design for deploying the MuSe Hybrid SuperAgent V3 contract to Base Mainnet (chain ID 8453).

The repository is intentionally **not production-deployable yet**. The Solidity file is labeled as a draft, and the release is blocked until the ERC-4337 ABI, ERC-6551 implementation, OpenZeppelin versioning, and cryptographic voice-proof model are resolved. See [`DEPLOYMENT_STATUS.md`](DEPLOYMENT_STATUS.md) and [`docs/OG8OH-V3-AUDIT.md`](docs/OG8OH-V3-AUDIT.md).

## Workflow design

Deployment is manual-only through GitHub Actions. A maintainer must enter `DEPLOY`, the compile and full Hardhat suite must pass, and the protected `base-mainnet` environment must approve the deploy job. The deployer checks `DEPLOY_CONFIRM=YES`, validates Base chain ID 8453, requires runtime secrets, waits for the deployment receipt, and emits the address, transaction hash, block number, timestamp, chain ID, and configured URIs.

The post-deploy stage is designed to verify on BaseScan, write a durable JSON deployment report, append the record to the S-C Storage Agent log, pin the report to IPFS, update the Base Grants R2 proof page, and alert after two failed retries. Those external integrations are deliberately left as explicit implementation gates rather than represented as completed by placeholder shell commands.

## Repository contents

The `site/` folder contains the reviewed interactive HTML build. `contracts/` and `test/` contain the extracted draft contract and original six-test suite. `scripts/` contains the guarded deployer and JSON report validator. `.github/workflows/deploy-base.yml` contains the manual-only deployment workflow. `docs/` contains the audit and workflow design.

Never commit private keys, seed phrases, RPC credentials, BaseScan API keys, signed transactions, or storage tokens. Use GitHub Secrets and the protected environment only.
