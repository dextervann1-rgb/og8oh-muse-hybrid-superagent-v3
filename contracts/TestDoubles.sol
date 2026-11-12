// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

struct MockUserOperation {
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

contract MockAccountImplementation {}

contract MockERC6551Registry {
    mapping(bytes32 => address) private accounts;

    function createAccount(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt,
        bytes calldata
    ) external returns (address accountAddress) {
        require(implementation.code.length > 0, "implementation has no code");
        bytes32 key = keccak256(abi.encode(implementation, chainId, tokenContract, tokenId, salt));
        accountAddress = accounts[key];
        if (accountAddress == address(0)) {
            accountAddress = implementation;
            accounts[key] = accountAddress;
        }
    }

    function account(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt
    ) external view returns (address) {
        return accounts[keccak256(abi.encode(implementation, chainId, tokenContract, tokenId, salt))];
    }
}

contract MockEntryPoint {
    uint256 public handledOperations;

    function handleOps(MockUserOperation[] calldata ops, address payable) external {
        handledOperations += ops.length;
    }
}
