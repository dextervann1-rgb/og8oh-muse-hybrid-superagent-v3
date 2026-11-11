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

  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} ETH`);

  const Agent = await hre.ethers.getContractFactory("MuSeHybridSuperAgentV3");
  const agent = await Agent.deploy(uiURI, mcpEndpoint);
  const deploymentTx = agent.deploymentTransaction();
  await agent.waitForDeployment();

  const address = await agent.getAddress();
  const receipt = deploymentTx ? await deploymentTx.wait() : null;
  const block = receipt?.blockNumber ?? null;

  console.log(JSON.stringify({
    contract: "MuSeHybridSuperAgentV3",
    address,
    transactionHash: deploymentTx?.hash ?? null,
    block,
    chainId: Number(network.chainId),
    uiURI,
    mcpEndpoint,
    timestamp: new Date().toISOString()
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
