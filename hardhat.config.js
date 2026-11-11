require("@nomicfoundation/hardhat-toolbox");

const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

module.exports = {
  solidity: "0.8.24",
  networks: {
    hardhat: {},
    base: {
      url: RPC_URL,
      chainId: 8453,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    }
  }
};
