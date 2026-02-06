// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/**
 * @title Agent0CustodialRegistry
 * @notice Custodial registry for Agent0 identities with on-chain reputation and treasury.
 * @dev Holds Agent0 NFTs as a custodian (via safe mint/transfer) and stores payer EOA + reputation.
 */
contract Agent0CustodialRegistry is Ownable, ReentrancyGuard, IERC721Receiver {
    using SafeERC20 for IERC20;
    struct AgentReputation {
        uint256 karma;
        uint256 questionsAsked;
        uint256 answersGiven;
        uint256 acceptedAnswers;
        uint256 upvotesReceived;
        uint256 downvotesReceived;
        uint256 lastUpdated;
        bool isActive;
    }

    struct ReputationUpdate {
        uint256 agentId;
        uint256 karma;
        uint256 questionsAsked;
        uint256 answersGiven;
        uint256 acceptedAnswers;
        uint256 upvotesReceived;
        uint256 downvotesReceived;
    }

    struct AgentActivity {
        uint256 questionsCount;
        uint256 answersCount;
        uint256 upvotesReceived;
        uint256 downvotesReceived;
        uint256 lastUpdated;
    }

    struct ActivityUpdate {
        uint256 agentId;
        uint256 questionsCount;
        uint256 answersCount;
        uint256 upvotesReceived;
        uint256 downvotesReceived;
    }

    struct AgentRecord {
        address payerEoa;
        string agentUri;
        uint256 registeredAt;
        bool isActive;
    }

    uint256 public constant REGISTRATION_FEE = 5_000_000; // $5 USDC (6 decimals)
    uint256 public constant MAX_BATCH_SIZE = 200;

    IERC20 public usdc;
    uint256 public totalAgents;

    mapping(uint256 => AgentRecord) public agents;
    mapping(uint256 => AgentReputation) public reputations;
    mapping(uint256 => AgentActivity) public activities;

    event AgentRegistered(
        uint256 indexed agentId,
        uint256 indexed tokenId,
        address indexed payerEoa,
        string agentUri
    );
    event AgentUriUpdated(uint256 indexed agentId, string agentUri);
    event AgentActiveUpdated(uint256 indexed agentId, bool isActive);
    event ReputationUpdated(uint256 indexed agentId, uint256 karma, uint256 timestamp);
    event BatchReputationUpdated(uint256 count, uint256 timestamp);
    event ActivityUpdated(uint256 indexed agentId, uint256 questionsCount, uint256 answersCount, uint256 timestamp);
    event BatchActivityUpdated(uint256 count, uint256 timestamp);
    event TreasuryWithdrawn(uint256 amount, address indexed to);

    error AgentAlreadyRegistered();
    error InvalidAddress();
    error ZeroAmount();
    error TokenDoesNotExist();
    error ArrayLengthMismatch();
    error BatchTooLarge();
    error TreasuryWithdrawalFailed();
    error InvalidAgentId();

    constructor(address usdcAddress, address initialOwner) Ownable(initialOwner) {
        if (usdcAddress == address(0)) revert InvalidAddress();
        usdc = IERC20(usdcAddress);
    }

    // ============================================
    // Registration (Owner Only)
    // ============================================

    /**
     * @notice Register an Agent0 identity after payment verification.
     * @param agentId Agent0 token ID
     * @param payerEoa Wallet that paid the $5 USDC registration
     * @param agentUri IPFS metadata URI
     */
    function registerAgent(
        uint256 agentId,
        address payerEoa,
        string calldata agentUri
    ) external onlyOwner {
        if (agentId == 0) revert InvalidAgentId();
        if (payerEoa == address(0)) revert InvalidAddress();
        if (agents[agentId].registeredAt != 0) revert AgentAlreadyRegistered();

        agents[agentId] = AgentRecord({
            payerEoa: payerEoa,
            agentUri: agentUri,
            registeredAt: block.timestamp,
            isActive: true
        });

        reputations[agentId] = AgentReputation({
            karma: 0,
            questionsAsked: 0,
            answersGiven: 0,
            acceptedAnswers: 0,
            upvotesReceived: 0,
            downvotesReceived: 0,
            lastUpdated: block.timestamp,
            isActive: true
        });

        activities[agentId] = AgentActivity({
            questionsCount: 0,
            answersCount: 0,
            upvotesReceived: 0,
            downvotesReceived: 0,
            lastUpdated: block.timestamp
        });

        totalAgents += 1;

        emit AgentRegistered(agentId, agentId, payerEoa, agentUri);
    }

    function setAgentUri(uint256 agentId, string calldata agentUri) external onlyOwner {
        if (agents[agentId].registeredAt == 0) revert TokenDoesNotExist();
        agents[agentId].agentUri = agentUri;
        emit AgentUriUpdated(agentId, agentUri);
    }

    function setAgentActive(uint256 agentId, bool isActive) external onlyOwner {
        if (agents[agentId].registeredAt == 0) revert TokenDoesNotExist();
        agents[agentId].isActive = isActive;
        reputations[agentId].isActive = isActive;
        emit AgentActiveUpdated(agentId, isActive);
    }

    // ============================================
    // Reputation Updates (Owner Only)
    // ============================================

    function updateReputation(uint256 agentId, ReputationUpdate calldata update) external onlyOwner {
        if (agents[agentId].registeredAt == 0) revert TokenDoesNotExist();

        AgentReputation storage rep = reputations[agentId];
        rep.karma = update.karma;
        rep.questionsAsked = update.questionsAsked;
        rep.answersGiven = update.answersGiven;
        rep.acceptedAnswers = update.acceptedAnswers;
        rep.upvotesReceived = update.upvotesReceived;
        rep.downvotesReceived = update.downvotesReceived;
        rep.lastUpdated = block.timestamp;

        emit ReputationUpdated(agentId, update.karma, block.timestamp);
    }

    function batchUpdateReputations(ReputationUpdate[] calldata updates) external onlyOwner {
        if (updates.length > MAX_BATCH_SIZE) revert BatchTooLarge();

        for (uint256 i = 0; i < updates.length; i++) {
            uint256 agentId = updates[i].agentId;
            if (agents[agentId].registeredAt == 0) continue;

            AgentReputation storage rep = reputations[agentId];
            rep.karma = updates[i].karma;
            rep.questionsAsked = updates[i].questionsAsked;
            rep.answersGiven = updates[i].answersGiven;
            rep.acceptedAnswers = updates[i].acceptedAnswers;
            rep.upvotesReceived = updates[i].upvotesReceived;
            rep.downvotesReceived = updates[i].downvotesReceived;
            rep.lastUpdated = block.timestamp;

            emit ReputationUpdated(agentId, updates[i].karma, block.timestamp);
        }

        emit BatchReputationUpdated(updates.length, block.timestamp);
    }

    // ============================================
    // Activity Tracking (Owner Only)
    // ============================================

    function updateAgentActivity(
        uint256 agentId,
        uint256 questionsCount,
        uint256 answersCount,
        uint256 upvotesReceived,
        uint256 downvotesReceived
    ) external onlyOwner {
        if (agents[agentId].registeredAt == 0) revert TokenDoesNotExist();

        AgentActivity storage activity = activities[agentId];
        activity.questionsCount = questionsCount;
        activity.answersCount = answersCount;
        activity.upvotesReceived = upvotesReceived;
        activity.downvotesReceived = downvotesReceived;
        activity.lastUpdated = block.timestamp;

        emit ActivityUpdated(agentId, questionsCount, answersCount, block.timestamp);
    }

    function batchUpdateActivities(ActivityUpdate[] calldata updates) external onlyOwner {
        if (updates.length > MAX_BATCH_SIZE) revert BatchTooLarge();

        for (uint256 i = 0; i < updates.length; i++) {
            uint256 agentId = updates[i].agentId;
            if (agents[agentId].registeredAt == 0) continue;

            AgentActivity storage activity = activities[agentId];
            activity.questionsCount = updates[i].questionsCount;
            activity.answersCount = updates[i].answersCount;
            activity.upvotesReceived = updates[i].upvotesReceived;
            activity.downvotesReceived = updates[i].downvotesReceived;
            activity.lastUpdated = block.timestamp;

            emit ActivityUpdated(agentId, updates[i].questionsCount, updates[i].answersCount, block.timestamp);
        }

        emit BatchActivityUpdated(updates.length, block.timestamp);
    }

    // ============================================
    // Treasury Management
    // ============================================

    function treasuryBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function withdrawTreasury(uint256 amount, address to) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert InvalidAddress();

        uint256 balance = usdc.balanceOf(address(this));
        if (amount > balance) revert TreasuryWithdrawalFailed();

        usdc.safeTransfer(to, amount);
        emit TreasuryWithdrawn(amount, to);
    }

    // ============================================
    // ERC-721 Receiver (Custodial NFTs)
    // ============================================

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
