# Automated Base deployment workflow

The intended flow is a protected GitHub Actions workflow for Base Mainnet, chain ID 8453.

A maintainer starts the workflow manually and enters `DEPLOY`. The test job installs pinned dependencies, compiles the selected contract, and runs the complete Hardhat suite. The deploy job cannot start unless that job is green and the protected `base-mainnet` environment approves it.

The deploy script checks `DEPLOY_CONFIRM=YES`, verifies the provider chain ID is 8453, requires `PRIVATE_KEY`, `UI_URI`, and `MCP_ENDPOINT`, submits the deployment, waits for its receipt, and emits a JSON record containing the contract address, transaction hash, block number, chain ID, URIs, and UTC timestamp.

The next implementation stage must replace the verification placeholder with a signed deployment artifact handoff, then run BaseScan verification. A post-deploy reporting job should append the final record to the S-C Storage Agent log, pin the report to IPFS, publish the Base Grants R2 proof page, and attach the JSON and verification response as workflow artifacts. Retries should be bounded to two attempts; after the second failure the job must stop, preserve all logs, and alert the owner rather than retry indefinitely.

No private key, RPC credential, BaseScan API key, or storage token belongs in the repository. Use GitHub Actions Secrets and a protected environment. Keep `DEPLOYMENT_STATUS.md` accurate so a public reader can distinguish a draft from a deployed and verified release.
