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
        address ngo;           // The NGO wallet that created and manages this campaign
        uint256 goalAmount;    // Target donation amount in wei (PAS on testnet)
        uint256 raisedAmount;  // Total amount donated so far
        uint256 withdrawnAmount; // Total amount already sent to vendors
        bool active;           // False = campaign closed, no more withdrawals
    }

    // =========================================================================
    // STATE VARIABLES
    // =========================================================================

    // --- Campaigns ---
    uint256 public campaignCount;
    mapping(uint256 => Campaign) public campaigns;

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
    // "ClarityChain: Vendor not whitelisted — REJECTED" will show on-chain.
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
        address indexed proposedBy
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
    // CAMPAIGN FUNCTIONS
    // =========================================================================

    /// @notice Any NGO can create a campaign. They become the sole NGO for it.
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
            active: true
        });
        campaignCount++;

        emit CampaignCreated(campaignId, _name, msg.sender, _goalAmount);
    }

    /// @notice Anyone can donate to an active campaign.
    /// @param campaignId The ID of the campaign to donate to.
    function donate(uint256 campaignId)
        external
        payable
        campaignExists(campaignId)
        campaignIsActive(campaignId)
        nonReentrant
    {
        require(msg.value > 0, "ClarityChain: Donation must be greater than 0");
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

        // Send funds to vendor
        (bool success, ) = vendor.call{value: amount}("");
        require(success, "ClarityChain: Transfer to vendor failed");

        emit WithdrawalToVendor(campaignId, vendor, vendorNames[vendor], amount);
    }

    /// @notice NGO can close their campaign. No more withdrawals after this.
    function closeCampaign(uint256 campaignId)
        external
        campaignExists(campaignId)
        onlyNGO(campaignId)
    {
        campaigns[campaignId].active = false;
        emit CampaignClosed(campaignId);
    }

    // =========================================================================
    // VENDOR MULTI-SIG FUNCTIONS
    // Flow: Any validator proposes a vendor -> other validators approve ->
    //       once REQUIRED_APPROVALS (3) is hit -> vendor is auto-whitelisted.
    // =========================================================================

    /// @notice A validator proposes a new vendor for whitelisting.
    /// @param vendor The vendor's wallet address.
    /// @param vendorName Human-readable name shown on the dashboard (e.g., "Cebu Rice Supply Co.")
    function proposeVendor(address vendor, string memory vendorName)
        external
        onlyValidator
        returns (uint256 proposalId)
    {
        require(vendor != address(0), "ClarityChain: Invalid vendor address");
        require(bytes(vendorName).length > 0, "ClarityChain: Vendor name cannot be empty");
        require(!whitelistedVendors[vendor], "ClarityChain: Vendor already whitelisted");

        proposalId = proposalCount;
        proposalVendorAddress[proposalId] = vendor;
        proposalVendorName[proposalId] = vendorName;
        proposalApprovalCount[proposalId] = 0;
        proposalExecuted[proposalId] = false;
        proposalCount++;

        emit VendorProposed(proposalId, vendor, vendorName, msg.sender);
    }

    /// @notice A validator signs off on a pending vendor proposal.
    /// @dev Once REQUIRED_APPROVALS signatures are collected, vendor is auto-whitelisted.
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
            address vendor = proposalVendorAddress[proposalId];
            string memory vName = proposalVendorName[proposalId];

            whitelistedVendors[vendor] = true;
            vendorNames[vendor] = vName;
            proposalExecuted[proposalId] = true;

            emit VendorWhitelisted(proposalId, vendor, vName);
        }
    }

    // =========================================================================
    // VIEW FUNCTIONS (read-only, free to call, powers the dashboard)
    // =========================================================================

    /// @notice Returns full campaign details. Used to populate campaign cards on the dashboard.
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
            bool active
        )
    {
        Campaign storage c = campaigns[campaignId];
        return (c.name, c.ngo, c.goalAmount, c.raisedAmount, c.withdrawnAmount, c.active);
    }

    /// @notice How much can still be withdrawn from this campaign.
    function getAvailableFunds(uint256 campaignId)
        external
        view
        campaignExists(campaignId)
        returns (uint256)
    {
        Campaign storage c = campaigns[campaignId];
        return c.raisedAmount - c.withdrawnAmount;
    }

    /// @notice Check if a vendor is on the whitelist. Used in the dashboard vendor lookup.
    function isVendorWhitelisted(address vendor) external view returns (bool) {
        return whitelistedVendors[vendor];
    }

    /// @notice Returns all validator addresses. Used for the governance display.
    function getValidators() external view returns (address[5] memory) {
        return validators;
    }

    /// @notice Returns how many approvals a pending proposal currently has.
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
