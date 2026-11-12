const { expect } = require("chai");
const { ethers } = require("hardhat");

const UI_URI = "https://og8oh.example/ui";
const MCP_ENDPOINT = "https://og8oh.example/mcp";

function operation(sender) {
  return {
    sender,
    nonce: 0,
    initCode: "0x",
    callData: "0x",
    callGasLimit: 100000,
    verificationGasLimit: 100000,
    preVerificationGas: 21000,
    maxFeePerGas: 1,
    maxPriorityFeePerGas: 1,
    paymasterAndData: "0x",
    signature: "0x"
  };
}

describe("MuSeHybridSuperAgentV3", function () {
  let agent;
  let owner;
  let user;
  let verifier;
  let accountImplementation;
  let registry;
  let entryPoint;

  beforeEach(async () => {
    [owner, user, verifier] = await ethers.getSigners();
    accountImplementation = await ethers.deployContract("MockAccountImplementation");
    registry = await ethers.deployContract("MockERC6551Registry");
    entryPoint = await ethers.deployContract("MockEntryPoint");
    agent = await ethers.deployContract("MuSeHybridSuperAgentV3", [
      UI_URI,
      MCP_ENDPOINT,
      registry.target,
      accountImplementation.target,
      entryPoint.target
    ]);
    await agent.setVoiceVerifier(verifier.address);
  });

  it("starts at token 1, stores config, and pins integration addresses", async () => {
    expect(await agent.nextId()).to.equal(1);
    expect(await agent.uiURI()).to.equal(UI_URI);
    expect(await agent.mcpEndpoint()).to.equal(MCP_ENDPOINT);
    expect(await agent.registry()).to.equal(registry.target);
    expect(await agent.accountImplementation()).to.equal(accountImplementation.target);
    expect(await agent.entryPoint()).to.equal(entryPoint.target);
  });

  it("fuses an agent and creates an account through the configured registry", async () => {
    const voice = ethers.keccak256(ethers.toUtf8Bytes("voice-1"));
    await agent.fuseHybridAgent("MuSe One", voice, ethers.ZeroHash, 1);
    const record = await agent.getAgent(1);
    expect(record.account).to.equal(accountImplementation.target);
    expect(await agent.ownerOf(1)).to.equal(owner.address);
    expect(await agent.nextId()).to.equal(2);
  });

  it("rejects duplicate voice hashes and empty identity inputs", async () => {
    const voice = ethers.keccak256(ethers.toUtf8Bytes("voice-1"));
    await expect(agent.fuseHybridAgent("", voice, ethers.ZeroHash, 1)).to.be.revertedWith("name required");
    await agent.fuseHybridAgent("Aegis", voice, ethers.ZeroHash, 1);
    await expect(agent.fuseHybridAgent("Again", voice, ethers.ZeroHash, 2)).to.be.revertedWith("voice already fused");
  });

  it("requires a verifier signature and prevents proof replay", async () => {
    const voice = ethers.keccak256(ethers.toUtf8Bytes("voice-2"));
    const proof = ethers.toUtf8Bytes("voice-proof-v1");
    await agent.fuseHybridAgent("Sovereign", voice, ethers.ZeroHash, 3);

    const network = await ethers.provider.getNetwork();
    const proofHash = ethers.keccak256(proof);
    const digest = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "uint256", "bytes32", "bytes32"],
      [agent.target, network.chainId, 1, voice, proofHash]
    ));
    const signature = await verifier.signMessage(ethers.getBytes(digest));

    await expect(agent.connect(user).verifySuperiorVoice(1, voice, proof, signature))
      .to.emit(agent, "VoiceVerified");
    expect((await agent.getAgent(1)).superiorVoice).to.equal(true);
    await expect(agent.connect(user).verifySuperiorVoice(1, voice, proof, signature))
      .to.be.revertedWith("proof already used");
  });

  it("rejects signatures from the wrong verifier", async () => {
    const voice = ethers.keccak256(ethers.toUtf8Bytes("voice-3"));
    const proof = ethers.toUtf8Bytes("voice-proof-v2");
    await agent.fuseHybridAgent("Aegis", voice, ethers.ZeroHash, 4);
    const network = await ethers.provider.getNetwork();
    const digest = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "uint256", "bytes32", "bytes32"],
      [agent.target, network.chainId, 1, voice, ethers.keccak256(proof)]
    ));
    const badSignature = await user.signMessage(ethers.getBytes(digest));
    await expect(agent.verifySuperiorVoice(1, voice, proof, badSignature))
      .to.be.revertedWith("invalid verifier signature");
  });

  it("scopes ERC-4337 execution to the agent account and owner", async () => {
    const voice = ethers.keccak256(ethers.toUtf8Bytes("voice-4"));
    await agent.fuseHybridAgent("Executor", voice, ethers.ZeroHash, 5);
    await expect(agent.connect(user).executeVia4337(1, [operation(accountImplementation.target)], owner.address))
      .to.be.reverted;
    await expect(agent.executeVia4337(1, [operation(user.address)], owner.address))
      .to.be.revertedWith("operation sender mismatch");
    await agent.executeVia4337(1, [operation(accountImplementation.target)], owner.address);
    expect(await entryPoint.handledOperations()).to.equal(1);
  });

  it("pauses fusion and voice verification", async () => {
    await agent.pause();
    const voice = ethers.keccak256(ethers.toUtf8Bytes("voice-5"));
    await expect(agent.fuseHybridAgent("Paused", voice, ethers.ZeroHash, 6)).to.be.reverted;
    await expect(agent.verifySuperiorVoice(1, voice, "0x01", "0x01")).to.be.reverted;
  });
});
