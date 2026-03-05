interface Campaign {
  id: number;
  name: string;
  ngo: string;
  goalAmount: bigint;
  raisedAmount: bigint;
  withdrawnAmount: bigint;
  active: boolean;
}