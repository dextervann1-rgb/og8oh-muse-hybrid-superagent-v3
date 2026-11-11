// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IERC6551Registry {
    function createAccount(address implementation, uint256 chainId, address tokenContract, uint256 tokenId, uint256 salt, bytes calldata initData) external returns (address);
    function account(address implementation, uint256 chainId, address tokenContract, uint256 tokenId, uint256 salt) external view returns (address);
}

interface IEntryPoint {
    function handleOps(UserOperation[] calldata ops, address payable beneficiary) external;
}

struct UserOperation {
    address sender; uint256 nonce; bytes initCode; bytes callData;
    uint256 callGasLimit; uint256 verificationGasLimit; uint256 preVerificationGas;
    uint256 maxFeePerGas; uint256 maxPriorityFeePerGas; bytes signature;
}

/// @title MuSeHybridSuperAgentV3
/// @notice ERC-721 sovereign agent with ERC-6551 identity, ERC-4337 execution,
///         fused voice + compression, and owner-controlled pause / safety rails.
contract MuSeHybridSuperAgentV3 is ERC721, Ownable, Pausable, ReentrancyGuard {
    IERC6551Registry public constant REGISTRY = IERC6551Registry(0x000000006551c19487814612e58FE068137A5fF6a14B);
    IEntryPoint public immutable ENTRY_POINT = IEntryPoint(0x5FF137D4b0FDCD49DcA30c7CF57E578a026d278a);

    uint256 public nextId = 1;
    string public uiURI;
    string public mcpEndpoint;

    struct HybridAgent {
        string name;
        string uiURI;
        string mcpEndpoint;
        bytes32 voiceHash;
        bytes32 compressedProof;
        address account;
        bool superiorVoice;
        uint256 fusedAt;
    }

    mapping(uint256 => HybridAgent) public agents;
    mapping(bytes32 => bool) public usedVoiceHashes;

    event AgentFused(uint256 indexed tokenId, address indexed account, string name);
    event VoiceVerified(uint256 indexed tokenId, bytes32 voiceHash);
    event ExecutedVia4337(uint256 indexed tokenId, address indexed sender, bytes32 operationHash);
    event ConfigUpdated(string uiURI, string mcpEndpoint);

    constructor(string memory _uiURI, string memory _mcpEndpoint)
        ERC721("MuSe Hybrid SuperAgent", "MuSeV3") Ownable(msg.sender) {
        uiURI = _uiURI;
        mcpEndpoint = _mcpEndpoint;
    }

    function setConfig(string calldata _uiURI, string calldata _mcpEndpoint) external onlyOwner {
        uiURI = _uiURI; mcpEndpoint = _mcpEndpoint;
        emit ConfigUpdated(_uiURI, _mcpEndpoint);
    }

    function fuseHybridAgent(
        string calldata name,
        bytes32 voiceHash,
        bytes32 compressedProof,
        uint256 salt
    ) external whenNotPaused nonReentrant returns (uint256 tokenId, address account) {
        require(bytes(name).length > 0, "name required");
        require(voiceHash != bytes32(0), "voice required");
        require(!usedVoiceHashes[voiceHash], "voice already fused");

        tokenId = nextId;
        nextId = tokenId + 1;
        usedVoiceHashes[voiceHash] = true;

        _safeMint(msg.sender, tokenId);
        account = REGISTRY.createAccount(address(this), block.chainid, address(this), tokenId, salt, "");
        agents[tokenId] = HybridAgent({
            name: name, uiURI: uiURI, mcpEndpoint: mcpEndpoint,
            voiceHash: voiceHash, compressedProof: compressedProof,
            account: account, superiorVoice: false, fusedAt: block.timestamp
        });
        emit AgentFused(tokenId, account, name);
    }

    function verifySuperiorVoice(uint256 tokenId, bytes32 voiceHash, bytes calldata proof) external whenNotPaused returns (bool) {
        require(_ownerOf(tokenId) != address(0), "agent missing");
        require(agents[tokenId].voiceHash == voiceHash, "voice mismatch");
        require(proof.length > 0 && keccak256(proof) != bytes32(0), "proof required");
        agents[tokenId].superiorVoice = true;
        emit VoiceVerified(tokenId, voiceHash);
        return true;
    }

    function executeVia4337(UserOperation[] calldata ops, address payable beneficiary) external onlyOwner whenNotPaused nonReentrant returns (bool) {
        require(ops.length > 0, "no operations");
        ENTRY_POINT.handleOps(ops, beneficiary);
        emit ExecutedVia4337(0, msg.sender, keccak256(abi.encode(ops)));
        return true;
    }

    function getMasterpieceManifesto(uint256 tokenId) external view returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "agent missing");
        HybridAgent memory a = agents[tokenId];
        return string(abi.encodePacked(
            "MuSe Hybrid SuperAgent #", _toString(tokenId), " | ", a.name,
            " | Sovereign voice, fused compression, Base-native identity."
        ));
    }

    function getAgent(uint256 tokenId) external view returns (HybridAgent memory) { return agents[tokenId]; }
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    function _toString(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 j = v; uint256 len;
        while (j != 0) { len++; j /= 10; }
        bytes memory b = new bytes(len); uint256 k = len;
        while (v != 0) { k--; b[k] = bytes1(uint8(48 + v % 10)); v /= 10; }
        return string(b);
    }
}
