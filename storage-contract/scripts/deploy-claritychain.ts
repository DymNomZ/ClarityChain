import { createWalletClient, createPublicClient, http, defineChain, encodeDeployData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import hre from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

// =============================================================================
// deploy-claritychain.ts
// Deploys ClarityChain.sol to Passet Hub (Polkadot Hub TestNet)
//
// BEFORE RUNNING:
//   1. Make sure your private key is set:
//        npx hardhat vars set PRIVATE_KEY
//   2. Fill in your 3 validator wallet addresses below.
//   3. Run with:
//        npx hardhat run scripts/deploy-claritychain.ts --network polkadotTestNet
// =============================================================================

// -----------------------------------------------------------------------------
// STEP 1: Fill in your 3 team wallet addresses here.
// These are the validator wallets for the 3-of-5 multi-sig.
// For the hackathon demo, 3 wallets is enough (REQUIRED_APPROVALS = 3).
// All three need to be MetaMask wallets connected to Passet Hub.
// -----------------------------------------------------------------------------
const VALIDATORS: `0x${string}`[] = [
  "0x75c71fBb2048Df9461f27ae7476Db45FddFfa1D7",
  "0x7077Bd1b0ee55F4A7a2B3FEf4c916e35B8547B7F",
  "0xe8ff0f4efae291263b1438C9c6441f6a6c9Eb0e2",
];

// Custom chain definition — matches your existing viem.ts in the dapp
const polkadotHub = defineChain({
  id: 420420417,
  name: "Polkadot Hub TestNet",
  nativeCurrency: { name: "PAS", symbol: "PAS", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://services.polkadothub-rpc.com/testnet"] },
  },
});

async function main() {
  console.log("=======================================================");
  console.log("  ClarityChain Deployment — Passet Hub (Polkadot Hub TestNet)");
  console.log("=======================================================\n");

  // Validate validators array
  for (const v of VALIDATORS) {
    if (v.startsWith("0xYOUR")) {
      console.error("ERROR: Fill in the VALIDATORS array with your 3 wallet addresses.");
      process.exit(1);
    }
  }

  // Build account from private key
  const privateKey = process.env.PRIVATE_KEY;
  console.log("Key length:", privateKey?.length);
  console.log("Starts with 0x:", privateKey?.startsWith("0x"));
  if (!privateKey) {
    console.error("ERROR: PRIVATE_KEY not found in .env file");
    process.exit(1);
  }
  const rawKey = process.env.PRIVATE_KEY?.trim();
  // Strip any existing 0x prefix and reattach cleanly
  const cleanKey = `0x${rawKey!.replace(/^0x/i, "")}` as `0x${string}`;
  const account = privateKeyToAccount(cleanKey);

  // Create viem clients with the custom chain
  const publicClient = createPublicClient({
    chain: polkadotHub,
    transport: http("https://services.polkadothub-rpc.com/testnet"),
  });

  const walletClient = createWalletClient({
    chain: polkadotHub,
    transport: http("https://services.polkadothub-rpc.com/testnet"),
    account,
  });

  console.log("Deployer address:", account.address);

  const balance = await publicClient.getBalance({ address: account.address });
  console.log("Deployer balance:", balance.toString(), "wei\n");

  if (balance === 0n) {
    console.error(
      "ERROR: Deployer has 0 balance.\n" +
      "Get testnet PAS from: https://faucet.polkadot.io/?parachain=1111"
    );
    process.exit(1);
  }

  console.log("Validators:");
  VALIDATORS.forEach((v, i) => console.log(`  [${i + 1}] ${v}`));
  console.log("");

  // Get the compiled artifact from Hardhat
  const artifact = await hre.artifacts.readArtifact("ClarityChain");

  console.log("Deploying ClarityChain...");

  const deployData = encodeDeployData({
    abi: artifact.abi,
    bytecode: artifact.bytecode as `0x${string}`,
    args: [VALIDATORS],
  });

  const txHash = await walletClient.sendTransaction({
    data: deployData,
    gas: 3_000_000n,
  });

  console.log("Transaction hash:", txHash);
  console.log("Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  if (!receipt.contractAddress) {
    console.error("ERROR: Deployment failed — no contract address in receipt.");
    console.error("Receipt:", receipt);
    process.exit(1);
  }

  console.log("\n✅ ClarityChain deployed successfully!");
  console.log("Contract address:", receipt.contractAddress);

  console.log("\n=======================================================");
  console.log("  NEXT STEP: Update your frontend");
  console.log("=======================================================");
  console.log(`\n  CONTRACT_ADDRESS = "${receipt.contractAddress}"\n`);
  console.log("Copy the ABI from:");
  console.log("  storage-contract/artifacts/contracts/ClarityChain.sol/ClarityChain.json");
  console.log("into:");
  console.log("  dapp/abis/ClarityChain.json");
  console.log("=======================================================\n");
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});