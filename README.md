# 💮 ClarityChain 🔍
### 🚫 The Anti-Corruption Donation Tracker 🚫
**🌸 Polkadot Solidity Hackathon 2026 — Cebu Edition 🌷**

> *"In the Philippines, we don't have a donation problem. We have a trust problem. Etc. etc., we need to work on an opening hook AHAHAHAHHA"*

---

## 🌸 What is ClarityChain?

ClarityChain is a transparent donation platform built on Polkadot Hub where organizations and individuals can create campaigns and receive funds with one critical constraint in that **they can only spend those funds by sending to whitelisted vendors.**

The capaign creator cannot withdraw to their personal wallet, the transaction is rejected at the smart contract level before it even reaches the blockchain. Every donation received, every vendor approved, and every withdrawal made is permanently visible on the public dashboard.

This addresses the trust problem that plagues Philippine donation efforts like disaster reliefs and fund raisings. When Typhoon a hits, people doonate but how would we know where the money went?

### 🌸 What ClarityChain Solves

ClarityChain solves the **spending side** of the donation trust problem. It guarantees that donated funds can only exit a campaign contract through a whitelisted vendor address. 

### 🌸 What ClarityChain Does Not Solve

- **Fiat donations**: GCash, bank transfers, and physical cash are out of scope. An organization treasurer collects these through existing infrastructure, converts to crypto, and deposits into the contract. The transparency mechanic applies to everything after that point.
- **Vendor fulfillment**: ClarityChain cannot verify that goods were delivered. What it does guarantee is that if a vendor fails to deliver, there is an immutable, public, timestamped financial record proving exactly who received what and when, making legal accountability straightforward.
- **Duplicate campaigns** Nothing prevents two wallets from creating identically named campaigns. Trust in which campaign is legitimate comes from the same off-chain social layer. Donors should only donate to campaigns whose wallet address has been publicly announced through the organization's verified channels.

---

## 🌷 The Users of ClarityChain

ClarityChain has five distinct user groups, each with a different role and level of trust in the system.

### 🌸 Donors
Anyone with a crypto wallet can donate to any active campaign. They do not need to know anything about smart contracts. They connect their wallet, pick a campaign, enter an amount, and confirm. Their donation is immediately visible on the Public Feed, verifiable by anyone. Donors can trust that their money cannot be withdrawn to a personal wallet, the smart contract enforces this without requiring them to monitor anything.

### 🌸 Campaign Creators
These are the individuals or organizations running donation/relief campaigns. They create campaigns, receive donations into the campaign contract, and submit withdrawal requests to associated vendors who supply the goods or services needed for the donation effort. Critically, they cannot withdraw to their own wallet. Their only role is procurement management. Anyone can technically create a campaign, the contract has no restriction on this. What separates a trustworthy campaign from an unknown one is whether the creator has been verified (*denoted with a **checkmark** beside the creator's address visible in the campaign card*) by publicly linked their wallet address to a verified identity through the organization's official channels.

### 🌸 Vendors
Vendors are the final destination of donated funds. They are businesses, suppliers, and organizations that provide the goods or services that relief efforts require such as rice suppliers, construction material providers, medical supply companies, logistics organizations. They receive payment in exchange for goods delivered to actual recipients. They are called vendors deliberately because the relationship is commercial, not charitable. An campaign creator partners with a vendor, having detailed, public instructions on what to do with the received donations. This removes the creator as a financial intermediary entirely. Vendors must be proposed and whitelisted through the multi-sig governance process before they can receive any funds. Their wallet address, business name, and verification links are permanently public on the platform.

### 🌸 Validators
Validators are the governance layer of ClarityChain. They are trusted community representatives, a multi-sig group of wallet addresses whose collective approval is required before any vendor can be whitelisted. No single validator can approve a vendor alone. A minimum of 3 out of the configured validator set must sign off. Every approval is logged on-chain, permanently, with the validator's wallet address attached. This means if a fraudulent vendor is ever approved, there is an immutable public trail of exactly which validators signed off creating accountability for the validators themselves.

### 🌸 The General Public
The general public does not need a wallet to use ClarityChain. They can browse active campaigns, view the full transaction history on the Public Feed, trace fund flows from donor to campaign to vendor, and verify that withdrawals only went to named, approved vendors. The Public Feed is ClarityChain's primary accountability tool for non-technical users as it translates on-chain events into human-readable entries that anyone can follow. Block explorer data is available for technically literate auditors, journalists, and watchdogs who want to verify beyond what the UI displays.

---

## 🔩 How It Works

### 🌸 For Donors
1. Browse active campaigns on the Donate tab
2. Connect a MetaMask wallet
3. Enter a donation amount in PAS and confirm the transaction
4. Your donation appears immediately in the Public Feed
5. You can return at any time to verify the campaign's transaction history — every withdrawal to every vendor is permanently visible

### 🌸 Campaign Creators
1. Connect the organization's wallet
2. Create a campaign with a name and fundraising goal. Campaigns can be created immediately without waiting to identify vendors first.
3. Receive donations into the campaign contract as they come in
4. Identify and propose vendors appropriate to the campaign's needs along with detailed and public instructions on what each vendor is expected to execute upon receiving the funds
5. Submit withdrawals to the associated vendors' addresses with the contract enforcing that no other destination is possible
6. If a campaign cannot find appropriate vendors or needs to close early, they can initiate refunds as the contract's permanent donation record allows exact amounts to be returned to each original donor wallet

### 🌸 For Vendors
1. Submit a vendor proposal through the Vendor Governance tab. Any wallet can propose, including vendors themselves.
2. Provide a business name and at least one verification link (DTI registration, Facebook business page, official website, etc.)
3. Wait for the multi-sig validator approval process to complete
4. Once whitelisted, receive withdrawal transactions from campaign creators.
5. Fulfill the procurement obligation, deliver the goods or services to the recipients as agreed off-chain with the campaign creator.
6. Vendors have the option to opt out on a campaign they are associated with and the option to refund the received donations to the campaign where it originated from.
7. As by design, if a validtor receives a donation and they refuse to fulfill their obligation or did not agree with the campaign creator to collaborate, they are expected to refund the campaign. Failing to do so would lead to legal accountability as their record of receiving the funds are kept on the chain permanently and visible to the public.

### 🌸 For Validators
1. Monitor the Vendor Governance tab for pending vendor proposals
2. Review each proposal's submitted verification links independently.
3. Sign approvals on-chain if the vendor passes review, each signature is a public, permanent attestation of your judgment
4. Reach the threshold (3 of the configured validator set) to automatically whitelist the vendor
5. Exercise the same process for any future governance decisions

### 🌸 For the General Public
1. Visit the Public Feed tab, no wallet required
2. Browse the complete chronological history of every on-chain event: campaigns created, donations received, vendor proposals, validator approvals, and withdrawals
3. Click into any campaign to see its specific transaction history
4. Follow the money, every peso that entered a campaign can be traced to the exact vendor address it left to
5. Cross-reference vendor addresses with their publicly submitted verification links to independently assess legitimacy
6. If anything looks suspicious like unusual withdrawal patterns, an unfamiliar vendor, unexpected amounts raise it publicly through community channels

---

## 🌷 Vendor Governance: Minimum of 3 Signatures

### 🌸 How It Works

Any governance action only executes when at least 3 of those wallets sign it. No single person can whitelist a vendor alone. They need a majority across at least three independent parties simultaneously.

### 🌸 Who Gets to Be a Validator

Validators are set at contract deployment time by the ClarityChain team. In a real-world deployment, this requires the team to establish relationships with credible organizations. **Government units** like **DSWD or LGUs, established journalists, civic organizations, academic institutions,** and **established NGOs with clean track records.**


### 🌸 The Vendor Proposal Process

Anyone can submit a vendor proposal, including vendors themselves. 
The proposal requires:

- Business name
- Wallet address
- At least one verification link (DTI registration, official website, Facebook business page, etc.)

This goes into a pending queue on the Vendor Governance tab. Validators independently review the submitted links and sign their approval on-chain. Once the required threshold is reached, the vendor is automatically whitelisted. The entire process is public and permanent.

### 🌸 How Validators Identify Fraudulent Vendors

A legitimate vendor will have a DTI registration, a verifiable business history, a Google Maps listing, and a social media presence with years of activity. A shell company created last week has none of these. The verification links are the evidence validators review. Their on-chain signatures are their public attestation that the evidence was sufficient. If they approve a fraudulent vendor, their wallet address, and their real-world identity, since validators are public figures this is permanently associated with that decision.

---

## 🌷 Transparency and Traceability

### 🌸 What the Public Can See

Everything. Every transaction is permanently on-chain and accessible through two layers:

**The Public Feed (for everyone):** Human-readable event log showing campaigns created, donations received, vendor proposals submitted, validator approvals signed, and withdrawals sent. Organized by campaign. No wallet required to view.

**The Block Explorer (for auditors):** Raw transaction data at `https://blockscout-testnet.polkadot.io`. Every transaction hash, every wallet address, every wei transferred. For journalists, watchdogs, and technically literate individuals who want to verify beyond what the UI shows. The contract source code is verified on the explorer, anyone can read the Solidity and confirm it does exactly what ClarityChain claims.

### 🌸 How to Trace a Donation

1. Find the campaign on the Public Feed
2. See every `DonationReceived` event where each one shows the donor wallet and amount
3. See every `WithdrawalToVendor` event where each one shows the vendor wallet, amount, and campaign
4. Cross-reference vendor wallets with their proposal entries to see the business name and verification links
5. See which validators signed off on each vendor via `VendorApprovalSigned` events

### 🌸 Wallet Addresses and Identity

Blockchain addresses are pseudonymous by default. A wallet address proves cryptographic ownership but reveals no personal information. For ClarityChain, this means:

- **Donors** can remain anonymous if they choose. Their privacy is protected.
- **Campaign creators** are pseudonymous by default but are strongly encouraged to publicly link their wallet address to their organization through official channels. A campaign from an unlinked, unknown wallet should receive less donor trust than one from a wallet publicly announced by a verified organization.
- **Vendors** are pseudonymous by default but their business name and verification links are public as part of the whitelisting process, providing a meaningful accountability layer.
- **Validators** are expected to deanonymize themselves fully. They are public figures accepting a public governance role. Their wallet addresses being known is what makes validator accountability possible.

This model, pseudonymity by default, voluntary deanonymization for credibility, is the correct balance between privacy and accountability for a platform of this kind.

---

## 🌷 Real-World Scenarios

### 🌸 Scenario 1: Typhoon Relief (Standard Flow)
A typhoon hits Cebu. A registered organization creates a "Typhoon Relief Fund" campaign and announces their wallet address through their official Facebook page and press release. Donors recognize the wallet address as credible via a checkmark beside the address and a link that points to the organizations's website and donate. The organization identifies three suppliers; a rice distributor, a tarpaulin manufacturer, and a trucking company, and submits vendor proposals for each. Validators review their DTI registrations, websites, etc. and approve them. The organization withdraws to each vendor. The public can see every peso that went to each supplier. The vendors deliver goods to evacuation centers.

### 🌸 Scenario 2: Unknown Campaign Creator
Someone creates a campaign named "Earthquake Relief Fund" but their wallet address is not linked to any publicly known organization. Donations trickle in slowly because donors cannot verify who created it. Furthermore, there would be no checkmark beside the creator's wallet address in the campaign card to signify its validity. The platform's transparency shows an unverified creator, and the public responds with appropriate skepticism. Meanwhile, the vendor-lock mechanic ensures that even if donations come in, they cannot be withdrawn to a personal wallet regardless of who created the campaign.

### 🌸 Scenario 3: Fraudulent Vendor Attempt
An campaign creator attempts to withdraw to an address that has not been whitelisted, perhaps their own personal wallet, or a shell address. The contract rejects the transaction before it executes. The rejection is visible on-chain. The attempted withdrawal itself becomes a public record, raising immediate questions about the creator's intentions.

### 🌸 Scenario 4: Campaign With No Vendors
A campaign raises significant donations but no vendors have been proposed yet. The public can see on the feed that money is coming in but no withdrawals are going out. This visibility creates organic social pressure on the campaign creator to act. If a campaign sits with unspent funds for an unreasonable period, the community can flag it publicly. Donors can demand accountability. The inaction is visible, unlike traditional donation drives where the same inaction would be completely invisible.

### 🌸 Scenario 5: Validator Approves a Shell Company
A shell vendor somehow gets past the verification process and is whitelisted. They receive a withdrawal and fail to deliver goods. The public feed shows every `VendorApprovalSigned` event with the approving validators' wallet addresses. Validators are publicly known figures. The shell vendor's wallet address, the amount received, and the campaign it came from are all permanently on-chain. Legal action becomes straightforward as the financial evidence is irrefutable, and accountability traces directly to the validators who signed off.

---

## 🔨 Project Structure

```
ClarityChain/
├── storage-contract/          # Hardhat project — smart contract
│   ├── contracts/
│   │   └── ClarityChain.sol   # The core contract
│   ├── scripts/
│   │   └── deploy-claritychain.ts
│   ├── test/
│   │   └── ClarityChain.test.ts  # 22 tests, all passing
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
    │   │   ├── contract.ts      # Contract address and ABI export
    │   │   └── errors.ts        # Human-readable error messages
    │   ├── page.tsx             # Main tabbed layout
    │   └── layout.tsx
    └── package.json
```

---

## 📀 Deployed Contract

| Network | Address |
|---------|---------|
| Polkadot Hub TestNet (Passet Hub) | `0xfa26ab4f40387ddaae9c338abbb9984678ce0c29` |

Block Explorer (verified ✅): https://blockscout-testnet.polkadot.io/address/0xfa26ab4f40387ddaae9c338abbb9984678ce0c29

The contract source code is verified on Blockscout. Anyone can read the Solidity directly on the explorer and confirm it does exactly what this README describes.

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

Create a `.env` file in the `storage-contract/` folder (use `.env.example` as reference):
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

### 5. Run the tests

```bash
npx hardhat test
```

All 22 tests should pass. The most important: `🚫 REJECTS withdrawal to a non-whitelisted address` — this is the core mechanic verified programmatically.

### 6. Copy the ABI to the frontend

```bash
cp storage-contract/artifacts/contracts/ClarityChain.sol/ClarityChain.json dapp/abis/ClarityChain.json
```

### 7. Run the frontend

```bash
cd dapp
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

### 8. (Optional) Redeploy the contract

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
The entire backend logic. Key functions: `createCampaign()`, `donate()`, `withdrawToVendor()`, `proposeVendor()`, `approveVendor()`. The `require(whitelistedVendors[vendor], "ClarityChain: Vendor not whitelisted -- REJECTED")` line inside `withdrawToVendor()` is the core mechanic — everything else supports it.

**`dapp/app/utils/viem.ts`**
Chain configuration and viem client setup. If the RPC endpoint changes, update it here.

**`dapp/app/utils/contract.ts`**
Contract address and ABI export. If you redeploy, update `CONTRACT_ADDRESS` here.

**`dapp/app/utils/errors.ts`**
Translates raw contract revert strings and viem errors into human-readable messages. All components use this for consistent error handling.

**`dapp/app/components/WithdrawToVendor.tsx`**
Contains the live whitelist check UI and the withdrawal flow. The rejection error message is intentionally surfaced clearly — this is the demo moment.

---

## 💪 Team

**Team Lead:** John Dymier Borgonia — BSCS 3
John Zillion Reyes — BSCS 3
Jeremiah Ramos — BSIT 3

---

## 🏁 Hackathon

- **Event:** 🌹 Polkadot Solidity Hackathon 2026: Cebu Edition 🌺
- **Category:** Category 1 — DeFi / Stablecoin-enabled dApps
- **Powered by:** Polkadot and OpenGuild
- **Demo Day:** March 15, 2026

---

## 🌸 Q&A — Judge Preparation

---

**Q: How is ClarityChain different from Giveth or The Giving Block?** *(We need to look for similar existing solutions)*

> Giveth and The Giving Block are transparency layers on top of existing donation flows, they show you where money went after the fact. An NGO on Giveth can still withdraw to their personal wallet and post a receipt later. On ClarityChain, that transaction is technically impossible. The contract has one exit: a whitelisted vendor address. We are not asking donors to trust the NGO's reporting. We are making the NGO's choices structurally limited by code. The constraint is architectural, not behavioral.

---

**Q: Why use vendors at all? Why not send money directly to disaster victims?**

Disaster victims typically do not have crypto wallet, sdon't have smartphones, and are in no position to interact with a blockchain application during a crisis. The realistic model is that an NGO procures goods from vendors, vendors deliver goods to recipients. ClarityChain sits between the NGO and the vendor, not between the vendor and the recipient. This is out of scope and realistically cannot be on-chain.

---

**Q: What stops an an individual or organization from creating a fake campaign and collecting donations?**

Two things. First, the vendor-lock mechanic means that even if a fraudulent campaign collects donations, they cannot withdraw to their personal wallet. The money is trapped in the contract until it goes to a whitelisted vendor. Second, campaign creators are visible on the Public Feed. A campaign from an unlinked, unknown wallet should receive less donor trust. This is the same social layer that governs trust in all public fundraising, donors verify the campaign creator's identity through official channels before donating. ClarityChain makes the financial side transparent; the identity verification layer is the NGO's responsibility to establish off-chain.

---

**Q: The validator addresses are hardcoded, what if a validator's wallet is compromised?**

Validator addresses are intentionally public as accountability requires visibility. What is private is the key controlling each address, which each validator is individually responsible for securing. If a validator's key were compromised, the correct response is to redeploy the contract with a new validator set. This is a known limitation of the current implementation and is already on our roadmap which is the dynamic validator add/remove via the existing multi-sig threshold, so the validator set can be updated without redeployment.

---

**Q: What happens if a campaign raises funds but cannot find vendors?**

The contract's permanent donation record means the campaign creator can initiate refunds, exact amounts returned to each original donor wallet, verifiable by anyone since every donation is on-chain. The refund process is transparent by the same mechanism as everything else.

---

**Q: Does ClarityChain work for individuals, or only for formal NGOs?**

Currently the platform is optimized for organizations with a designated person who can manage a wallet. However, any individual with a crypto wallet can create a campaign. The difference is trust, an unverified individual campaign will receive less donor confidence than one created by a wallet publicly linked to a registered organization.

---

**Q: What about people who want to donate but don't have crypto wallets?**

This is an acknowledged scope boundary. ClarityChain handles the spending side of donations. Traditional donors using GCash, bank transfers, or cash still work through existing NGO infrastructure, an NGO treasurer collects fiat, converts to crypto, and deposits into the contract. The transparency mechanic applies to everything after that conversion. Researching a fiat on-ramp integration (e.g., local fintech APIs) is on the roadmap, but it introduces KYC and regulatory complexity that is out of scope for the current phase.

---

**Q: What is on your roadmap beyond the current implementation?**

- A report system post hackathon for flagging suspicious activities, anything sus. 
- Regarding vendor validation pending issue, a separate, validator notification system could be implemented but should not be part of ClarityChain to prevent scope creep.
- Regarding individual volunteers, an honest scope decision and frame it such a way that it is forward-looking by acknowledging that willing users are a valid use case and an individual can go through the entire verification and function as a vendor and would be a feature implemented post hackathon.

---

🔗🌸 *Built for Cebu. Built for trust. Built on Polkadot.* 🌷🔗