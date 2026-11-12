const fs = require("node:fs");
const path = require("node:path");
const hre = require("hardhat");

const BASE_MAINNET_CHAIN_ID = 8453n;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  if (process.env.DEPLOY_CONFIRM !== "YES") {
    throw new Error("Refusing deployment: set DEPLOY_CONFIRM=YES only after review and a green test run.");
  }

  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== BASE_MAINNET_CHAIN_ID) {
    throw new Error(`Refusing deployment: expected Base Mainnet (8453), got ${network.chainId}`);
  }

  requireEnv("PRIVATE_KEY");
  const uiURI = requireEnv("UI_URI");
  const mcpEndpoint = requireEnv("MCP_ENDPOINT");
  const registry = requireEnv("REGISTRY_ADDRESS");
  const accountImplementation = requireEnv("ACCOUNT_IMPLEMENTATION");
  const entryPoint = requireEnv("ENTRY_POINT_ADDRESS");
  const voiceVerifier = requireEnv("VOICE_VERIFIER_ADDRESS");

  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} ETH`);

  const Agent = await hre.ethers.getContractFactory("MuSeHybridSuperAgentV3");
  const agent = await Agent.deploy(uiURI, mcpEndpoint, registry, accountImplementation, entryPoint);
  const deploymentTx = agent.deploymentTransaction();
  await agent.waitForDeployment();
  const verifierTx = await agent.setVoiceVerifier(voiceVerifier);
  await verifierTx.wait();

  const address = await agent.getAddress();
  const receipt = deploymentTx ? await deploymentTx.wait() : null;
  const record = {
    contract: "MuSeHybridSuperAgentV3",
    address,
    transactionHash: deploymentTx?.hash ?? null,
    block: receipt?.blockNumber ?? null,
    chainId: Number(network.chainId),
    deployer: deployer.address,
    uiURI,
    mcpEndpoint,
    registry,
    accountImplementation,
    entryPoint,
    voiceVerifier,
    voiceVerifierTransactionHash: verifierTx.hash,
    timestamp: new Date().toISOString()
  };

  const outputPath = process.env.DEPLOYMENT_OUTPUT_PATH;
  if (outputPath) {
    const resolved = path.resolve(outputPath);
    fs.writeFileSync(resolved, JSON.stringify(record, null, 2) + "\n");
    console.log(`Deployment record: ${resolved}`);
  }
  console.log(JSON.stringify(record, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
