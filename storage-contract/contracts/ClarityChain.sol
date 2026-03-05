// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// =============================================================================
// ClarityChain.sol
// Anti-Corruption Donation Tracker
// Polkadot Solidity Hackathon 2026 - Cebu Edition
//
// Key Mechanic: NGOs can ONLY withdraw to whitelisted vendors.
// Withdrawal to any other address is rejected by the contract itself.
// All vendor approvals require 3-of-5 multi-sig from community validators.
//
// Changelog from v1:
//   - [Feature] Refund mechanism (pull pattern) — NGO enables refunds,
//     donors claim individually. No loops, no gas limit issues.
//   - [Feature] Open vendor proposals to anyone — any wallet can propose,
//     only validators approve.
//   - [Feature] Verification link required — vendorName string must contain
//     at least one pipe-delimited URL (e.g. "Name|https://dti.gov.ph/xyz").
// =============================================================================

contract ClarityChain {

    // =========================================================================
    // OWNERSHIP (no OpenZeppelin - custom lightweight implementation)
    // =========================================================================

    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "ClarityChain: Not owner");
        _;
    }

    // =========================================================================
    // REENTRANCY GUARD (no OpenZeppelin - custom lightweight implementation)
    // =========================================================================

    bool private locked;

    modifier nonReentrant() {
        require(!locked, "ClarityChain: Reentrant call blocked");
        locked = true;
        _;
        locked = false;
    }

    // =========================================================================
    // STRUCTS
    // =========================================================================

    struct Campaign {
        string name;
        address ngo;             // The NGO wallet that created and manages this campaign
        uint256 goalAmount;      // Target donation amount in wei (PAS on testnet)
        uint256 raisedAmount;    // Total amount donated so far
        uint256 withdrawnAmount; // Total amount already sent to vendors
        bool active;             // False = campaign closed, no more withdrawals
        bool refundsEnabled;     // True = NGO has triggered refund mode
    }

    // =========================================================================
    // STATE VARIABLES
    // =========================================================================

    // --- Campaigns ---
    uint256 public campaignCount;
    mapping(uint256 => Campaign) public campaigns;

    // --- Donor Tracking (for refunds) ---
    // Records each donor's total contribution per campaign.
    // Uses a separate list to know who donated without looping the mapping.
    // Pull pattern: donors claim their own refund individually.
    mapping(uint256 => mapping(address => uint256)) public donorAmounts;
    mapping(uint256 => address[]) private donorList;
    mapping(uint256 => mapping(address => bool)) private hasDonated;

    // --- Vendor Whitelist ---
    mapping(address => bool) public whitelistedVendors;
    mapping(address => string) public vendorNames; // human-readable name for dashboard

    // --- Multi-Sig Validators ---
    // Up to 5 validator slots. For the hackathon, 3 wallets minimum.
    address[5] public validators;
    uint256 public validatorCount;
    uint256 public constant REQUIRED_APPROVALS = 3; // 3-of-5

    // --- Vendor Proposals (multi-sig queue) ---
    uint256 public proposalCount;
    mapping(uint256 => address) public proposalVendorAddress;
    mapping(uint256 => string) public proposalVendorName;
    mapping(uint256 => uint256) public proposalApprovalCount;
    mapping(uint256 => bool) public proposalExecuted;
    // proposalId => validatorAddress => hasApproved
    mapping(uint256 => mapping(address => bool)) public proposalApprovals;

    // =========================================================================
    // EVENTS
    // These power the public transaction feed on the React dashboard.
    // Everything the public sees is emitted as an event.
    // =========================================================================

    event CampaignCreated(
        uint256 indexed campaignId,
        string name,
        address indexed ngo,
        uint256 goalAmount
    );

    event DonationReceived(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 amount
    );

    // THE MONEY SHOT: This is the rejection event for the demo.
    // When an NGO tries to withdraw to a non-whitelisted address,
    // the require() below reverts the transaction entirely.
    // "ClarityChain: Vendor not whitelisted -- REJECTED" will show on-chain.
    event WithdrawalToVendor(
        uint256 indexed campaignId,
        address indexed vendor,
        string vendorName,
        uint256 amount
    );

    event VendorProposed(
        uint256 indexed proposalId,
        address indexed vendor,
        string vendorName,
        address indexed proposedBy  // now any wallet, not just validators
    );

    event VendorApprovalSigned(
        uint256 indexed proposalId,
        address indexed validator,
        uint256 currentApprovals
    );

    event VendorWhitelisted(
        uint256 indexed proposalId,
        address indexed vendor,
        string vendorName
    );

    event CampaignClosed(uint256 indexed campaignId);

    // Emitted when the NGO enables refund mode for a campaign.
    event RefundsEnabled(uint256 indexed campaignId, uint256 refundableAmount);

    // Emitted when a donor successfully claims their individual refund.
    event RefundClaimed(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 amount
    );

    // =========================================================================
    // MODIFIERS
    // =========================================================================

    modifier onlyValidator() {
        bool isValidator = false;
        for (uint256 i = 0; i < validatorCount; i++) {
            if (validators[i] == msg.sender) {
                isValidator = true;
                break;
            }
        }
        require(isValidator, "ClarityChain: Not a validator");
        _;
    }

    modifier onlyNGO(uint256 campaignId) {
        require(
            campaigns[campaignId].ngo == msg.sender,
            "ClarityChain: Not the campaign NGO"
        );
        _;
    }

    modifier campaignExists(uint256 campaignId) {
        require(campaignId < campaignCount, "ClarityChain: Campaign does not exist");
        _;
    }

    modifier campaignIsActive(uint256 campaignId) {
        require(campaigns[campaignId].active, "ClarityChain: Campaign is not active");
        _;
    }

    // =========================================================================
    // CONSTRUCTOR
    // Deploy with an array of 3-5 validator wallet addresses.
    // For the hackathon demo: use 3 different MetaMask wallets from your team.
    // =========================================================================

    constructor(address[] memory _validators) {
        require(
            _validators.length >= 3 && _validators.length <= 5,
            "ClarityChain: Need between 3 and 5 validators"
        );
        owner = msg.sender;
        validatorCount = _validators.length;
        for (uint256 i = 0; i < _validators.length; i++) {
            require(_validators[i] != address(0), "ClarityChain: Invalid validator address");
            validators[i] = _validators[i];
        }
    }

    // =========================================================================
    // INTERNAL HELPERS
    // =========================================================================

    /// @dev Checks that a vendorName string contains at least one pipe character.
    ///      The frontend encodes verification links as "Name|https://link1|https://link2".
    ///      At least one link is required — a name with no pipe means no verification link.
    function _containsPipe(string memory str) internal pure returns (bool) {
        bytes memory b = bytes(str);
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == "|") {
                return true;
            }
        }
        return false;
    }

    // =========================================================================
    // CAMPAIGN FUNCTIONS
    // =========================================================================

    /// @notice Any wallet can create a campaign. They become the sole NGO for it.
    /// @param _name Human-readable campaign name (e.g., "Typhoon Odette Relief Fund")
    /// @param _goalAmount Target in wei. For demo, use small values.
    function createCampaign(string memory _name, uint256 _goalAmount)
        external
        returns (uint256 campaignId)
    {
        require(bytes(_name).length > 0, "ClarityChain: Name cannot be empty");
        require(_goalAmount > 0, "ClarityChain: Goal must be greater than 0");

        campaignId = campaignCount;
        campaigns[campaignId] = Campaign({
            name: _name,
            ngo: msg.sender,
            goalAmount: _goalAmount,
            raisedAmount: 0,
            withdrawnAmount: 0,
            active: true,
            refundsEnabled: false
        });
        campaignCount++;

        emit CampaignCreated(campaignId, _name, msg.sender, _goalAmount);
    }

    /// @notice Anyone can donate to an active campaign.
    /// @dev Donor address and amount are recorded individually for the refund mechanism.
    /// @param campaignId The ID of the campaign to donate to.
    function donate(uint256 campaignId)
        external
        payable
        campaignExists(campaignId)
        campaignIsActive(campaignId)
        nonReentrant
    {
        require(msg.value > 0, "ClarityChain: Donation must be greater than 0");

        // Track donor individually for refund eligibility
        if (!hasDonated[campaignId][msg.sender]) {
            hasDonated[campaignId][msg.sender] = true;
            donorList[campaignId].push(msg.sender);
        }
        donorAmounts[campaignId][msg.sender] += msg.value;
        campaigns[campaignId].raisedAmount += msg.value;

        emit DonationReceived(campaignId, msg.sender, msg.value);
    }

    /// @notice THE CORE FUNCTION. NGO withdraws funds — but ONLY to a whitelisted vendor.
    /// @dev If `vendor` is not in `whitelistedVendors`, this REVERTS. No exceptions.
    ///      This revert is the live demo moment. Show it failing, then show it succeeding.
    /// @param campaignId The campaign to withdraw from.
    /// @param vendor The whitelisted vendor address to send funds to.
    /// @param amount Amount in wei to send to the vendor.
    function withdrawToVendor(
        uint256 campaignId,
        address payable vendor,
        uint256 amount
    )
        external
        campaignExists(campaignId)
        campaignIsActive(campaignId)
        onlyNGO(campaignId)
        nonReentrant
    {
        // THIS IS THE MONEY LINE. Non-whitelisted = instant rejection.
        require(
            whitelistedVendors[vendor],
            "ClarityChain: Vendor not whitelisted -- REJECTED"
        );
        require(amount > 0, "ClarityChain: Amount must be greater than 0");

        uint256 available = campaigns[campaignId].raisedAmount
            - campaigns[campaignId].withdrawnAmount;
        require(amount <= available, "ClarityChain: Insufficient campaign funds");

        campaigns[campaignId].withdrawnAmount += amount;

        (bool success, ) = vendor.call{value: amount}("");
        require(success, "ClarityChain: Transfer to vendor failed");

        emit WithdrawalToVendor(campaignId, vendor, vendorNames[vendor], amount);
    }

    /// @notice NGO closes their campaign. No more donations or withdrawals after this.
    ///         Closing does not enable refunds — use enableRefunds() for that separately.
    function closeCampaign(uint256 campaignId)
        external
        campaignExists(campaignId)
        onlyNGO(campaignId)
    {
        campaigns[campaignId].active = false;
        emit CampaignClosed(campaignId);
    }

    // =========================================================================
    // REFUND FUNCTIONS (Pull Pattern)
    //
    // Flow:
    //   1. NGO calls enableRefunds(campaignId) — closes the campaign and sets
    //      the refundsEnabled flag. Any unspent funds are locked for donor claims.
    //   2. Each donor individually calls claimRefund(campaignId) to receive
    //      their proportional share of the unspent balance.
    //
    // Why pull pattern?
    //   Pushing refunds to all donors in a single transaction would require
    //   looping over the entire donor list, which hits gas limits at scale.
    //   Pull pattern: each donor triggers their own transfer — O(1) per claim.
    // =========================================================================

    /// @notice NGO enables refund mode for a campaign.
    ///         Closes the campaign and allows donors to claim back their share
    ///         of whatever unspent funds remain.
    /// @dev If some funds were already withdrawn to vendors, donors receive a
    ///      proportional refund of the remaining balance, not their full donation.
    ///      Formula: refund = (donorAmount / raisedAmount) * remainingBalance
    /// @param campaignId The campaign to enable refunds for.
    function enableRefunds(uint256 campaignId)
        external
        campaignExists(campaignId)
        onlyNGO(campaignId)
    {
        Campaign storage c = campaigns[campaignId];
        require(!c.refundsEnabled, "ClarityChain: Refunds already enabled");

        c.active = false;
        c.refundsEnabled = true;

        uint256 refundableAmount = c.raisedAmount - c.withdrawnAmount;
        emit RefundsEnabled(campaignId, refundableAmount);
    }

    /// @notice A donor claims their individual refund from a campaign in refund mode.
    /// @dev Uses pull pattern — donor initiates, contract sends only to msg.sender.
    ///      Proportional formula used when some funds were already spent on vendors.
    /// @param campaignId The campaign to claim a refund from.
    function claimRefund(uint256 campaignId)
        external
        campaignExists(campaignId)
        nonReentrant
    {
        Campaign storage c = campaigns[campaignId];
        require(c.refundsEnabled, "ClarityChain: Refunds not enabled for this campaign");

        uint256 donated = donorAmounts[campaignId][msg.sender];
        require(donated > 0, "ClarityChain: No donation found for this wallet");

        // Calculate proportional refund.
        // If the NGO already spent some funds on vendors, donors get back
        // their proportional share of what remains, not the full donation.
        // Example: donor gave 10 PAS, campaign raised 100 PAS total,
        // NGO spent 40 PAS on vendors — 60 PAS remains.
        // Donor's refund = (10 / 100) * 60 = 6 PAS.
        uint256 remaining = c.raisedAmount - c.withdrawnAmount;
        uint256 refundAmount = (donated * remaining) / c.raisedAmount;

        require(refundAmount > 0, "ClarityChain: Nothing left to refund");

        // Zero out before transfer to prevent double-claim
        donorAmounts[campaignId][msg.sender] = 0;
        hasDonated[campaignId][msg.sender] = false;

        (bool success, ) = payable(msg.sender).call{value: refundAmount}("");
        require(success, "ClarityChain: Refund transfer failed");

        emit RefundClaimed(campaignId, msg.sender, refundAmount);
    }

    // =========================================================================
    // VENDOR MULTI-SIG FUNCTIONS
    //
    // Flow: Any wallet proposes a vendor -> validators approve ->
    //       once REQUIRED_APPROVALS (3) is hit -> vendor is auto-whitelisted.
    //
    // Note: Anyone can propose (vendors proposing themselves is the realistic
    //       scenario). Only validators can approve.
    // =========================================================================

    /// @notice Any wallet can propose a new vendor for whitelisting.
    /// @dev Removed onlyValidator restriction — vendors self-register, NGOs
    ///      nominate suppliers, anyone surfaces a legitimate business.
    ///      At least one verification link is required in vendorName, encoded
    ///      as "Vendor Name|https://link1|https://link2" using pipe delimiter.
    /// @param vendor The vendor's wallet address.
    /// @param vendorName Pipe-delimited string: "Name|https://verificationLink"
    ///                   At least one link is required after the first pipe.
    function proposeVendor(address vendor, string memory vendorName)
        external
        returns (uint256 proposalId)
    {
        require(vendor != address(0), "ClarityChain: Invalid vendor address");
        require(bytes(vendorName).length > 0, "ClarityChain: Vendor name cannot be empty");
        require(!whitelistedVendors[vendor], "ClarityChain: Vendor already whitelisted");

        // Enforce at least one verification link.
        // Frontend encodes as "Vendor Name|https://link" — pipe presence = link present.
        require(
            _containsPipe(vendorName),
            "ClarityChain: At least one verification link is required"
        );

        proposalId = proposalCount;
        proposalVendorAddress[proposalId] = vendor;
        proposalVendorName[proposalId] = vendorName;
        proposalApprovalCount[proposalId] = 0;
        proposalExecuted[proposalId] = false;
        proposalCount++;

        emit VendorProposed(proposalId, vendor, vendorName, msg.sender);
    }

    /// @notice A validator signs off on a pending vendor proposal.
    /// @dev Only validators can approve — open proposals, restricted approvals.
    ///      Once REQUIRED_APPROVALS signatures are collected, vendor is auto-whitelisted.
    /// @param proposalId The ID of the vendor proposal to approve.
    function approveVendor(uint256 proposalId) external onlyValidator {
        require(proposalId < proposalCount, "ClarityChain: Proposal does not exist");
        require(!proposalExecuted[proposalId], "ClarityChain: Proposal already executed");
        require(
            !proposalApprovals[proposalId][msg.sender],
            "ClarityChain: You already approved this proposal"
        );

        proposalApprovals[proposalId][msg.sender] = true;
        proposalApprovalCount[proposalId]++;

        emit VendorApprovalSigned(proposalId, msg.sender, proposalApprovalCount[proposalId]);

        // Auto-execute once threshold is met
        if (proposalApprovalCount[proposalId] >= REQUIRED_APPROVALS) {
            address v = proposalVendorAddress[proposalId];
            string memory vName = proposalVendorName[proposalId];

            whitelistedVendors[v] = true;
            vendorNames[v] = vName;
            proposalExecuted[proposalId] = true;

            emit VendorWhitelisted(proposalId, v, vName);
        }
    }

    // =========================================================================
    // VIEW FUNCTIONS (read-only, free to call, powers the dashboard)
    // =========================================================================

    /// @notice Returns full campaign details. Used to populate campaign cards.
    function getCampaign(uint256 campaignId)
        external
        view
        campaignExists(campaignId)
        returns (
            string memory name,
            address ngo,
            uint256 goalAmount,
            uint256 raisedAmount,
            uint256 withdrawnAmount,
            bool active,
            bool refundsEnabled
        )
    {
        Campaign storage c = campaigns[campaignId];
        return (
            c.name,
            c.ngo,
            c.goalAmount,
            c.raisedAmount,
            c.withdrawnAmount,
            c.active,
            c.refundsEnabled
        );
    }

    /// @notice How much can still be withdrawn or refunded from this campaign.
    function getAvailableFunds(uint256 campaignId)
        external
        view
        campaignExists(campaignId)
        returns (uint256)
    {
        Campaign storage c = campaigns[campaignId];
        return c.raisedAmount - c.withdrawnAmount;
    }

    /// @notice How much a specific donor would receive if they claimed a refund now.
    /// @dev Returns 0 if refunds are not enabled or the donor has no donation recorded.
    function getRefundAmount(uint256 campaignId, address donor)
        external
        view
        campaignExists(campaignId)
        returns (uint256)
    {
        Campaign storage c = campaigns[campaignId];
        if (!c.refundsEnabled) return 0;

        uint256 donated = donorAmounts[campaignId][donor];
        if (donated == 0) return 0;

        uint256 remaining = c.raisedAmount - c.withdrawnAmount;
        return (donated * remaining) / c.raisedAmount;
    }

    /// @notice Returns the list of donor addresses for a campaign.
    /// @dev Used by the frontend refund management tab to display donor wallets.
    function getCampaignDonors(uint256 campaignId)
        external
        view
        campaignExists(campaignId)
        returns (address[] memory)
    {
        return donorList[campaignId];
    }

    /// @notice Check if a vendor is on the whitelist.
    function isVendorWhitelisted(address vendor) external view returns (bool) {
        return whitelistedVendors[vendor];
    }

    /// @notice Returns all validator addresses.
    function getValidators() external view returns (address[5] memory) {
        return validators;
    }

    /// @notice Returns proposal status by ID.
    function getProposalStatus(uint256 proposalId)
        external
        view
        returns (
            address vendor,
            string memory vendorName,
            uint256 approvals,
            bool executed
        )
    {
        require(proposalId < proposalCount, "ClarityChain: Proposal does not exist");
        return (
            proposalVendorAddress[proposalId],
            proposalVendorName[proposalId],
            proposalApprovalCount[proposalId],
            proposalExecuted[proposalId]
        );
    }
}
