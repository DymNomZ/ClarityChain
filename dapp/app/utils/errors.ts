// =============================================================================
// dapp/app/utils/errors.ts
// Translates raw viem/contract errors into human-readable messages.
// =============================================================================

export function parseContractError(err: any): string {
  const message: string = err?.message || err?.toString() || "";

  if (err?.code === 4001 || message.includes("User rejected") || message.includes("user rejected")) {
    return "Transaction cancelled — you rejected it in MetaMask.";
  }
  if (message.includes("Vendor not whitelisted")) {
    return "🚫 REJECTED BY CONTRACT: This address is not a whitelisted vendor. ClarityChain is working as intended.";
  }
  if (message.includes("Not the campaign NGO")) {
    return "Only the NGO that created this campaign can withdraw from it.";
  }
  if (message.includes("Not a validator")) {
    return "Your connected wallet is not a validator on this contract.";
  }
  if (message.includes("Insufficient campaign funds")) {
    return "Withdrawal amount exceeds the available campaign balance.";
  }
  if (message.includes("Campaign is not active")) {
    return "This campaign has been closed and no longer accepts withdrawals.";
  }
  if (message.includes("Vendor already whitelisted")) {
    return "This vendor is already whitelisted — no need to propose again.";
  }
  if (message.includes("You already approved this proposal")) {
    return "You have already signed this proposal with your current wallet.";
  }
  if (message.includes("Proposal already executed")) {
    return "This proposal has already been executed — the vendor is whitelisted.";
  }
  if (message.includes("Donation must be greater than 0")) {
    return "Donation amount must be greater than zero.";
  }
  if (message.includes("Goal must be greater than 0")) {
    return "Fundraising goal must be greater than zero.";
  }
  if (message.includes("Name cannot be empty")) {
    return "Campaign name cannot be empty.";
  }
  if (message.includes("Account not found")) {
    return "Wallet account not found on this network. Make sure MetaMask is connected to Polkadot Hub TestNet.";
  }
  if (message.includes("JSON is not a valid request object") || message.includes("Invalid JSON")) {
    return "Network request failed. Try again — this is usually a temporary RPC issue.";
  }
  if (message.includes("network") || message.includes("Failed to fetch")) {
    return "Network error. Check your internet connection and try again.";
  }
  if (message.includes("insufficient funds") || message.includes("gas")) {
    return "Insufficient PAS balance for gas fees. Get testnet PAS from the faucet.";
  }
  if (message.includes("Wallet not available") || message.includes("No Ethereum")) {
    return "No wallet detected. Please install MetaMask and connect it.";
  }

  const firstLine = message.split("\n")[0];
  return firstLine.length > 120
    ? firstLine.slice(0, 120) + "..."
    : firstLine || "An unexpected error occurred. Check the console for details.";
}