const fs = require("node:fs");
const path = require("node:path");
const hre = require("hardhat");

const BASE_MAINNET_CHAIN_ID = 8453n;
const BASE_SEPOLIA_CHAIN_ID = 84532n;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function writeReport(record) {
  const outputPath = process.env.DEPLOYMENT_OUTPUT_PATH;
  if (outputPath) {
    const resolved = path.resolve(outputPath);
    fs.writeFileSync(resolved, JSON.stringify(record, null, 2) + "\n");
    console.log(`Deployment record: ${resolved}`);
  }
  console.log(JSON.stringify(record, null, 2));
}

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const expectedChainId = BigInt(process.env.EXPECTED_CHAIN_ID || BASE_MAINNET_CHAIN_ID);
  if (network.chainId !== expectedChainId) {
    throw new Error(`Refusing operation: expected chain ${expectedChainId}, got ${network.chainId}`);
  }

  if (process.env.DRY_RUN === "YES") {
    const blockNumber = await hre.ethers.provider.getBlockNumber();
    const requiredConfiguration = [
      "PRIVATE_KEY",
      "UI_URI",
      "MCP_ENDPOINT",
      "REGISTRY_ADDRESS",
      "ACCOUNT_IMPLEMENTATION",
      "ENTRY_POINT_ADDRESS",
      "VOICE_VERIFIER_ADDRESS"
    ];
    const missingConfiguration = requiredConfiguration.filter((name) => !process.env[name]);
    const record = {
      dryRun: true,
      transactionsSent: 0,
      chainId: Number(network.chainId),
      expectedChainId: Number(expectedChainId),
      blockNumber,
      rpcReachable: true,
      configurationComplete: missingConfiguration.length === 0,
      missingConfiguration,
      timestamp: new Date().toISOString()
    };
    writeReport(record);
    return;
  }

  if (expectedChainId !== BASE_MAINNET_CHAIN_ID) {
    throw new Error("Live deployment is restricted to Base Mainnet (8453)");
  }
  if (process.env.DEPLOY_CONFIRM !== "YES") {
    throw new Error("Refusing deployment: set DEPLOY_CONFIRM=YES only after review and a green test run.");
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
  writeReport({
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
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
