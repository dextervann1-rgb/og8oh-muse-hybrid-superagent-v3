// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

interface IERC6551Registry {
    function createAccount(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt,
        bytes calldata initData
    ) external returns (address);

    function account(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt
    ) external view returns (address);
}

struct UserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    uint256 callGasLimit;
    uint256 verificationGasLimit;
    uint256 preVerificationGas;
    uint256 maxFeePerGas;
    uint256 maxPriorityFeePerGas;
    bytes paymasterAndData;
    bytes signature;
}

interface IEntryPoint {
    function handleOps(UserOperation[] calldata ops, address payable beneficiary) external;
}

/// @title MuSeHybridSuperAgentV3
/// @notice ERC-721 identity with parameterized ERC-6551 and ERC-4337 integrations.
/// @dev The configured external contracts must be independently verified for the target chain.
contract MuSeHybridSuperAgentV3 is ERC721, Ownable, Pausable, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    IERC6551Registry public immutable registry;
    address public immutable accountImplementation;
    IEntryPoint public immutable entryPoint;

    uint256 public nextId = 1;
    string public uiURI;
    string public mcpEndpoint;
    address public voiceVerifier;

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
    mapping(bytes32 => bool) public usedVerificationDigests;

    event AgentFused(uint256 indexed tokenId, address indexed account, string name);
    event VoiceVerifierUpdated(address indexed verifier);
    event VoiceVerified(uint256 indexed tokenId, bytes32 voiceHash, bytes32 indexed verificationDigest);
    event ExecutedVia4337(uint256 indexed tokenId, address indexed sender, bytes32 operationHash);
    event ConfigUpdated(string uiURI, string mcpEndpoint);

    constructor(
        string memory _uiURI,
        string memory _mcpEndpoint,
        address _registry,
        address _accountImplementation,
        address _entryPoint
    ) ERC721("MuSe Hybrid SuperAgent", "MuSeV3") Ownable(msg.sender) {
        require(bytes(_uiURI).length > 0, "ui URI required");
        require(bytes(_mcpEndpoint).length > 0, "MCP endpoint required");
        require(_registry.code.length > 0, "registry has no code");
        require(_accountImplementation.code.length > 0, "account implementation has no code");
        require(_entryPoint.code.length > 0, "entry point has no code");

        uiURI = _uiURI;
        mcpEndpoint = _mcpEndpoint;
        registry = IERC6551Registry(_registry);
        accountImplementation = _accountImplementation;
        entryPoint = IEntryPoint(_entryPoint);
    }

    function setConfig(string calldata _uiURI, string calldata _mcpEndpoint) external onlyOwner {
        require(bytes(_uiURI).length > 0, "ui URI required");
        require(bytes(_mcpEndpoint).length > 0, "MCP endpoint required");
        uiURI = _uiURI;
        mcpEndpoint = _mcpEndpoint;
        emit ConfigUpdated(_uiURI, _mcpEndpoint);
    }

    function setVoiceVerifier(address verifier) external onlyOwner {
        require(verifier != address(0), "verifier required");
        voiceVerifier = verifier;
        emit VoiceVerifierUpdated(verifier);
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

        tokenId = nextId++;
        usedVoiceHashes[voiceHash] = true;
        _safeMint(msg.sender, tokenId);

        account = registry.createAccount(
            accountImplementation,
            block.chainid,
            address(this),
            tokenId,
            salt,
            ""
        );
        require(account != address(0), "account creation failed");

        agents[tokenId] = HybridAgent({
            name: name,
            uiURI: uiURI,
            mcpEndpoint: mcpEndpoint,
            voiceHash: voiceHash,
            compressedProof: compressedProof,
            account: account,
            superiorVoice: false,
            fusedAt: block.timestamp
        });
        emit AgentFused(tokenId, account, name);
    }

    function verificationDigest(
        uint256 tokenId,
        bytes32 voiceHash,
        bytes32 proofHash
    ) public view returns (bytes32) {
        return keccak256(abi.encode(address(this), block.chainid, tokenId, voiceHash, proofHash));
    }

    function verifySuperiorVoice(
        uint256 tokenId,
        bytes32 voiceHash,
        bytes calldata proof,
        bytes calldata signature
    ) external whenNotPaused returns (bool) {
        require(_ownerOf(tokenId) != address(0), "agent missing");
        require(agents[tokenId].voiceHash == voiceHash, "voice mismatch");
        require(proof.length > 0, "proof required");
        require(voiceVerifier != address(0), "verifier not configured");

        bytes32 digest = verificationDigest(tokenId, voiceHash, keccak256(proof));
        require(!usedVerificationDigests[digest], "proof already used");
        require(digest.toEthSignedMessageHash().recover(signature) == voiceVerifier, "invalid verifier signature");

        usedVerificationDigests[digest] = true;
        agents[tokenId].superiorVoice = true;
        emit VoiceVerified(tokenId, voiceHash, digest);
        return true;
    }

    function executeVia4337(
        uint256 tokenId,
        UserOperation[] calldata ops,
        address payable beneficiary
    ) external onlyOwner whenNotPaused nonReentrant returns (bool) {
        require(_ownerOf(tokenId) != address(0), "agent missing");
        require(ops.length > 0, "no operations");
        address expectedSender = agents[tokenId].account;
        for (uint256 i = 0; i < ops.length; i++) {
            require(ops[i].sender == expectedSender, "operation sender mismatch");
        }
        entryPoint.handleOps(ops, beneficiary);
        emit ExecutedVia4337(tokenId, msg.sender, keccak256(abi.encode(ops)));
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

    function getAgent(uint256 tokenId) external view returns (HybridAgent memory) {
        return agents[tokenId];
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function _toString(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 j = v;
        uint256 len;
        while (j != 0) { len++; j /= 10; }
        bytes memory b = new bytes(len);
        uint256 k = len;
        while (v != 0) { k--; b[k] = bytes1(uint8(48 + v % 10)); v /= 10; }
        return string(b);
    }
}
