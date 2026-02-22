# ClarityChain 🔍
### The Anti-Corruption Donation Tracker
**Polkadot Solidity Hackathon 2026 — Cebu Edition**

---

## The Pitch

> *"In the Philippines, we don't have a donation problem. We have a trust problem. ClarityChain doesn't ask you to trust anyone — it makes trust mathematically unnecessary."*

---

## The Problem

When typhoons hit (like Odette), people donate money, but they don't know where it goes. Corruption or "admin fees" eat up the funds. Trust issues in Philippine government and charities are high, and donors have no way to verify that their money actually bought rice and not new cars.

---

## The Solution

A transparent, constrained donation platform where spending is architecturally limited by the smart contract itself — not by the NGO's goodwill.

1. An NGO or LGU creates a **Campaign** wallet on the platform.
2. Donors send **USDC/DOT** to the smart contract.
3. The contract allows the NGO to **only withdraw funds to Whitelisted Vendors** (e.g., a Grocery Store or Construction Supplier registered on the app). They cannot cash out to their personal wallets.
4. The public sees **every transaction** on the React Dashboard in real time.

---

## Why It Works

- **Relevance:** Trust issues in PH government and charities are high. The Odette reference alone makes any Filipino judge feel it immediately.
- **Code Difficulty:** Medium. Core mechanics are a whitelist mapping (list of allowed addresses) and a `withdrawToVendor()` function.
- **The Blockchain Pitch:** *"Don't just trust; verify. We ensure donations buy rice, not new cars."*
- **Key Differentiator from Giveth/The Giving Block:** Giveth shows you where money goes after the fact — it's a transparency layer on top of existing flows. ClarityChain is architecturally different. The constraint is baked into the contract itself. An NGO on Giveth can still withdraw to their personal wallet and post a receipt later. On ClarityChain, that transaction is **technically impossible**. The contract only has one exit: a whitelisted vendor address.

---

## Category

**Category 1: DeFi / Stablecoin-enabled dApps**

USDC is central to the donation and withdrawal flow. The constrained spending mechanic is the core DeFi innovation.

> **Stretch Opportunity:** Adding an AI layer (e.g., flagging suspicious withdrawal patterns) would make ClarityChain a dual-category contender for Category 2 (AI-powered dApps) as well.

---

## Technical Architecture

### Core Smart Contract Functions

- `deposit()` — Donors send USDC/DOT to a campaign contract
- `withdrawToVendor(address vendor, uint256 amount)` — NGO withdraws only to a whitelisted vendor address; all other addresses are rejected
- Whitelist mapping — A `mapping(address => bool)` of approved vendor addresses
- 3-of-5 Multi-Sig for vendor approval (see Vendor Governance below)

### React Dashboard

- Public view of every on-chain transaction per campaign
- Campaign creation form (for NGOs)
- Vendor registration and pending approval queue
- Community flag system for raising disputes on vendors

---

## Vendor Governance: The 3-of-5 Multi-Sig

### How It Works

Think of it like a group chat where 3 out of 5 admins need to react ✅ before something happens. In crypto terms, you have 5 designated wallet addresses, and any action (approving a vendor) only executes if at least 3 of those wallets sign off on it. No single person can approve a vendor alone.

Every approval is logged on-chain, publicly. If a shell company somehow gets whitelisted, there is a permanent, auditable trail of exactly who signed off.

### Who Gets to Be a Validator

| Slot | Role | Rationale |
|------|------|-----------|
| 1 | The NGO itself | They have skin in the game |
| 2 | A donor representative | Elected by top donors or a donor DAO |
| 3 | A barangay or LGU official | Adds government legitimacy |
| 4 | OpenGuild or a partner organization | Neutral third-party tech oversight |
| 5 | A community watchdog | Journalist, civic group like Bantay Kita, etc. |

**The key principle:** No single sector controls the majority. The NGO alone can't approve their own vendors. A corrupt official alone can't either. They need to conspire across at least 3 groups simultaneously, which is dramatically harder than bribing one admin.

> **For Demo Day:** Your 5 validators can literally be 5 MetaMask wallets on your team's laptops. The mechanism is what matters to judges, not the real-world identities behind it.

---

## Vendor Onboarding Flow

A vendor submits the following through a registration page on the React app:

- Business name
- Wallet address
- External verification link (DTI registration, Facebook business page, etc.)

This goes into a **"pending"** state on the dashboard. The 3-of-5 multi-sig validators then approve or reject it. The approval transaction is logged on-chain. Rejected vendors are also publicly visible.

You don't need a perfect KYC system for the hackathon — you need a credible one.

---

## NGO Onboarding & Wallet Abstraction

The realistic assumption is that the NGO has at least one person handling finances or IT — a treasurer, a comms officer, someone. That person gets a wallet, learns the basics, and handles the contract interactions on behalf of the organization.

What the UI abstracts is the scary parts. Nobody should have to paste a contract ABI into Remix. The React dashboard handles all of that under the hood.

**The NGO "tech person" experience looks like this:**

1. Connect MetaMask
2. Fill out a form (Campaign name, goal amount, end date)
3. Click "Create Campaign"
4. Sign one MetaMask transaction

That's it. They never see Solidity. They never touch a block explorer. The wallet is the only crypto-native requirement, and one person per NGO having a wallet is a completely reasonable assumption.

---

## Why Polkadot?

- **EVM Compatibility:** Polkadot Hub supports Solidity natively, so no rewriting needed.
- **Lower Fees:** Transaction fees are significantly lower than Ethereum mainnet. In a disaster relief context, you don't want 20% of a ₱500 micro-donation eaten by gas fees.
- **Interoperability:** ClarityChain could eventually receive donations from multiple chains without bridging friction. We're building for scale from day one.

---

## Demo Day Plan

Show a **live transaction** with the following flow:

1. A donor wallet sends USDC to a campaign contract — visible on the dashboard.
2. The NGO wallet attempts a withdrawal to a **personal wallet** — the contract **rejects it**. Show this live.
3. The NGO wallet attempts a withdrawal to a **whitelisted vendor** — it goes through instantly.
4. The entire flow appears on the React dashboard in real time.

> The rejection moment is the whole pitch. Make judges see it happen live.

---

## Known Limitations & How to Address Them

### Shell Vendors (Fake Front Businesses)
A shell vendor is a business that exists on paper but does nothing real. Someone registers a legit-looking supplier, gets it whitelisted, receives vendor payments, and the money disappears. The physical goods never existed.

**Our honest answer:** ClarityChain cannot solve fraud at the business registration level — that's a legal problem, not a blockchain problem. What it does is make every peso traceable to a named, publicly visible vendor address, permanently. Any donor, journalist, or citizen can look up that vendor and question it. We also plan a community flag system where any wallet can raise a dispute on a vendor, triggering a multi-sig review. We're not replacing legal accountability — we're creating a public paper trail that makes it much harder to hide.

### On-Chain vs Off-Chain Trust
ClarityChain creates **accountability infrastructure**. The legal system handles punishment. These are complementary, not competing.

---

## Anticipated Judge Questions & Prepared Answers

**"Who controls the vendor whitelist, and what stops that person from being corrupt?"**

> "We don't give that power to a single admin. Vendor approval requires a 3-of-5 multi-sig from a predefined set of community validators — a representative from the NGO, a donor rep, a barangay official, a partner org, and a community watchdog. No single person can approve a vendor alone. And every approval is logged on-chain, publicly. So if a shell company somehow gets whitelisted, there's a permanent, auditable trail of exactly who signed off. We didn't eliminate human judgment — we just made it accountable."

---

**"How is this different from Giveth or The Giving Block?"**

> "Giveth shows you where money goes after the fact — it's a transparency layer on top of existing donation flows. ClarityChain is architecturally different. The constraint is baked into the contract itself. An NGO on Giveth can still withdraw to their personal wallet and post a receipt later. On ClarityChain, that transaction is technically impossible. The contract only has one exit: a whitelisted vendor address. We're not asking you to trust the NGO's reporting. We're making the NGO's choices structurally limited by code."

---

**"What if a whitelisted vendor is actually a shell company?"**

> "We're honest that we can't solve fraud entirely on-chain — no system can. But every vendor registration requires a business name and wallet address that's publicly visible on the dashboard. Any donor, journalist, or citizen can look up that vendor and question it. We also plan to integrate a community flag system where any wallet can raise a dispute on a vendor, which triggers a multi-sig review. We're not replacing legal accountability — we're creating a public paper trail that makes it much harder to hide."

---

**"Why Polkadot specifically? Couldn't this run on Ethereum cheaper?"**

> "Actually, Polkadot Hub's EVM compatibility is exactly why we chose it — we get Solidity support without rewriting everything. But more importantly, transaction fees on Polkadot are significantly lower than Ethereum mainnet. In a disaster relief context, you don't want 20% of a ₱500 micro-donation eaten by gas fees. And Polkadot's interoperability means ClarityChain could eventually receive donations from multiple chains without bridging friction. We're building for scale from day one."

---

**"Do you have a working demo?"**

> "Yes. We'll show a live transaction on Demo Day — a donor wallet sending USDC to a campaign contract, and then the NGO attempting two withdrawals: one to a personal wallet, which the contract rejects, and one to a whitelisted vendor, which goes through instantly. The entire flow runs on-chain, visible on our React dashboard in real time. We want judges to see the rejection happen live — that's our whole pitch in one moment."

---

## Timeline

| Phase | Dates |
|-------|-------|
| Registration & Kickoff | Feb 11 – Feb 28 |
| Hacking Period (Online) | Feb 11 – March 14 |
| Demo Day (Venue TBA) | March 15 |

---

## Event Details

- **Hackathon:** Polkadot Solidity Hackathon 2026: Cebu Edition
- **Powered by:** Polkadot and OpenGuild
- **Format:** Teams of 3 members
- **Fee:** No registration fees
- **Location:** Everything online, except Demo Day (TBA)

---

## Team

> *(Add your names here)*

---

*Built for Cebu. Built for trust. Built on Polkadot.* 🔗
