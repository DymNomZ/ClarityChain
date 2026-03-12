// =============================================================================
// dapp/app/utils/validators.ts
// Hardcoded validator profiles for the ClarityChain deployment.
// Validators are set at deploy time by the ClarityChain team — they don't go
// through the community verification flow. This file is the source of truth
// for their identities and profile links.
// =============================================================================

export interface ValidatorProfile {
  name: string;
  links: string[];
}

// Keys are lowercase wallet addresses.
export const VALIDATOR_PROFILES: Record<string, ValidatorProfile> = {
  // Dymes
  "0x75c71fbb2048df9461f27ae7476db45fddffa1d7": {
    name: "Government Unit",
    links: ["https://faucet.polkadot.io/"],
  },
  "0x7077bd1b0ee55f4a7a2b3fef4c916e35b8547b7f": {
    name: "Civic Organization",
    links: ["https://faucet.polkadot.io/"],
  },
  "0xe8ff0f4efae291263b1438c9c6441f6a6c9eb0e2": {
    name: "Academic Institution",
    links: ["https://faucet.polkadot.io/"],
  },
  // Zillion
  "0xd9a2F88dFbe0133Ed78B2f0515BaF6D08443FD47": {
    name: "Government Unit",
    links: ["https://faucet.polkadot.io/"],
  },
  "0x5CfF8a6E17EdB109A678bfb9347E99c9b4E1569E": { // Zillion Validator
    name: "Civic Organization",
    links: ["https://faucet.polkadot.io/"],
  },
  "0x42cCA21cfbea77b341bBC64105b66FD79B6b3060": { // Zillion Vendor
    name: "Academic Institution",
    links: ["https://faucet.polkadot.io/"],
  },
};

export function getValidatorProfile(address: string): ValidatorProfile | null {
  return VALIDATOR_PROFILES[address.toLowerCase()] ?? null;
}

export function isKnownValidator(address: string): boolean {
  return address.toLowerCase() in VALIDATOR_PROFILES;
}