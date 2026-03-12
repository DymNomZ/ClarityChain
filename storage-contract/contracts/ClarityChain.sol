// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract ClarityChain {

    error NotOwner();
    error ReentrantCall();
    error NotValidator();
    error NotCampaignNGO();
    error CampaignDoesNotExist();
    error CampaignNotActive();
    error NameCannotBeEmpty();
    error GoalMustBeGreaterThanZero();
    error DonationMustBeGreaterThanZero();
    error DonationExceedsGoal();
    error VendorNotWhitelistedRejected();
    error VendorNotAssociatedWithCampaign();
    error AmountMustBeGreaterThanZero();
    error AmountExceedsVendorCap();
    error InsufficientCampaignFunds();
    error TransferToVendorFailed();
    error VendorNotWhitelisted();
    error VendorAlreadyAssociated();
    error CapMustBeGreaterThanZero();
    error InstructionsCannotBeEmpty();
    error RefundAmountMustBeGreaterThanZero();
    error CallerNotAssociatedVendor();
    error RefundsAlreadyEnabled();
    error RefundsNotEnabled();
    error NoDonationFoundForWallet();
    error NothingLeftToRefund();
    error RefundTransferFailed();
    error InvalidVendorAddress();
    error VendorNameCannotBeEmpty();
    error VendorAlreadyWhitelisted();
    error VerificationLinkRequired();
    error ProposalDoesNotExist();
    error ProposalAlreadyExecuted();
    error AlreadyApprovedProposal();
    error InvalidValidatorAddress();
    error NeedBetweenThreeAndFiveValidators();
    error ProfileLinkRequired();
    error WalletAlreadyVerified();
    error IdentityProposalDoesNotExist();
    error IdentityProposalAlreadyExecuted();
    error AlreadyApprovedIdentityProposal();

    address public owner;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    bool private locked;

    modifier nonReentrant() {
        if (locked) revert ReentrantCall();
        locked = true;
        _;
        locked = false;
    }

    struct Campaign {
        string name;
        address ngo;
        uint256 goalAmount;
        uint256 raisedAmount;
        uint256 withdrawnAmount;
        bool active;
        bool refundsEnabled;
    }

    struct CampaignVendor {
        uint256 cap;
        uint256 spent;
        string instructions;
        bool associated;
    }

    enum TxType { Donation, Withdrawal, VendorRefund }

    struct Transaction {
        TxType txType;
        address actor;
        address vendor;
        uint256 amount;
        uint256 timestamp;
    }

    uint256 public campaignCount;
    mapping(uint256 => Campaign) public campaigns;

    mapping(uint256 => mapping(address => uint256)) public donorAmounts;
    mapping(uint256 => address[]) private donorList;
    mapping(uint256 => mapping(address => bool)) private hasDonated;

    mapping(address => bool) public whitelistedVendors;
    mapping(address => string) public vendorNames;

    mapping(uint256 => mapping(address => CampaignVendor)) public campaignVendors;
    mapping(uint256 => address[]) private campaignVendorList;

    // On-chain transaction log per campaign
    mapping(uint256 => Transaction[]) private campaignTransactions;

    address[5] public validators;
    uint256 public validatorCount;
    uint256 public constant REQUIRED_APPROVALS = 3;

    uint256 public proposalCount;
    mapping(uint256 => address) public proposalVendorAddress;
    mapping(uint256 => string) public proposalVendorName;
    mapping(uint256 => uint256) public proposalApprovalCount;
    mapping(uint256 => bool) public proposalExecuted;
    mapping(uint256 => mapping(address => bool)) public proposalApprovals;

    uint256 public identityProposalCount;
    mapping(uint256 => address) public identityProposalApplicant;
    mapping(uint256 => string) public identityProposalLinks;
    mapping(uint256 => uint256) public identityProposalApprovalCount;
    mapping(uint256 => bool) public identityProposalExecuted;
    mapping(uint256 => mapping(address => bool)) public identityProposalApprovals;
    mapping(address => bool) public verifiedIdentities;
    mapping(address => string) public identityLinks;

    event CampaignCreated(uint256 indexed campaignId, string name, address indexed ngo, uint256 goalAmount);
    event DonationReceived(uint256 indexed campaignId, address indexed donor, uint256 amount);
    event WithdrawalToVendor(uint256 indexed campaignId, address indexed vendor, string vendorName, uint256 amount);
    event VendorAssociated(uint256 indexed campaignId, address indexed vendor, uint256 cap, string instructions);
    event VendorRefundedCampaign(uint256 indexed campaignId, address indexed vendor, uint256 amount);
    event VendorProposed(uint256 indexed proposalId, address indexed vendor, string vendorName, address indexed proposedBy);
    event VendorApprovalSigned(uint256 indexed proposalId, address indexed validator, uint256 currentApprovals);
    event VendorWhitelisted(uint256 indexed proposalId, address indexed vendor, string vendorName);
    event CampaignClosed(uint256 indexed campaignId);
    event RefundsEnabled(uint256 indexed campaignId, uint256 refundableAmount);
    event RefundClaimed(uint256 indexed campaignId, address indexed donor, uint256 amount);
    event IdentityVerificationApplied(uint256 indexed proposalId, address indexed applicant, string profileLinks);
    event IdentityVerificationSigned(uint256 indexed proposalId, address indexed validator, uint256 currentApprovals);
    event IdentityVerified(uint256 indexed proposalId, address indexed applicant, string profileLinks);

    modifier onlyValidator() {
        bool isValidator = false;
        for (uint256 i = 0; i < validatorCount; i++) {
            if (validators[i] == msg.sender) { isValidator = true; break; }
        }
        if (!isValidator) revert NotValidator();
        _;
    }

    modifier onlyNGO(uint256 campaignId) {
        if (campaigns[campaignId].ngo != msg.sender) revert NotCampaignNGO();
        _;
    }

    modifier campaignExists(uint256 campaignId) {
        if (campaignId >= campaignCount) revert CampaignDoesNotExist();
        _;
    }

    modifier campaignIsActive(uint256 campaignId) {
        if (!campaigns[campaignId].active) revert CampaignNotActive();
        _;
    }
    constructor(address[] memory _validators) {
        if (_validators.length < 3 || _validators.length > 5) revert NeedBetweenThreeAndFiveValidators();
        owner = msg.sender;
        validatorCount = _validators.length;
        for (uint256 i = 0; i < _validators.length; i++) {
            if (_validators[i] == address(0)) revert InvalidValidatorAddress();
            validators[i] = _validators[i];
        }
    }

    function _containsPipe(string memory str) internal pure returns (bool) {
        bytes memory b = bytes(str);
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == "|") return true;
        }
        return false;
    }

    function createCampaign(string memory _name, uint256 _goalAmount)
        external
        returns (uint256 campaignId)
    {
        if (bytes(_name).length == 0) revert NameCannotBeEmpty();
        if (_goalAmount == 0) revert GoalMustBeGreaterThanZero();

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

    function donate(uint256 campaignId)
        external
        payable
        campaignExists(campaignId)
        campaignIsActive(campaignId)
        nonReentrant
    {
        if (msg.value == 0) revert DonationMustBeGreaterThanZero();
        if (campaigns[campaignId].raisedAmount + msg.value > campaigns[campaignId].goalAmount)
            revert DonationExceedsGoal();

        if (!hasDonated[campaignId][msg.sender]) {
            hasDonated[campaignId][msg.sender] = true;
            donorList[campaignId].push(msg.sender);
        }
        donorAmounts[campaignId][msg.sender] += msg.value;
        campaigns[campaignId].raisedAmount += msg.value;

        campaignTransactions[campaignId].push(Transaction({
            txType: TxType.Donation,
            actor: msg.sender,
            vendor: address(0),
            amount: msg.value,
            timestamp: block.timestamp
        }));

        emit DonationReceived(campaignId, msg.sender, msg.value);
    }

    function associateVendor(
        uint256 campaignId,
        address vendor,
        uint256 cap,
        string memory instructions
    )
        external
        campaignExists(campaignId)
        campaignIsActive(campaignId)
        onlyNGO(campaignId)
    {
        if (!whitelistedVendors[vendor]) revert VendorNotWhitelisted();
        if (campaignVendors[campaignId][vendor].associated) revert VendorAlreadyAssociated();
        if (cap == 0) revert CapMustBeGreaterThanZero();
        if (bytes(instructions).length == 0) revert InstructionsCannotBeEmpty();

        campaignVendors[campaignId][vendor] = CampaignVendor({
            cap: cap,
            spent: 0,
            instructions: instructions,
            associated: true
        });
        campaignVendorList[campaignId].push(vendor);

        emit VendorAssociated(campaignId, vendor, cap, instructions);
    }

    /// @notice THE CORE FUNCTION. Three-layer enforcement:
    ///         1. Global whitelist — community approved
    ///         2. Campaign association — NGO explicitly linked this vendor
    ///         3. Cap — cannot exceed the agreed allocation
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
        if (!whitelistedVendors[vendor]) revert VendorNotWhitelistedRejected();
        if (!campaignVendors[campaignId][vendor].associated) revert VendorNotAssociatedWithCampaign();
        if (amount == 0) revert AmountMustBeGreaterThanZero();

        CampaignVendor storage cv = campaignVendors[campaignId][vendor];
        if (cv.spent + amount > cv.cap) revert AmountExceedsVendorCap();

        uint256 available = campaigns[campaignId].raisedAmount - campaigns[campaignId].withdrawnAmount;
        if (amount > available) revert InsufficientCampaignFunds();

        cv.spent += amount;
        campaigns[campaignId].withdrawnAmount += amount;

        (bool success, ) = vendor.call{value: amount}("");
        if (!success) revert TransferToVendorFailed();

        campaignTransactions[campaignId].push(Transaction({
            txType: TxType.Withdrawal,
            actor: msg.sender,
            vendor: vendor,
            amount: amount,
            timestamp: block.timestamp
        }));

        emit WithdrawalToVendor(campaignId, vendor, vendorNames[vendor], amount);
    }

    function closeCampaign(uint256 campaignId)
        external
        campaignExists(campaignId)
        onlyNGO(campaignId)
    {
        campaigns[campaignId].active = false;
        emit CampaignClosed(campaignId);
    }

    function vendorRefundToCampaign(uint256 campaignId)
        external
        payable
        campaignExists(campaignId)
        nonReentrant
    {
        if (msg.value == 0) revert RefundAmountMustBeGreaterThanZero();
        if (!campaignVendors[campaignId][msg.sender].associated) revert CallerNotAssociatedVendor();

        CampaignVendor storage cv = campaignVendors[campaignId][msg.sender];
        if (msg.value <= cv.spent) {
            cv.spent -= msg.value;
        } else {
            cv.spent = 0;
        }

        Campaign storage c = campaigns[campaignId];
        if (msg.value <= c.withdrawnAmount) {
            c.withdrawnAmount -= msg.value;
        } else {
            c.withdrawnAmount = 0;
        }

        campaignTransactions[campaignId].push(Transaction({
            txType: TxType.VendorRefund,
            actor: msg.sender,
            vendor: msg.sender,
            amount: msg.value,
            timestamp: block.timestamp
        }));

        emit VendorRefundedCampaign(campaignId, msg.sender, msg.value);
    }

    function enableRefunds(uint256 campaignId)
        external
        campaignExists(campaignId)
        onlyNGO(campaignId)
    {
        Campaign storage c = campaigns[campaignId];
        if (c.refundsEnabled) revert RefundsAlreadyEnabled();

        c.active = false;
        c.refundsEnabled = true;

        emit RefundsEnabled(campaignId, c.raisedAmount - c.withdrawnAmount);
    }

    function claimRefund(uint256 campaignId)
        external
        campaignExists(campaignId)
        nonReentrant
    {
        Campaign storage c = campaigns[campaignId];
        if (!c.refundsEnabled) revert RefundsNotEnabled();

        uint256 donated = donorAmounts[campaignId][msg.sender];
        if (donated == 0) revert NoDonationFoundForWallet();

        uint256 remaining = c.raisedAmount - c.withdrawnAmount;
        uint256 refundAmount = (donated * remaining) / c.raisedAmount;
        if (refundAmount == 0) revert NothingLeftToRefund();

        donorAmounts[campaignId][msg.sender] = 0;
        hasDonated[campaignId][msg.sender] = false;

        (bool success, ) = payable(msg.sender).call{value: refundAmount}("");
        if (!success) revert RefundTransferFailed();

        emit RefundClaimed(campaignId, msg.sender, refundAmount);
    }

    function proposeVendor(address vendor, string memory vendorName)
        external
        returns (uint256 proposalId)
    {
        if (vendor == address(0)) revert InvalidVendorAddress();
        if (bytes(vendorName).length == 0) revert VendorNameCannotBeEmpty();
        if (whitelistedVendors[vendor]) revert VendorAlreadyWhitelisted();
        if (!_containsPipe(vendorName)) revert VerificationLinkRequired();

        proposalId = proposalCount;
        proposalVendorAddress[proposalId] = vendor;
        proposalVendorName[proposalId] = vendorName;
        proposalApprovalCount[proposalId] = 0;
        proposalExecuted[proposalId] = false;
        proposalCount++;

        emit VendorProposed(proposalId, vendor, vendorName, msg.sender);
    }

    function approveVendor(uint256 proposalId) external onlyValidator {
        if (proposalId >= proposalCount) revert ProposalDoesNotExist();
        if (proposalExecuted[proposalId]) revert ProposalAlreadyExecuted();
        if (proposalApprovals[proposalId][msg.sender]) revert AlreadyApprovedProposal();

        proposalApprovals[proposalId][msg.sender] = true;
        proposalApprovalCount[proposalId]++;

        emit VendorApprovalSigned(proposalId, msg.sender, proposalApprovalCount[proposalId]);

        if (proposalApprovalCount[proposalId] >= REQUIRED_APPROVALS) {
            address v = proposalVendorAddress[proposalId];
            string memory vName = proposalVendorName[proposalId];
            whitelistedVendors[v] = true;
            vendorNames[v] = vName;
            proposalExecuted[proposalId] = true;
            emit VendorWhitelisted(proposalId, v, vName);
        }
    }

    function applyForVerification(string memory profileLinks)
        external
        returns (uint256 proposalId)
    {
        if (!_containsPipe(profileLinks)) revert ProfileLinkRequired();
        if (verifiedIdentities[msg.sender]) revert WalletAlreadyVerified();

        proposalId = identityProposalCount;
        identityProposalApplicant[proposalId] = msg.sender;
        identityProposalLinks[proposalId] = profileLinks;
        identityProposalApprovalCount[proposalId] = 0;
        identityProposalExecuted[proposalId] = false;
        identityProposalCount++;

        emit IdentityVerificationApplied(proposalId, msg.sender, profileLinks);
    }

    function approveIdentity(uint256 proposalId) external onlyValidator {
        if (proposalId >= identityProposalCount) revert IdentityProposalDoesNotExist();
        if (identityProposalExecuted[proposalId]) revert IdentityProposalAlreadyExecuted();
        if (identityProposalApprovals[proposalId][msg.sender]) revert AlreadyApprovedIdentityProposal();

        identityProposalApprovals[proposalId][msg.sender] = true;
        identityProposalApprovalCount[proposalId]++;

        emit IdentityVerificationSigned(proposalId, msg.sender, identityProposalApprovalCount[proposalId]);

        if (identityProposalApprovalCount[proposalId] >= REQUIRED_APPROVALS) {
            address applicant = identityProposalApplicant[proposalId];
            string memory links = identityProposalLinks[proposalId];
            verifiedIdentities[applicant] = true;
            identityLinks[applicant] = links;
            identityProposalExecuted[proposalId] = true;
            emit IdentityVerified(proposalId, applicant, links);
        }
    }

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
        return (c.name, c.ngo, c.goalAmount, c.raisedAmount, c.withdrawnAmount, c.active, c.refundsEnabled);
    }

    function getAvailableFunds(uint256 campaignId)
        external
        view
        campaignExists(campaignId)
        returns (uint256)
    {
        Campaign storage c = campaigns[campaignId];
        return c.raisedAmount - c.withdrawnAmount;
    }

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

    function getCampaignDonors(uint256 campaignId)
        external
        view
        campaignExists(campaignId)
        returns (address[] memory)
    {
        return donorList[campaignId];
    }

    function getCampaignVendor(uint256 campaignId, address vendor)
        external
        view
        campaignExists(campaignId)
        returns (uint256 cap, uint256 spent, string memory instructions, bool associated)
    {
        CampaignVendor storage cv = campaignVendors[campaignId][vendor];
        return (cv.cap, cv.spent, cv.instructions, cv.associated);
    }

    function getCampaignVendorList(uint256 campaignId)
        external
        view
        campaignExists(campaignId)
        returns (address[] memory)
    {
        return campaignVendorList[campaignId];
    }

    function isVendorWhitelisted(address vendor) external view returns (bool) {
        return whitelistedVendors[vendor];
    }

    /// @notice Returns all whitelisted vendor addresses and their names.
    /// @dev Iterates executed proposals — O(n) but view-only, no gas cost.
    function getWhitelistedVendors()
        external
        view
        returns (address[] memory addresses, string[] memory names)
    {
        // First pass: count whitelisted vendors
        uint256 count = 0;
        for (uint256 i = 0; i < proposalCount; i++) {
            if (proposalExecuted[i]) count++;
        }

        addresses = new address[](count);
        names = new string[](count);

        // Second pass: populate arrays
        uint256 idx = 0;
        for (uint256 i = 0; i < proposalCount; i++) {
            if (proposalExecuted[i]) {
                address v = proposalVendorAddress[i];
                addresses[idx] = v;
                names[idx] = vendorNames[v];
                idx++;
            }
        }
    }

    function getValidators() external view returns (address[5] memory) {
        return validators;
    }

    function getProposalStatus(uint256 proposalId)
        external
        view
        returns (address vendor, string memory vendorName, uint256 approvals, bool executed)
    {
        if (proposalId >= proposalCount) revert ProposalDoesNotExist();
        return (
            proposalVendorAddress[proposalId],
            proposalVendorName[proposalId],
            proposalApprovalCount[proposalId],
            proposalExecuted[proposalId]
        );
    }

    function getIdentityProposalStatus(uint256 proposalId)
        external
        view
        returns (address applicant, string memory profileLinks, uint256 approvals, bool executed)
    {
        if (proposalId >= identityProposalCount) revert IdentityProposalDoesNotExist();
        return (
            identityProposalApplicant[proposalId],
            identityProposalLinks[proposalId],
            identityProposalApprovalCount[proposalId],
            identityProposalExecuted[proposalId]
        );
    }

    function getIdentityInfo(address wallet)
        external
        view
        returns (bool verified, string memory links)
    {
        return (verifiedIdentities[wallet], identityLinks[wallet]);
    }


    /// @notice Returns all recorded transactions for a campaign (donations,
    ///         withdrawals, vendor refunds), ordered oldest-first.
    function getTransactionsByCampaign(uint256 campaignId)
        external
        view
        campaignExists(campaignId)
        returns (Transaction[] memory)
    {
        return campaignTransactions[campaignId];
    }

    /// @notice Returns the number of transactions recorded for a campaign.
    function getTransactionCount(uint256 campaignId)
        external
        view
        campaignExists(campaignId)
        returns (uint256)
    {
        return campaignTransactions[campaignId].length;
    }

}
