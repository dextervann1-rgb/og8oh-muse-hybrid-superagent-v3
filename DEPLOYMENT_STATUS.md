# Deployment status: blocked pending contract hardening

This repository is intentionally public-safe and reviewable, but the current Solidity source remains a draft. Do not fund a deployer or authorize Base Mainnet deployment until the blockers in `docs/OG8OH-V3-AUDIT.md` are resolved.

The workflow is manual-only. It requires a protected `base-mainnet` environment, a green compile/test job, the exact input `DEPLOY`, and the deployer script's `DEPLOY_CONFIRM=YES` guard. It does not commit secrets, automatically deploy on pushes, or claim that IPFS/S-C Storage logging is implemented until those integrations are connected.
