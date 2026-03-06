// =============================================================================
// dapp/app/utils/errors.ts
// Translates raw viem/contract errors into human-readable messages.
// =============================================================================

export function parseContractError(err: any): string {
  const message: string = err?.message || err?.toString() || "";

  // User rejection
  if (err?.code === 4001 || message.includes("User rejected") || message.includes("user rejected")) {
    return "Transaction cancelled — you rejected it in MetaMask.";
  }

  // --- Vendor errors ---
  if (message.includes("VendorNotWhitelistedRejected")) {
    return "🚫 REJECTED BY CONTRACT: This address is not a whitelisted vendor. ClarityChain is working as intended.";
  }
  if (message.includes("VendorNotAssociatedWithCampaign")) {
    return "This vendor is not associated with this campaign. Associate them first in the NGO Dashboard.";
  }
  if (message.includes("AmountExceedsVendorCap")) {
    return "Amount exceeds the spending cap set for this vendor on this campaign.";
  }
  if (message.includes("VendorNotWhitelisted")) {
    return "This vendor is not whitelisted. They must be approved by validators first.";
  }
  if (message.includes("VendorAlreadyAssociated")) {
    return "This vendor is already associated with this campaign.";
  }
  if (message.includes("VendorAlreadyWhitelisted")) {
    return "This vendor is already whitelisted — no need to propose again.";
  }
  if (message.includes("VerificationLinkRequired")) {
    return "At least one verification link is required when proposing a vendor.";
  }
  if (message.includes("CallerNotAssociatedVendor")) {
    return "Your wallet is not an associated vendor of this campaign.";
  }

  // --- Campaign errors ---
  if (message.includes("NotCampaignNGO")) {
    return "Only the NGO that created this campaign can perform this action.";
  }
  if (message.includes("CampaignNotActive")) {
    return "This campaign has been closed and no longer accepts this action.";
  }
  if (message.includes("CampaignDoesNotExist")) {
    return "This campaign does not exist.";
  }
  if (message.includes("InsufficientCampaignFunds")) {
    return "Withdrawal amount exceeds the available campaign balance.";
  }
  if (message.includes("NameCannotBeEmpty")) {
    return "Campaign name cannot be empty.";
  }
  if (message.includes("GoalMustBeGreaterThanZero")) {
    return "Fundraising goal must be greater than zero.";
  }
  if (message.includes("CapMustBeGreaterThanZero")) {
    return "Vendor cap must be greater than zero.";
  }
  if (message.includes("InstructionsCannotBeEmpty")) {
    return "Procurement instructions cannot be empty.";
  }

  // --- Refund errors ---
  if (message.includes("RefundsAlreadyEnabled")) {
    return "Refunds have already been enabled for this campaign.";
  }
  if (message.includes("RefundsNotEnabled")) {
    return "Refunds have not been enabled for this campaign yet.";
  }
  if (message.includes("NoDonationFoundForWallet")) {
    return "No donation found for your wallet on this campaign.";
  }
  if (message.includes("NothingLeftToRefund")) {
    return "Nothing left to refund — all funds have already been spent on vendors.";
  }
  if (message.includes("RefundAmountMustBeGreaterThanZero")) {
    return "Refund amount must be greater than zero.";
  }

  // --- Donation errors ---
  if (message.includes("DonationMustBeGreaterThanZero")) {
    return "Donation amount must be greater than zero.";
  }
  if (message.includes("AmountMustBeGreaterThanZero")) {
    return "Amount must be greater than zero.";
  }

  // --- Governance errors ---
  if (message.includes("NotValidator")) {
    return "Your connected wallet is not a validator on this contract.";
  }
  if (message.includes("AlreadyApprovedProposal")) {
    return "You have already signed this proposal with your current wallet.";
  }
  if (message.includes("ProposalAlreadyExecuted")) {
    return "This proposal has already been executed.";
  }
  if (message.includes("ProposalDoesNotExist")) {
    return "This proposal does not exist.";
  }

  // --- Identity errors ---
  if (message.includes("WalletAlreadyVerified")) {
    return "This wallet is already verified.";
  }
  if (message.includes("ProfileLinkRequired")) {
    return "At least one profile link is required for identity verification.";
  }
  if (message.includes("AlreadyApprovedIdentityProposal")) {
    return "You have already signed this identity verification proposal.";
  }
  if (message.includes("IdentityProposalAlreadyExecuted")) {
    return "This identity verification proposal has already been executed.";
  }
  if (message.includes("IdentityProposalDoesNotExist")) {
    return "This identity verification proposal does not exist.";
  }

  // --- Network / wallet errors ---
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