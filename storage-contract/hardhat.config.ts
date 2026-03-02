import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    polkadotTestNet: {
      type: "http",
      chainType: "l1",
      url: 'https://services.polkadothub-rpc.com/testnet',
      accounts: [configVariable("PRIVATE_KEY")],
    },
    "polkadot-testnet": {
      type: "http",
      chainType: "l1",
      url: "https://blockscout-testnet.polkadot.io/api/eth-rpc",
      accounts: [configVariable("PRIVATE_KEY")],
    },
  },
  etherscan: {
    apiKey: {
      "polkadot-testnet": "empty",
    },
    customChains: [
      {
        network: "polkadot-testnet",
        chainId: 420420417,
        urls: {
          apiURL: "https://blockscout-testnet.polkadot.io/api",
          browserURL: "https://blockscout-testnet.polkadot.io",
        },
      },
    ],
  },
});
