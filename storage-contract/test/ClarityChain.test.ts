import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseEther, getAddress } from "viem";

// =============================================================================
// ClarityChain.test.ts — v3
// New tests added:
//   - associateVendor()
//   - withdrawToVendor() updated — association + cap enforcement
//   - vendorRefundToCampaign()
//   - applyForVerification()
//   - approveIdentity()
// =============================================================================

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

const VENDOR_NAME = "Cebu Rice Supply Co.|https://facebook.com/ceburice";
const VENDOR_INSTRUCTIONS = "Purchase 500 sacks of rice and deliver to Barangay Ermita by March 20";
const PROFILE_LINKS = "Cebu Food Bank|https://dti.gov.ph/reg/12345|https://facebook.com/cebufoodbank";

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

// Whitelist + associate vendor with a campaign in one helper
async function whitelistAndAssociate(
  clarityChain: any,
  deployer: any,
  validator2: any,
  validator3: any,
  ngo: any,
  campaignId: bigint,
  vendorAddress: `0x${string}`,
  cap = parseEther("1"),
  instructions = VENDOR_INSTRUCTIONS
) {
  await whitelistVendor(clarityChain, deployer, validator2, validator3, vendorAddress);
  await clarityChain.write.associateVendor(
    [campaignId, vendorAddress, cap, instructions],
    { account: ngo.account }
  );
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
    assert.equal(await clarityChain.read.validatorCount(), 3n);
  });

  it("reverts if fewer than 3 validators provided", async () => {
    const { viem, deployer, validator2 } = await getClients();
    await assertReverts(
      () => viem.deployContract("ClarityChain", [[deployer.account.address, validator2.account.address]]),
      "NeedBetweenThreeAndFiveValidators"
    );
  });
});

// =============================================================================
// createCampaign()
// =============================================================================

describe("createCampaign()", () => {
  it("creates a campaign with correct data", async () => {
    const { clarityChain, ngo } = await deployFresh();
    await clarityChain.write.createCampaign(["Typhoon Relief Fund", parseEther("10")], { account: ngo.account });
    const c = await clarityChain.read.getCampaign([0n]);
    assert.equal(c[0], "Typhoon Relief Fund");
    assert.equal(getAddress(c[1]), getAddress(ngo.account.address));
    assert.equal(c[2], parseEther("10"));
    assert.equal(c[3], 0n);
    assert.equal(c[4], 0n);
    assert.equal(c[5], true);
    assert.equal(c[6], false);
  });

  it("increments campaignCount", async () => {
    const { clarityChain, ngo } = await deployFresh();
    await clarityChain.write.createCampaign(["A", parseEther("1")], { account: ngo.account });
    await clarityChain.write.createCampaign(["B", parseEther("1")], { account: ngo.account });
    assert.equal(await clarityChain.read.campaignCount(), 2n);
  });

  it("reverts if name is empty", async () => {
    const { clarityChain, ngo } = await deployFresh();
    await assertReverts(
      () => clarityChain.write.createCampaign(["", parseEther("1")], { account: ngo.account }),
      "NameCannotBeEmpty"
    );
  });

  it("reverts if goal is zero", async () => {
    const { clarityChain, ngo } = await deployFresh();
    await assertReverts(
      () => clarityChain.write.createCampaign(["Test", 0n], { account: ngo.account }),
      "GoalMustBeGreaterThanZero"
    );
  });
});

// =============================================================================
// donate()
// =============================================================================

describe("donate()", () => {
  it("increases raisedAmount and records donor", async () => {
    const { clarityChain, ngo, donor } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    const c = await clarityChain.read.getCampaign([0n]);
    assert.equal(c[3], parseEther("1"));
    const donors = await clarityChain.read.getCampaignDonors([0n]);
    assert.equal(donors.length, 1);
    assert.equal(getAddress(donors[0]), getAddress(donor.account.address));
  });

  it("accumulates multiple donations", async () => {
    const { clarityChain, ngo, donor } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("2") });
    const c = await clarityChain.read.getCampaign([0n]);
    assert.equal(c[3], parseEther("3"));
  });

  it("reverts if donation value is zero", async () => {
    const { clarityChain, ngo, donor } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await assertReverts(
      () => clarityChain.write.donate([0n], { account: donor.account, value: 0n }),
      "DonationMustBeGreaterThanZero"
    );
  });

  it("reverts if campaign does not exist", async () => {
    const { clarityChain, donor } = await deployFresh();
    await assertReverts(
      () => clarityChain.write.donate([99n], { account: donor.account, value: parseEther("1") }),
      "CampaignDoesNotExist"
    );
  });

  it("reverts if campaign is closed", async () => {
    const { clarityChain, ngo, donor } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.closeCampaign([0n], { account: ngo.account });
    await assertReverts(
      () => clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") }),
      "CampaignNotActive"
    );
  });
});

// =============================================================================
// associateVendor()
// =============================================================================

describe("associateVendor()", () => {
  it("associates a whitelisted vendor with correct data", async () => {
    const { clarityChain, deployer, validator2, validator3, ngo, vendor } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await whitelistAndAssociate(clarityChain, deployer, validator2, validator3, ngo, 0n, vendor.account.address);

    const cv = await clarityChain.read.getCampaignVendor([0n, vendor.account.address]);
    assert.equal(cv[0], parseEther("1"));        // cap
    assert.equal(cv[1], 0n);                     // spent
    assert.equal(cv[2], VENDOR_INSTRUCTIONS);    // instructions
    assert.equal(cv[3], true);                   // associated
  });

  it("adds vendor to campaign vendor list", async () => {
    const { clarityChain, deployer, validator2, validator3, ngo, vendor } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await whitelistAndAssociate(clarityChain, deployer, validator2, validator3, ngo, 0n, vendor.account.address);

    const list = await clarityChain.read.getCampaignVendorList([0n]);
    assert.equal(list.length, 1);
    assert.equal(getAddress(list[0]), getAddress(vendor.account.address));
  });

  it("reverts if vendor is not whitelisted", async () => {
    const { clarityChain, ngo, vendor } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await assertReverts(
      () => clarityChain.write.associateVendor(
        [0n, vendor.account.address, parseEther("1"), VENDOR_INSTRUCTIONS],
        { account: ngo.account }
      ),
      "VendorNotWhitelisted"
    );
  });

  it("reverts if vendor already associated with this campaign", async () => {
    const { clarityChain, deployer, validator2, validator3, ngo, vendor } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await whitelistAndAssociate(clarityChain, deployer, validator2, validator3, ngo, 0n, vendor.account.address);
    await assertReverts(
      () => clarityChain.write.associateVendor(
        [0n, vendor.account.address, parseEther("1"), VENDOR_INSTRUCTIONS],
        { account: ngo.account }
      ),
      "VendorAlreadyAssociated"
    );
  });

  it("reverts if cap is zero", async () => {
    const { clarityChain, deployer, validator2, validator3, ngo, vendor } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await whitelistVendor(clarityChain, deployer, validator2, validator3, vendor.account.address);
    await assertReverts(
      () => clarityChain.write.associateVendor(
        [0n, vendor.account.address, 0n, VENDOR_INSTRUCTIONS],
        { account: ngo.account }
      ),
      "CapMustBeGreaterThanZero"
    );
  });

  it("reverts if instructions are empty", async () => {
    const { clarityChain, deployer, validator2, validator3, ngo, vendor } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await whitelistVendor(clarityChain, deployer, validator2, validator3, vendor.account.address);
    await assertReverts(
      () => clarityChain.write.associateVendor(
        [0n, vendor.account.address, parseEther("1"), ""],
        { account: ngo.account }
      ),
      "InstructionsCannotBeEmpty"
    );
  });

  it("reverts if caller is not the campaign NGO", async () => {
    const { clarityChain, deployer, validator2, validator3, ngo, vendor, nonValidator } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await whitelistVendor(clarityChain, deployer, validator2, validator3, vendor.account.address);
    await assertReverts(
      () => clarityChain.write.associateVendor(
        [0n, vendor.account.address, parseEther("1"), VENDOR_INSTRUCTIONS],
        { account: nonValidator.account }
      ),
      "NotCampaignNGO"
    );
  });
});

// =============================================================================
// withdrawToVendor()
// =============================================================================

describe("withdrawToVendor()", () => {
  it("🚫 REJECTS withdrawal to a non-whitelisted address", async () => {
    const { clarityChain, ngo, donor, nonValidator } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    await assertReverts(
      () => clarityChain.write.withdrawToVendor(
        [0n, nonValidator.account.address, parseEther("0.5")],
        { account: ngo.account }
      ),
      "VendorNotWhitelistedRejected"
    );
  });

  it("🚫 REJECTS withdrawal to whitelisted but non-associated vendor", async () => {
    const { clarityChain, deployer, validator2, validator3, ngo, donor, vendor } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    // Whitelist but do NOT associate
    await whitelistVendor(clarityChain, deployer, validator2, validator3, vendor.account.address);
    await assertReverts(
      () => clarityChain.write.withdrawToVendor(
        [0n, vendor.account.address, parseEther("0.5")],
        { account: ngo.account }
      ),
      "VendorNotAssociatedWithCampaign"
    );
  });

  it("🚫 REJECTS withdrawal that exceeds vendor cap", async () => {
    const { clarityChain, deployer, validator2, validator3, ngo, donor, vendor } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("5") });
    // Cap is 1 PAS, try to withdraw 2 PAS
    await whitelistAndAssociate(
      clarityChain, deployer, validator2, validator3, ngo, 0n,
      vendor.account.address, parseEther("1")
    );
    await assertReverts(
      () => clarityChain.write.withdrawToVendor(
        [0n, vendor.account.address, parseEther("2")],
        { account: ngo.account }
      ),
      "AmountExceedsVendorCap"
    );
  });

  it("✅ ALLOWS withdrawal to associated vendor within cap", async () => {
    const { clarityChain, deployer, validator2, validator3, ngo, donor, vendor, publicClient } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    await whitelistAndAssociate(clarityChain, deployer, validator2, validator3, ngo, 0n, vendor.account.address);

    const balanceBefore = await publicClient.getBalance({ address: vendor.account.address });
    await clarityChain.write.withdrawToVendor(
      [0n, vendor.account.address, parseEther("0.5")],
      { account: ngo.account }
    );
    const balanceAfter = await publicClient.getBalance({ address: vendor.account.address });
    assert.equal(balanceAfter - balanceBefore, parseEther("0.5"));
  });

  it("tracks vendor spent amount correctly", async () => {
    const { clarityChain, deployer, validator2, validator3, ngo, donor, vendor } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    await whitelistAndAssociate(clarityChain, deployer, validator2, validator3, ngo, 0n, vendor.account.address);
    await clarityChain.write.withdrawToVendor(
      [0n, vendor.account.address, parseEther("0.5")],
      { account: ngo.account }
    );
    const cv = await clarityChain.read.getCampaignVendor([0n, vendor.account.address]);
    assert.equal(cv[1], parseEther("0.5")); // spent
  });

  it("reverts if caller is not the campaign NGO", async () => {
    const { clarityChain, deployer, validator2, validator3, ngo, donor, vendor, nonValidator } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    await whitelistAndAssociate(clarityChain, deployer, validator2, validator3, ngo, 0n, vendor.account.address);
    await assertReverts(
      () => clarityChain.write.withdrawToVendor(
        [0n, vendor.account.address, parseEther("0.5")],
        { account: nonValidator.account }
      ),
      "NotCampaignNGO"
    );
  });

  it("reverts if amount exceeds available campaign funds", async () => {
    const { clarityChain, deployer, validator2, validator3, ngo, donor, vendor } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("0.1") });
    await whitelistAndAssociate(
      clarityChain, deployer, validator2, validator3, ngo, 0n,
      vendor.account.address, parseEther("10") // high cap, but campaign only has 0.1
    );
    await assertReverts(
      () => clarityChain.write.withdrawToVendor(
        [0n, vendor.account.address, parseEther("5")],
        { account: ngo.account }
      ),
      "InsufficientCampaignFunds"
    );
  });
});

// =============================================================================
// vendorRefundToCampaign()
// =============================================================================

describe("vendorRefundToCampaign()", () => {
  it("reduces vendor spent and campaign withdrawnAmount", async () => {
    const { clarityChain, deployer, validator2, validator3, ngo, donor, vendor } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    await whitelistAndAssociate(clarityChain, deployer, validator2, validator3, ngo, 0n, vendor.account.address);
    await clarityChain.write.withdrawToVendor(
      [0n, vendor.account.address, parseEther("0.5")],
      { account: ngo.account }
    );

    // Vendor refunds 0.3 PAS back
    await clarityChain.write.vendorRefundToCampaign([0n], {
      account: vendor.account,
      value: parseEther("0.3"),
    });

    const cv = await clarityChain.read.getCampaignVendor([0n, vendor.account.address]);
    assert.equal(cv[1], parseEther("0.2")); // spent reduced from 0.5 to 0.2

    const c = await clarityChain.read.getCampaign([0n]);
    assert.equal(c[4], parseEther("0.2")); // withdrawnAmount reduced
  });

  it("makes refunded funds available for re-withdrawal", async () => {
    const { clarityChain, deployer, validator2, validator3, ngo, donor, vendor } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    await whitelistAndAssociate(clarityChain, deployer, validator2, validator3, ngo, 0n, vendor.account.address);
    await clarityChain.write.withdrawToVendor(
      [0n, vendor.account.address, parseEther("1")],
      { account: ngo.account }
    );

    // Vendor refunds full amount
    await clarityChain.write.vendorRefundToCampaign([0n], {
      account: vendor.account,
      value: parseEther("1"),
    });

    // Available funds should be back to 1 PAS
    const available = await clarityChain.read.getAvailableFunds([0n]);
    assert.equal(available, parseEther("1"));
  });

  it("reverts if caller is not an associated vendor", async () => {
    const { clarityChain, ngo, nonValidator } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await assertReverts(
      () => clarityChain.write.vendorRefundToCampaign([0n], {
        account: nonValidator.account,
        value: parseEther("0.5"),
      }),
      "CallerNotAssociatedVendor"
    );
  });

  it("reverts if refund amount is zero", async () => {
    const { clarityChain, deployer, validator2, validator3, ngo, donor, vendor } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    await whitelistAndAssociate(clarityChain, deployer, validator2, validator3, ngo, 0n, vendor.account.address);
    await assertReverts(
      () => clarityChain.write.vendorRefundToCampaign([0n], {
        account: vendor.account,
        value: 0n,
      }),
      "RefundAmountMustBeGreaterThanZero"
    );
  });
});

// =============================================================================
// enableRefunds() and claimRefund()
// =============================================================================

describe("enableRefunds()", () => {
  it("closes campaign and sets refundsEnabled", async () => {
    const { clarityChain, ngo, donor } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    await clarityChain.write.enableRefunds([0n], { account: ngo.account });
    const c = await clarityChain.read.getCampaign([0n]);
    assert.equal(c[5], false);
    assert.equal(c[6], true);
  });

  it("reverts if caller is not the campaign NGO", async () => {
    const { clarityChain, ngo, nonValidator } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await assertReverts(
      () => clarityChain.write.enableRefunds([0n], { account: nonValidator.account }),
      "NotCampaignNGO"
    );
  });

  it("reverts if refunds already enabled", async () => {
    const { clarityChain, ngo, donor } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    await clarityChain.write.enableRefunds([0n], { account: ngo.account });
    await assertReverts(
      () => clarityChain.write.enableRefunds([0n], { account: ngo.account }),
      "RefundsAlreadyEnabled"
    );
  });
});

describe("claimRefund()", () => {
  it("returns full donation when no vendor withdrawals were made", async () => {
    const { clarityChain, ngo, donor, publicClient } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    await clarityChain.write.enableRefunds([0n], { account: ngo.account });

    const before = await publicClient.getBalance({ address: donor.account.address });
    await clarityChain.write.claimRefund([0n], { account: donor.account });
    const after = await publicClient.getBalance({ address: donor.account.address });
    assert.ok(after > before, "Donor balance should increase after refund");
  });

  it("returns proportional refund when some funds already spent", async () => {
    const { clarityChain, deployer, validator2, validator3, ngo, donor, vendor } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    await whitelistAndAssociate(clarityChain, deployer, validator2, validator3, ngo, 0n, vendor.account.address);
    await clarityChain.write.withdrawToVendor(
      [0n, vendor.account.address, parseEther("0.5")],
      { account: ngo.account }
    );
    await clarityChain.write.enableRefunds([0n], { account: ngo.account });

    const refundAmount = await clarityChain.read.getRefundAmount([0n, donor.account.address]);
    assert.equal(refundAmount, parseEther("0.5"));
  });

  it("reverts if refunds not enabled", async () => {
    const { clarityChain, ngo, donor } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    await assertReverts(
      () => clarityChain.write.claimRefund([0n], { account: donor.account }),
      "RefundsNotEnabled"
    );
  });

  it("reverts on double claim", async () => {
    const { clarityChain, ngo, donor } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    await clarityChain.write.enableRefunds([0n], { account: ngo.account });
    await clarityChain.write.claimRefund([0n], { account: donor.account });
    await assertReverts(
      () => clarityChain.write.claimRefund([0n], { account: donor.account }),
      "NoDonationFoundForWallet"
    );
  });
});

// =============================================================================
// proposeVendor() and approveVendor()
// =============================================================================

describe("proposeVendor()", () => {
  it("creates a proposal with correct data", async () => {
    const { clarityChain, deployer, vendor } = await deployFresh();
    await clarityChain.write.proposeVendor([vendor.account.address, VENDOR_NAME], { account: deployer.account });
    const p = await clarityChain.read.getProposalStatus([0n]);
    assert.equal(getAddress(p[0]), getAddress(vendor.account.address));
    assert.equal(p[1], VENDOR_NAME);
    assert.equal(p[2], 0n);
    assert.equal(p[3], false);
  });

  it("allows any wallet to propose", async () => {
    const { clarityChain, nonValidator, vendor } = await deployFresh();
    await clarityChain.write.proposeVendor([vendor.account.address, VENDOR_NAME], { account: nonValidator.account });
    assert.equal(await clarityChain.read.proposalCount(), 1n);
  });

  it("reverts if no verification link provided", async () => {
    const { clarityChain, deployer, vendor } = await deployFresh();
    await assertReverts(
      () => clarityChain.write.proposeVendor([vendor.account.address, "No Link Vendor"], { account: deployer.account }),
      "VerificationLinkRequired"
    );
  });

  it("reverts if vendor already whitelisted", async () => {
    const { clarityChain, deployer, validator2, validator3, vendor } = await deployFresh();
    await whitelistVendor(clarityChain, deployer, validator2, validator3, vendor.account.address);
    await assertReverts(
      () => clarityChain.write.proposeVendor([vendor.account.address, VENDOR_NAME], { account: deployer.account }),
      "VendorAlreadyWhitelisted"
    );
  });
});

describe("approveVendor()", () => {
  it("does not whitelist before threshold", async () => {
    const { clarityChain, deployer, validator2, vendor } = await deployFresh();
    await clarityChain.write.proposeVendor([vendor.account.address, VENDOR_NAME], { account: deployer.account });
    await clarityChain.write.approveVendor([0n], { account: deployer.account });
    await clarityChain.write.approveVendor([0n], { account: validator2.account });
    assert.equal(await clarityChain.read.isVendorWhitelisted([vendor.account.address]), false);
  });

  it("auto-whitelists at threshold", async () => {
    const { clarityChain, deployer, validator2, validator3, vendor } = await deployFresh();
    await clarityChain.write.proposeVendor([vendor.account.address, VENDOR_NAME], { account: deployer.account });
    await clarityChain.write.approveVendor([0n], { account: deployer.account });
    await clarityChain.write.approveVendor([0n], { account: validator2.account });
    await clarityChain.write.approveVendor([0n], { account: validator3.account });
    assert.equal(await clarityChain.read.isVendorWhitelisted([vendor.account.address]), true);
  });

  it("reverts if non-validator tries to approve", async () => {
    const { clarityChain, deployer, nonValidator, vendor } = await deployFresh();
    await clarityChain.write.proposeVendor([vendor.account.address, VENDOR_NAME], { account: deployer.account });
    await assertReverts(
      () => clarityChain.write.approveVendor([0n], { account: nonValidator.account }),
      "NotValidator"
    );
  });

  it("reverts on double approval", async () => {
    const { clarityChain, deployer, vendor } = await deployFresh();
    await clarityChain.write.proposeVendor([vendor.account.address, VENDOR_NAME], { account: deployer.account });
    await clarityChain.write.approveVendor([0n], { account: deployer.account });
    await assertReverts(
      () => clarityChain.write.approveVendor([0n], { account: deployer.account }),
      "AlreadyApprovedProposal"
    );
  });

  it("reverts if proposal already executed", async () => {
    const { clarityChain, deployer, validator2, validator3, vendor } = await deployFresh();
    await whitelistVendor(clarityChain, deployer, validator2, validator3, vendor.account.address);
    await assertReverts(
      () => clarityChain.write.approveVendor([0n], { account: deployer.account }),
      "ProposalAlreadyExecuted"
    );
  });
});

// =============================================================================
// applyForVerification() and approveIdentity()
// =============================================================================

describe("applyForVerification()", () => {
  it("creates an identity proposal with correct data", async () => {
    const { clarityChain, ngo } = await deployFresh();
    await clarityChain.write.applyForVerification([PROFILE_LINKS], { account: ngo.account });
    const p = await clarityChain.read.getIdentityProposalStatus([0n]);
    assert.equal(getAddress(p[0]), getAddress(ngo.account.address));
    assert.equal(p[1], PROFILE_LINKS);
    assert.equal(p[2], 0n);
    assert.equal(p[3], false);
  });

  it("reverts if no profile link provided", async () => {
    const { clarityChain, ngo } = await deployFresh();
    await assertReverts(
      () => clarityChain.write.applyForVerification(["Org Name Only"], { account: ngo.account }),
      "ProfileLinkRequired"
    );
  });

  it("reverts if wallet is already verified", async () => {
    const { clarityChain, deployer, validator2, validator3, ngo } = await deployFresh();
    await clarityChain.write.applyForVerification([PROFILE_LINKS], { account: ngo.account });
    const proposalId = (await clarityChain.read.identityProposalCount()) - 1n;
    await clarityChain.write.approveIdentity([proposalId], { account: deployer.account });
    await clarityChain.write.approveIdentity([proposalId], { account: validator2.account });
    await clarityChain.write.approveIdentity([proposalId], { account: validator3.account });

    await assertReverts(
      () => clarityChain.write.applyForVerification([PROFILE_LINKS], { account: ngo.account }),
      "WalletAlreadyVerified"
    );
  });
});

describe("approveIdentity()", () => {
  it("does not verify before threshold", async () => {
    const { clarityChain, deployer, validator2, ngo } = await deployFresh();
    await clarityChain.write.applyForVerification([PROFILE_LINKS], { account: ngo.account });
    await clarityChain.write.approveIdentity([0n], { account: deployer.account });
    await clarityChain.write.approveIdentity([0n], { account: validator2.account });
    const info = await clarityChain.read.getIdentityInfo([ngo.account.address]);
    assert.equal(info[0], false);
  });

  it("verifies wallet at threshold and stores links", async () => {
    const { clarityChain, deployer, validator2, validator3, ngo } = await deployFresh();
    await clarityChain.write.applyForVerification([PROFILE_LINKS], { account: ngo.account });
    await clarityChain.write.approveIdentity([0n], { account: deployer.account });
    await clarityChain.write.approveIdentity([0n], { account: validator2.account });
    await clarityChain.write.approveIdentity([0n], { account: validator3.account });

    const info = await clarityChain.read.getIdentityInfo([ngo.account.address]);
    assert.equal(info[0], true);
    assert.equal(info[1], PROFILE_LINKS);
  });

  it("reverts if non-validator tries to approve", async () => {
    const { clarityChain, ngo, nonValidator } = await deployFresh();
    await clarityChain.write.applyForVerification([PROFILE_LINKS], { account: ngo.account });
    await assertReverts(
      () => clarityChain.write.approveIdentity([0n], { account: nonValidator.account }),
      "NotValidator"
    );
  });

  it("reverts on double approval", async () => {
    const { clarityChain, deployer, ngo } = await deployFresh();
    await clarityChain.write.applyForVerification([PROFILE_LINKS], { account: ngo.account });
    await clarityChain.write.approveIdentity([0n], { account: deployer.account });
    await assertReverts(
      () => clarityChain.write.approveIdentity([0n], { account: deployer.account }),
      "AlreadyApprovedIdentityProposal"
    );
  });

  it("reverts if proposal already executed", async () => {
    const { clarityChain, deployer, validator2, validator3, ngo } = await deployFresh();
    await clarityChain.write.applyForVerification([PROFILE_LINKS], { account: ngo.account });
    await clarityChain.write.approveIdentity([0n], { account: deployer.account });
    await clarityChain.write.approveIdentity([0n], { account: validator2.account });
    await clarityChain.write.approveIdentity([0n], { account: validator3.account });
    await assertReverts(
      () => clarityChain.write.approveIdentity([0n], { account: deployer.account }),
      "IdentityProposalAlreadyExecuted"
    );
  });
});

// =============================================================================
// closeCampaign()
// =============================================================================

describe("closeCampaign()", () => {
  it("sets campaign active to false", async () => {
    const { clarityChain, ngo } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.closeCampaign([0n], { account: ngo.account });
    const c = await clarityChain.read.getCampaign([0n]);
    assert.equal(c[5], false);
  });

  it("blocks donations after close", async () => {
    const { clarityChain, ngo, donor } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.closeCampaign([0n], { account: ngo.account });
    await assertReverts(
      () => clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") }),
      "CampaignNotActive"
    );
  });

  it("blocks withdrawals after close", async () => {
    const { clarityChain, deployer, validator2, validator3, ngo, donor, vendor } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await clarityChain.write.donate([0n], { account: donor.account, value: parseEther("1") });
    await whitelistAndAssociate(clarityChain, deployer, validator2, validator3, ngo, 0n, vendor.account.address);
    await clarityChain.write.closeCampaign([0n], { account: ngo.account });
    await assertReverts(
      () => clarityChain.write.withdrawToVendor(
        [0n, vendor.account.address, parseEther("0.5")],
        { account: ngo.account }
      ),
      "CampaignNotActive"
    );
  });

  it("reverts if caller is not the campaign NGO", async () => {
    const { clarityChain, ngo, nonValidator } = await deployFresh();
    await clarityChain.write.createCampaign(["Fund", parseEther("10")], { account: ngo.account });
    await assertReverts(
      () => clarityChain.write.closeCampaign([0n], { account: nonValidator.account }),
      "NotCampaignNGO"
    );
  });
});