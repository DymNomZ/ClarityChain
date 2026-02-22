# 💮 ClarityChain 🔍
### 🚫 The Anti-Corruption Donation Tracker 🚫
**🌸 Polkadot Solidity Hackathon 2026 — Cebu Edition 🌷**

> *"In the Philippines, we don't have a donation problem. We have a trust problem. ClarityChain doesn't ask you to trust anyone — it makes trust mathematically unnecessary."*

---

## 🔍 What is ClarityChain?

ClarityChain is a transparent donation platform built on Polkadot Hub where NGOs and LGUs can receive disaster relief funds — with one critical constraint: **they can only spend those funds by sending to pre-approved, community-vetted vendors.**

The contract itself enforces this. There is no admin override. There is no backdoor. An NGO cannot withdraw to their personal wallet — the transaction is rejected at the smart contract level. Every donation received, every vendor approved, and every withdrawal made is permanently visible on the public dashboard.

This directly addresses the trust problem that plagues Philippine disaster relief. When Typhoon Odette hit, people donated. They just didn't know where the money went. ClarityChain makes that question unanswerable by design — because the code answers it automatically.

---

## 🔩 How It Works

### For Donors
1. Browse active campaigns on the dashboard
2. Connect a MetaMask wallet
3. Donate PAS (testnet) or USDC to any active campaign
4. Watch your donation appear in the public transaction feed immediately

### For NGOs
1. Connect the NGO wallet (the assigned treasurer or tech person)
2. Create a campaign with a name and fundraising goal
3. Submit withdrawal requests — but only to whitelisted vendor addresses
4. Non-whitelisted addresses are rejected on-chain. The rejection is visible to the public.

### For Validators (Multi-Sig Governance)
1. Any validator proposes a new vendor for whitelisting
2. Other validators sign off on the proposal
3. Once 3 out of the configured validators approve, the vendor is automatically whitelisted
4. All proposals, approvals, and whitelistings are logged on-chain permanently

---

## 🔨 Project Structure

```
ClarityChain/
├── storage-contract/          # Hardhat project — smart contract
│   ├── contracts/
│   │   └── ClarityChain.sol   # The core contract
│   ├── scripts/
│   │   └── deploy-claritychain.ts
│   ├── artifacts/             # Auto-generated after compile
│   ├── hardhat.config.ts
│   └── .env                   # Your private key (never commit this)
│
└── dapp/                      # Next.js frontend
    ├── abis/
    │   └── ClarityChain.json  # Copied from artifacts after compile
    ├── app/
    │   ├── components/
    │   │   ├── WalletConnect.tsx
    │   │   ├── CampaignList.tsx
    │   │   ├── CreateCampaign.tsx
    │   │   ├── WithdrawToVendor.tsx
    │   │   ├── VendorManagement.tsx
    │   │   └── TransactionFeed.tsx
    │   ├── utils/
    │   │   ├── viem.ts          # Chain config and client setup
    │   │   └── contract.ts      # Contract address and ABI export
    │   ├── page.tsx             # Main tabbed layout
    │   └── layout.tsx
    └── package.json
```

---

## 📀 Deployed Contract

| Network | Address |
|---------|---------|
| Polkadot Hub TestNet (Passet Hub) | `0x17ed98199e7f392c84e9c7fcb6260a48dbbea292` |

Block Explorer: https://blockscout-passet-hub.parity-testnet.parity.io/address/0x17ed98199e7f392c84e9c7fcb6260a48dbbea292

---

## 🔧 Setup Instructions

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [MetaMask](https://metamask.io/) browser extension
- Git

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/ClarityChain.git
cd ClarityChain
```

### 2. Set up the smart contract project

```bash
cd storage-contract
npm install
```

Create a `.env` file in the `storage-contract/` folder:
```
PRIVATE_KEY=0xYourMetaMaskPrivateKeyHere
```

> To get your MetaMask private key: MetaMask → Account Details → Export Private Key. **Never share this or commit it to GitHub.**

### 3. Set up MetaMask for Polkadot Hub TestNet

Add the network to MetaMask manually:

| Field | Value |
|-------|-------|
| Network Name | Polkadot Hub TestNet |
| Chain ID | `420420417` |
| RPC URL | `https://services.polkadothub-rpc.com/testnet` |
| Currency Symbol | PAS |

Get free testnet PAS from the faucet: https://faucet.polkadot.io/?parachain=1111

### 4. Compile the contract

```bash
cd storage-contract
npx hardhat compile
```

You should see `Successfully compiled 1 Solidity file`.

### 5. Copy the ABI to the frontend

```bash
cp storage-contract/artifacts/contracts/ClarityChain.sol/ClarityChain.json dapp/abis/ClarityChain.json
```

### 6. Run the frontend

```bash
cd dapp
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

### 7. (Optional) Redeploy the contract

You only need this if you're deploying a fresh instance. The contract is already live — see address above.

Open `scripts/deploy-claritychain.ts` and fill in the `VALIDATORS` array with 3–5 wallet addresses:

```typescript
const VALIDATORS: `0x${string}`[] = [
  "0xWallet1Address",
  "0xWallet2Address",
  "0xWallet3Address",
];
```

Then:

```bash
npx hardhat run scripts/deploy-claritychain.ts --network polkadotTestNet
```

Save the printed contract address and update `dapp/app/utils/contract.ts`.

---

## 💾 Key Files to Know

**`storage-contract/contracts/ClarityChain.sol`**
The entire backend logic. Key functions: `createCampaign()`, `donate()`, `withdrawToVendor()`, `proposeVendor()`, `approveVendor()`. The `require(whitelistedVendors[vendor])` line inside `withdrawToVendor()` is the core mechanic — everything else supports it.

**`dapp/app/utils/viem.ts`**
Chain configuration and viem client setup. If the RPC endpoint changes, update it here.

**`dapp/app/utils/contract.ts`**
Contract address and ABI export. If you redeploy, update `CONTRACT_ADDRESS` here.

**`dapp/app/components/WithdrawToVendor.tsx`**
Contains the live whitelist check UI and the withdrawal flow. The rejection error message is intentionally surfaced clearly — this is the demo moment.

---

## 🏃‍♂️ Demo Day Flow

Practice this until it's muscle memory:

1. **Vendor Governance tab** → Propose "Cebu Rice Supply Co." with Wallet 2's address → Switch to Wallet 2, sign approval → Switch to Wallet 3, sign approval → Vendor is whitelisted ✅
2. **NGO Dashboard tab** → Create campaign "Typhoon Odette Relief Fund" ✅
3. **Donate tab** → Donate 0.5 PAS to the campaign ✅
4. **NGO Dashboard → Withdraw to Vendor** → First: paste a random non-whitelisted address → Contract REJECTS it 🚫 → Second: paste whitelisted vendor → Goes through ✅
5. **Public Feed tab** → All transactions visible to anyone ✅

> The rejection moment in Step 4 is your entire pitch in one screen. Pause on it. Let the judges read the error message. Then show the successful withdrawal immediately after.

---

## 🌺 Why Polkadot?

- **EVM Compatibility:** Solidity works natively on Polkadot Hub — no rewriting needed
- **Lower Fees:** Significantly cheaper than Ethereum mainnet, important for micro-donations in the Philippine context
- **Interoperability:** Future versions could receive donations from multiple chains without bridging friction

---

## 🚧 Known Scope Boundaries

**Traditional payments (GCash, bank transfer, cash):** ClarityChain handles the *spending* side of donations. Fiat collection still happens through the NGO's existing infrastructure — a treasurer converts and deposits into the contract. The transparency and vendor-lock mechanic applies to everything after that point.

**Shell vendors:** ClarityChain cannot prevent a fraudulent business from registering. What it does is make every vendor's wallet address and name permanently public, creating an auditable paper trail. Legal accountability handles the rest.

---

## 💪 Team

> *Team Lead: John Dymier Borgonia - BSCS 3*
John Zillion Reyes - BSCS 3
Jeremiah Ramos - BSIT 3

---

## 🏁 Hackathon

- **Event:** 🌹 Polkadot Solidity Hackathon 2026: Cebu Edition 🌺
- **Category:** Category 1 — DeFi / Stablecoin-enabled dApps
- **Powered by:** Polkadot and OpenGuild
- **Demo Day:** March 15, 2026

---

🔗🌸*Built for Cebu. Built for trust. Built on Polkadot.* 🌷🔗