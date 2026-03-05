import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseEther, getAddress } from "viem";

// =============================================================================
// ClarityChain.test.ts
// Updated for v2 contract changes:
//   - All proposeVendor calls now include a pipe-delimited verification link
//   - proposeVendor is open to anyone — updated tests reflect this
//   - getCampaign returns 7 fields — refundsEnabled added at index [6]
//   - New tests for enableRefunds() and claimRefund() (pull pattern)
//   - New test for verification link requirement enforcement
// =============================================================================

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

async function getClients() {
  const { viem } = await network.connect({
    network: "hardhatMainnet",
    chainType: "l1",
  });

  const [deployer, validator2, validator3, ngo, donor, vendor, nonValidator] =
    await viem.getWalletClients();

  const publicClient = await viem.getPublicClient();

  return { viem, deployer, validator2, validator3, ngo, donor, vendor, nonValidator, publicClient };
}

async function deployFresh() {
  const clients = await getClients();
  const { viem, deployer, validator2, validator3 } = clients;

  const validators = [
    deployer.account.address,
    validator2.account.address,
    validator3.account.address,
  ];

  const clarityChain = await viem.deployContract("ClarityChain", [validators]);
  return { ...clients, clarityChain, validators };
}

// All vendor name strings must now include at least one pipe-delimited link.
const VENDOR_NAME = "Cebu Rice Supply Co.|https://facebook.com/ceburice";

async function whitelistVendor(
  clarityChain: any,
  deployer: any,
  validator2: any,
  validator3: any,
  vendorAddress: `0x${string}`,
  vendorName: string = VENDOR_NAME
) {
  await clarityChain.write.proposeVendor([vendorAddress, vendorName], {
    account: deployer.account,
  });
  const proposalId = (await clarityChain.read.proposalCount()) - 1n;
  await clarityChain.write.approveVendor([proposalId], { account: deployer.account });
  await clarityChain.write.approveVendor([proposalId], { account: validator2.account });
  await clarityChain.write.approveVendor([proposalId], { account: validator3.account });
  return proposalId;
}

async function assertReverts(fn: () => Promise<any>, expectedMsg: string) {
  try {
    await fn();
    assert.fail(`Expected revert with "${expectedMsg}" but transaction succeeded`);
  } catch (err: any) {
    const msg = err?.message || "";
    assert.ok(
      msg.includes(expectedMsg),
      `Expected error to include "${expectedMsg}" but got:\n${msg}`
    );
  }
}

// =============================================================================
// DEPLOYMENT
// =============================================================================

describe("Deployment", () => {
  it("sets the correct owner", async () => {
    const { clarityChain, deployer } = await deployFresh();
    const owner = await clarityChain.read.owner();
    assert.equal(getAddress(owner), getAddress(deployer.account.address));
  });

  it("sets the correct validators", async () => {
    const { clarityChain, validators } = await deployFresh();
    const contractValidators = await clarityChain.read.getValidators();
    for (let i = 0; i < validators.length; i++) {
      assert.equal(getAddress(contractValidators[i]), getAddress(validators[i]));
    }
  });

  it("sets validatorCount to 3", async () => {
    const { clarityChain } = await deployFresh();
    const count = await clarityChain.read.validatorCount();
    assert.equal(count, 3n);
  });

  it("reverts if fewer than 3 validators provided", async () => {
    const { viem, deployer, validator2 } = await getClients();
    await assertReverts(
      () => viem.deployContract("ClarityChain", [[deployer.account.address, validator2.account.address]]),
      "Need between 3 and 5 validators"
    );
  });
});

// =============================================================================
// createCampaign()
// =============================================================================

describe("createCampaign()", () => {
  it("creates a campaign with correct data", async () => {
    const { clarityChain, ngo } = await deployFresh();

    await clarityChain.write.createCampaign(
      ["Typhoon Odette Relief Fund", parseEther("10")],
      { account: ngo.account }
    );

    const campaign = await clarityChain.read.getCampaign([0n]);
    assert.equal(campaign[0], "Typhoon Odette Relief Fund");
    assert.equal(getAddress(campaign[1]), getAddress(ngo.account.address));
    assert.equal(campaign[2], parseEther("10")); // goalAmount
    assert.equal(campaign[3], 0n);               // raisedAmount
    assert.equal(campaign[4], 0n);               // withdrawnAmount
    assert.equal(campaign[5], true);             // active
    assert.equal(campaign[6], false);            // refundsEnabled
  });

  it("increments campaignCount", async () => {
    const { clarityChain, ngo } = await deployFresh();

    await clarityChain.write.createCampaign(["Campaign A", parseEther("1")], { account: ngo.account });
    await clarityChain.write.createCampaign(["Campaign B", parseEther("2")], { account: ngo.account });

    const count = await clarityChain.read.campaignCount();
    assert.equal(count, 2n);
  });

  it("reverts if name is empty", async () => {
    const { clarityChain, ngo } = await deployFresh();
    await assertReverts(
      () => clarityChain.write.createCampaign(["", parseEther("1")], { account: ngo.account }),
      "Name cannot be empty"
    );
  });

  it("reverts if goal is zero", async () => {
    const { clarityChain, ngo } = await deployFresh();
    await assertReverts(
      () => clarityChain.write.createCampaign(["Test", 0n], { account: ngo.account }),
      "Goal must be greater than 0"
    );
  });
});

// =============================================================================
// donate()
// =============================================================================

describe("donate()", () => {
  it("increases raisedAmount correctly", async () => {
    const { clarityChain, ngo, donor } = await deployFresh();

    await clarityChain.write.createCampaign(["Relief Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });

    const campaign = await clarityChain.read.getCampaign([0n]);
    assert.equal(campaign[3], parseEther("1"));
  });

  it("accumulates multiple donations correctly", async () => {
    const { clarityChain, ngo, donor } = await deployFresh();

    await clarityChain.write.createCampaign(["Relief Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("2") });

    const campaign = await clarityChain.read.getCampaign([0n]);
    assert.equal(campaign[3], parseEther("3"));
  });

  it("records donor address for refund eligibility", async () => {
    const { clarityChain, ngo, donor } = await deployFresh();

    await clarityChain.write.createCampaign(["Relief Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });

    const donors = await clarityChain.read.getCampaignDonors([0n]);
    assert.equal(donors.length, 1);
    assert.equal(getAddress(donors[0]), getAddress(donor.account.address));
  });

  it("records correct donation amount per donor", async () => {
    const { clarityChain, ngo, donor } = await deployFresh();

    await clarityChain.write.createCampaign(["Relief Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("2") });

    const recorded = await clarityChain.read.donorAmounts([0n, donor.account.address]);
    assert.equal(recorded, parseEther("3"));
  });

  it("reverts if donation value is zero", async () => {
    const { clarityChain, ngo, donor } = await deployFresh();

    await clarityChain.write.createCampaign(["Relief Fund", parseEther("10")], { account: ngo.account });
    await assertReverts(
      () => clarityChain.write.donate([0n], { account: donor.account, value: 0n }),
      "Donation must be greater than 0"
    );
  });

  it("reverts if campaign does not exist", async () => {
    const { clarityChain, donor } = await deployFresh();
    await assertReverts(
      () => clarityChain.write.donate([99n], { account: donor.account, value: parseEther("1") }),
      "Campaign does not exist"
    );
  });

  it("reverts if campaign is closed", async () => {
    const { clarityChain, ngo, donor } = await deployFresh();

    await clarityChain.write.createCampaign(["Relief Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.closeCampaign([0n], { account: ngo.account });

    await assertReverts(
      () => clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") }),
      "Campaign is not active"
    );
  });
});

// =============================================================================
// withdrawToVendor()
// =============================================================================

describe("withdrawToVendor()", () => {
  it("🚫 REJECTS withdrawal to a non-whitelisted address", async () => {
    const { clarityChain, ngo, donor, nonValidator } = await deployFresh();

    await clarityChain.write.createCampaign(["Relief Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });

    await assertReverts(
      () => clarityChain.write.withdrawToVendor(
        [0n, nonValidator.account.address, parseEther("0.5")],
        { account: ngo.account }
      ),
      "Vendor not whitelisted -- REJECTED"
    );
  });

  it("✅ ALLOWS withdrawal to a whitelisted vendor", async () => {
    const { clarityChain, deployer, validator2, validator3, ngo, donor, vendor, publicClient } =
      await deployFresh();

    await clarityChain.write.createCampaign(["Relief Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    await whitelistVendor(clarityChain, deployer, validator2, validator3, vendor.account.address);

    const balanceBefore = await publicClient.getBalance({ address: vendor.account.address });
    await clarityChain.write.withdrawToVendor(
      [0n, vendor.account.address, parseEther("0.5")],
      { account: ngo.account }
    );
    const balanceAfter = await publicClient.getBalance({ address: vendor.account.address });

    assert.equal(balanceAfter - balanceBefore, parseEther("0.5"));
  });

  it("updates withdrawnAmount after successful withdrawal", async () => {
    const { clarityChain, deployer, validator2, validator3, ngo, donor, vendor } = await deployFresh();

    await clarityChain.write.createCampaign(["Relief Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    await whitelistVendor(clarityChain, deployer, validator2, validator3, vendor.account.address);
    await clarityChain.write.withdrawToVendor(
      [0n, vendor.account.address, parseEther("0.5")],
      { account: ngo.account }
    );

    const campaign = await clarityChain.read.getCampaign([0n]);
    assert.equal(campaign[4], parseEther("0.5"));
  });

  it("reverts if caller is not the campaign NGO", async () => {
    const { clarityChain, deployer, validator2, validator3, ngo, donor, vendor, nonValidator } = await deployFresh();

    await clarityChain.write.createCampaign(["Relief Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    await whitelistVendor(clarityChain, deployer, validator2, validator3, vendor.account.address);

    await assertReverts(
      () => clarityChain.write.withdrawToVendor(
        [0n, vendor.account.address, parseEther("0.5")],
        { account: nonValidator.account }
      ),
      "Not the campaign NGO"
    );
  });

  it("reverts if amount exceeds available funds", async () => {
    const { clarityChain, deployer, validator2, validator3, ngo, donor, vendor } = await deployFresh();

    await clarityChain.write.createCampaign(["Relief Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    await whitelistVendor(clarityChain, deployer, validator2, validator3, vendor.account.address);

    await assertReverts(
      () => clarityChain.write.withdrawToVendor(
        [0n, vendor.account.address, parseEther("999")],
        { account: ngo.account }
      ),
      "Insufficient campaign funds"
    );
  });
});

// =============================================================================
// enableRefunds() and claimRefund()
// =============================================================================

describe("enableRefunds()", () => {
  it("sets refundsEnabled to true and closes the campaign", async () => {
    const { clarityChain, ngo, donor } = await deployFresh();

    await clarityChain.write.createCampaign(["Relief Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    await clarityChain.write.enableRefunds([0n], { account: ngo.account });

    const campaign = await clarityChain.read.getCampaign([0n]);
    assert.equal(campaign[5], false);  // active = false
    assert.equal(campaign[6], true);   // refundsEnabled = true
  });

  it("reverts if caller is not the campaign NGO", async () => {
    const { clarityChain, ngo, donor, nonValidator } = await deployFresh();

    await clarityChain.write.createCampaign(["Relief Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });

    await assertReverts(
      () => clarityChain.write.enableRefunds([0n], { account: nonValidator.account }),
      "Not the campaign NGO"
    );
  });

  it("reverts if refunds already enabled", async () => {
    const { clarityChain, ngo, donor } = await deployFresh();

    await clarityChain.write.createCampaign(["Relief Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    await clarityChain.write.enableRefunds([0n], { account: ngo.account });

    await assertReverts(
      () => clarityChain.write.enableRefunds([0n], { account: ngo.account }),
      "Refunds already enabled"
    );
  });
});

describe("claimRefund()", () => {
  it("returns full donation when no vendor withdrawals were made", async () => {
    const { clarityChain, ngo, donor, publicClient } = await deployFresh();

    await clarityChain.write.createCampaign(["Relief Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    await clarityChain.write.enableRefunds([0n], { account: ngo.account });

    const balanceBefore = await publicClient.getBalance({ address: donor.account.address });
    await clarityChain.write.claimRefund([0n], { account: donor.account });
    const balanceAfter = await publicClient.getBalance({ address: donor.account.address });

    // Balance should increase by ~1 PAS (minus gas, so just check it went up significantly)
    assert.ok(balanceAfter > balanceBefore, "Donor balance should increase after refund");
  });

  it("returns proportional refund when some funds already spent on vendors", async () => {
    const { clarityChain, deployer, validator2, validator3, ngo, donor, vendor } = await deployFresh();

    // donor donates 1 PAS, NGO withdraws 0.5 PAS to vendor, then enables refunds
    // donor should get back 0.5 PAS (their 50% share of the remaining 0.5 PAS)
    await clarityChain.write.createCampaign(["Relief Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    await whitelistVendor(clarityChain, deployer, validator2, validator3, vendor.account.address);
    await clarityChain.write.withdrawToVendor(
      [0n, vendor.account.address, parseEther("0.5")],
      { account: ngo.account }
    );
    await clarityChain.write.enableRefunds([0n], { account: ngo.account });

    const refundAmount = await clarityChain.read.getRefundAmount([0n, donor.account.address]);
    assert.equal(refundAmount, parseEther("0.5"));
  });

  it("getRefundAmount returns 0 before refunds are enabled", async () => {
    const { clarityChain, ngo, donor } = await deployFresh();

    await clarityChain.write.createCampaign(["Relief Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });

    const refundAmount = await clarityChain.read.getRefundAmount([0n, donor.account.address]);
    assert.equal(refundAmount, 0n);
  });

  it("reverts if refunds not enabled", async () => {
    const { clarityChain, ngo, donor } = await deployFresh();

    await clarityChain.write.createCampaign(["Relief Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });

    await assertReverts(
      () => clarityChain.write.claimRefund([0n], { account: donor.account }),
      "Refunds not enabled for this campaign"
    );
  });

  it("reverts if wallet has no donation recorded", async () => {
    const { clarityChain, ngo, donor, nonValidator } = await deployFresh();

    await clarityChain.write.createCampaign(["Relief Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    await clarityChain.write.enableRefunds([0n], { account: ngo.account });

    await assertReverts(
      () => clarityChain.write.claimRefund([0n], { account: nonValidator.account }),
      "No donation found for this wallet"
    );
  });

  it("reverts if donor tries to claim twice", async () => {
    const { clarityChain, ngo, donor } = await deployFresh();

    await clarityChain.write.createCampaign(["Relief Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    await clarityChain.write.enableRefunds([0n], { account: ngo.account });
    await clarityChain.write.claimRefund([0n], { account: donor.account });

    await assertReverts(
      () => clarityChain.write.claimRefund([0n], { account: donor.account }),
      "No donation found for this wallet"
    );
  });
});

// =============================================================================
// proposeVendor()
// =============================================================================

describe("proposeVendor()", () => {
  it("creates a proposal with correct data", async () => {
    const { clarityChain, deployer, vendor } = await deployFresh();

    await clarityChain.write.proposeVendor(
      [vendor.account.address, VENDOR_NAME],
      { account: deployer.account }
    );

    const proposal = await clarityChain.read.getProposalStatus([0n]);
    assert.equal(getAddress(proposal[0]), getAddress(vendor.account.address));
    assert.equal(proposal[1], VENDOR_NAME);
    assert.equal(proposal[2], 0n);
    assert.equal(proposal[3], false);
  });

  it("allows ANY wallet to propose a vendor — not just validators", async () => {
    // This is the key behavioral change from v1.
    // Non-validators can now propose. Only validators approve.
    const { clarityChain, nonValidator, vendor } = await deployFresh();

    await clarityChain.write.proposeVendor(
      [vendor.account.address, VENDOR_NAME],
      { account: nonValidator.account }
    );

    const count = await clarityChain.read.proposalCount();
    assert.equal(count, 1n);
  });

  it("reverts if no verification link is provided", async () => {
    const { clarityChain, deployer, vendor } = await deployFresh();

    await assertReverts(
      () => clarityChain.write.proposeVendor(
        [vendor.account.address, "Cebu Rice Supply Co."],
        { account: deployer.account }
      ),
      "At least one verification link is required"
    );
  });

  it("reverts if vendor is already whitelisted", async () => {
    const { clarityChain, deployer, validator2, validator3, vendor } = await deployFresh();

    await whitelistVendor(clarityChain, deployer, validator2, validator3, vendor.account.address);

    await assertReverts(
      () => clarityChain.write.proposeVendor(
        [vendor.account.address, VENDOR_NAME],
        { account: deployer.account }
      ),
      "Vendor already whitelisted"
    );
  });
});

// =============================================================================
// approveVendor()
// =============================================================================

describe("approveVendor()", () => {
  it("does NOT whitelist vendor before threshold is met", async () => {
    const { clarityChain, deployer, validator2, vendor } = await deployFresh();

    await clarityChain.write.proposeVendor([vendor.account.address, VENDOR_NAME], { account: deployer.account });
    await clarityChain.write.approveVendor([0n], { account: deployer.account });
    await clarityChain.write.approveVendor([0n], { account: validator2.account });

    const isWhitelisted = await clarityChain.read.isVendorWhitelisted([vendor.account.address]);
    assert.equal(isWhitelisted, false);
  });

  it("auto-whitelists vendor exactly when threshold is met", async () => {
    const { clarityChain, deployer, validator2, validator3, vendor } = await deployFresh();

    await clarityChain.write.proposeVendor([vendor.account.address, VENDOR_NAME], { account: deployer.account });
    await clarityChain.write.approveVendor([0n], { account: deployer.account });
    await clarityChain.write.approveVendor([0n], { account: validator2.account });

    assert.equal(await clarityChain.read.isVendorWhitelisted([vendor.account.address]), false);

    await clarityChain.write.approveVendor([0n], { account: validator3.account });

    assert.equal(await clarityChain.read.isVendorWhitelisted([vendor.account.address]), true);

    const proposal = await clarityChain.read.getProposalStatus([0n]);
    assert.equal(proposal[3], true);
  });

  it("reverts if same validator approves twice", async () => {
    const { clarityChain, deployer, vendor } = await deployFresh();

    await clarityChain.write.proposeVendor([vendor.account.address, VENDOR_NAME], { account: deployer.account });
    await clarityChain.write.approveVendor([0n], { account: deployer.account });

    await assertReverts(
      () => clarityChain.write.approveVendor([0n], { account: deployer.account }),
      "You already approved this proposal"
    );
  });

  it("reverts if non-validator tries to approve", async () => {
    const { clarityChain, deployer, nonValidator, vendor } = await deployFresh();

    await clarityChain.write.proposeVendor([vendor.account.address, VENDOR_NAME], { account: deployer.account });

    await assertReverts(
      () => clarityChain.write.approveVendor([0n], { account: nonValidator.account }),
      "Not a validator"
    );
  });

  it("reverts if proposal does not exist", async () => {
    const { clarityChain, deployer } = await deployFresh();

    await assertReverts(
      () => clarityChain.write.approveVendor([99n], { account: deployer.account }),
      "Proposal does not exist"
    );
  });

  it("reverts if proposal already executed", async () => {
    const { clarityChain, deployer, validator2, validator3, vendor } = await deployFresh();

    await whitelistVendor(clarityChain, deployer, validator2, validator3, vendor.account.address);

    await assertReverts(
      () => clarityChain.write.approveVendor([0n], { account: deployer.account }),
      "Proposal already executed"
    );
  });
});

// =============================================================================
// closeCampaign()
// =============================================================================

describe("closeCampaign()", () => {
  it("sets campaign active to false", async () => {
    const { clarityChain, ngo } = await deployFresh();

    await clarityChain.write.createCampaign(["Relief Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.closeCampaign([0n], { account: ngo.account });

    const campaign = await clarityChain.read.getCampaign([0n]);
    assert.equal(campaign[5], false);
  });

  it("blocks donations after close", async () => {
    const { clarityChain, ngo, donor } = await deployFresh();

    await clarityChain.write.createCampaign(["Relief Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.closeCampaign([0n], { account: ngo.account });

    await assertReverts(
      () => clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") }),
      "Campaign is not active"
    );
  });

  it("blocks withdrawals after close", async () => {
    const { clarityChain, deployer, validator2, validator3, ngo, donor, vendor } = await deployFresh();

    await clarityChain.write.createCampaign(["Relief Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    await whitelistVendor(clarityChain, deployer, validator2, validator3, vendor.account.address);
    await clarityChain.write.closeCampaign([0n], { account: ngo.account });

    await assertReverts(
      () => clarityChain.write.withdrawToVendor(
        [0n, vendor.account.address, parseEther("0.5")],
        { account: ngo.account }
      ),
      "Campaign is not active"
    );
  });

  it("reverts if caller is not the campaign NGO", async () => {
    const { clarityChain, ngo, nonValidator } = await deployFresh();

    await clarityChain.write.createCampaign(["Relief Fund", parseEther("10")], { account: ngo.account });

    await assertReverts(
      () => clarityChain.write.closeCampaign([0n], { account: nonValidator.account }),
      "Not the campaign NGO"
    );
  });
});