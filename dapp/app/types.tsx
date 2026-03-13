interface Campaign {
  id: number;
  name: string;
  ngo: string;
  goalAmount: bigint;
  raisedAmount: bigint;
  withdrawnAmount: bigint;
  active: boolean;
  refundsEnabled: boolean;
  vendors: string[]
}

interface FeedEvent {
  type: string;
  txHash: string;
  blockNumber: bigint;
  data: Record<string, string>;
  campaignId?: number;
  campaignNgo?: string;
}

// Vendor map fetched once at TransactionFeed level and passed as prop.
// Map key is lowercase address, value is { name, links }.
type VendorMap = Map<string, { name: string; links: string[] }>;