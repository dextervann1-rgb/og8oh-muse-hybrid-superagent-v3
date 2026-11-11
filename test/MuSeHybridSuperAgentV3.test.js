const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MuSeHybridSuperAgentV3", function () {
  let agent, owner, user;
  const uiURI = "https://og8oh.omegaportal.example/ui";
  const mcp = "https://og8oh.omegaportal.example/mcp";

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
    agent = await ethers.deployContract("MuSeHybridSuperAgentV3", [uiURI, mcp]);
  });

  it("starts nextId at 1 and stores name / uiURI / mcpEndpoint", async () => {
    expect(await agent.nextId()).to.equal(1);
    expect(await agent.uiURI()).to.equal(uiURI);
    expect(await agent.mcpEndpoint()).to.equal(mcp);
  });

  it("fuses + compresses: 1000 -> compact proof", async () => {
    const proof = ethers.solidityPackedKeccak256(["uint256"], [1000]);
    await agent.fuseHybridAgent("MuSe One", ethers.keccak256(ethers.toUtf8Bytes("voice-1")), proof, 1);
    const record = await agent.getAgent(1);
    expect(record.compressedProof).to.equal(proof);
    expect(await agent.nextId()).to.equal(2);
  });

  it("mints an ERC-721 agent", async () => {
    await agent.fuseHybridAgent("Aegis", ethers.keccak256(ethers.toUtf8Bytes("voice-2")), ethers.ZeroHash, 2);
    expect(await agent.ownerOf(1)).to.equal(owner.address);
  });

  it("verifies a superior voice", async () => {
    const voice = ethers.keccak256(ethers.toUtf8Bytes("voice-3"));
    await agent.fuseHybridAgent("Sovereign", voice, ethers.ZeroHash, 3);
    await expect(agent.verifySuperiorVoice(1, voice, "0x1234")).to.emit(agent, "VoiceVerified");
    expect((await agent.getAgent(1)).superiorVoice).to.equal(true);
  });

  it("pauses fusion", async () => {
    await agent.pause();
    await expect(agent.fuseHybridAgent("Paused", ethers.ZeroHash, ethers.ZeroHash, 4)).to.be.reverted;
  });

  it("only owner can call ERC-4337 execution", async () => {
    await expect(agent.connect(user).executeVia4337([], owner.address)).to.be.reverted;
  });
});
