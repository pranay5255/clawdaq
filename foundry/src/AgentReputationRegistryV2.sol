// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/ISwapRouter.sol";

/**
 * @title AgentReputationRegistryV2
 * @notice UUPS-upgradeable ERC-721 contract with treasury, USDC payments, and Uniswap V3 swaps
 * @dev Extends V1 with:
 *      - Agent registration with $5 USDC payment
 *      - Treasury management ($4 stored, $1 swapped for tokens)
 *      - On-chain activity tracking
 *      - Uniswap V3 integration for token purchases
 *
 * Payment Flow:
 *   1. Agent calls registerAgentWithPayment() with USDC approval
 *   2. Contract takes $5 USDC
 *   3. $4 added to treasuryBalance (withdrawable by owner)
 *   4. $1 added to pendingSwapAmount (swapped for purchaseToken)
 *
 * Architecture:
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                 AgentReputationRegistryV2                        │
 *   │  ┌───────────────┐ ┌───────────────┐ ┌──────────────────────┐   │
 *   │  │   NFTs        │ │   Treasury    │ │   Activity Tracking  │   │
 *   │  │   Storage     │ │   USDC + Tokens│ │   (On-Chain Totals)  │   │
 *   │  └───────────────┘ └───────────────┘ └──────────────────────┘   │
 *   └─────────────────────────────────────────────────────────────────┘
 */
contract AgentReputationRegistryV2 is
    Initializable,
    ERC721Upgradeable,
    ERC721URIStorageUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using SafeERC20 for IERC20;

    // ============================================
    // Structs
    // ============================================

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
        uint256 tokenId;
        uint256 karma;
        uint256 questionsAsked;
        uint256 answersGiven;
        uint256 acceptedAnswers;
        uint256 upvotesReceived;
        uint256 downvotesReceived;
    }

    /// @notice Activity tracking for on-chain sync (simplified from DB)
    struct AgentActivity {
        uint256 questionsCount;
        uint256 answersCount;
        uint256 upvotesReceived;
        uint256 downvotesReceived;
        uint256 lastUpdated;
    }

    /// @notice Activity update for batch operations
    struct ActivityUpdate {
        uint256 tokenId;
        uint256 questionsCount;
        uint256 answersCount;
        uint256 upvotesReceived;
        uint256 downvotesReceived;
    }

    // ============================================
    // Constants
    // ============================================

    uint256 public constant REGISTRATION_FEE = 5_000_000; // $5 USDC (6 decimals)
    uint256 public constant SWAP_AMOUNT = 1_000_000;      // $1 USDC per registration
    uint24 public constant POOL_FEE = 3000;               // 0.3% Uniswap pool fee
    uint256 public constant MAX_BATCH_SIZE = 100;
    uint256 public constant VERSION = 2;

    // ============================================
    // State Variables
    // ============================================

    /// @custom:storage-location erc7201:clawdaq.storage.AgentReputationRegistryV2
    CountersUpgradeable.Counter private _tokenIdCounter;

    // Core mappings (inherited from V1)
    mapping(bytes32 => uint256) public agentIdToTokenId;
    mapping(uint256 => AgentReputation) public reputations;
    mapping(uint256 => string) public tokenIdToAgentId;
    string private _baseTokenURI;

    // Treasury state
    IERC20 public usdc;
    IERC20 public purchaseToken;
    ISwapRouter public swapRouter;

    uint256 public treasuryBalance;        // Accumulated $4 per agent (in USDC)
    uint256 public pendingSwapAmount;      // Accumulated $1 waiting to swap (in USDC)
    uint256 public totalTokensPurchased;   // Running total of purchased tokens

    // Activity tracking (simplified on-chain totals)
    mapping(uint256 => AgentActivity) public activities;

    // Slippage tolerance for swaps (in basis points, 100 = 1%)
    uint256 public slippageTolerance;

    // ============================================
    // Events
    // ============================================

    event AgentRegistered(
        uint256 indexed tokenId,
        string agentId,
        address indexed owner,
        uint256 registrationFee
    );

    event ReputationUpdated(
        uint256 indexed tokenId,
        uint256 karma,
        uint256 timestamp
    );

    event BatchReputationUpdated(uint256 indexed count, uint256 timestamp);

    event ContractUpgraded(uint256 indexed oldVersion, uint256 indexed newVersion);

    event ActivityUpdated(
        uint256 indexed tokenId,
        uint256 questionsCount,
        uint256 answersCount,
        uint256 timestamp
    );

    event BatchActivityUpdated(uint256 indexed count, uint256 timestamp);

    event TreasuryDeposited(uint256 amount);
    event TreasuryWithdrawn(uint256 amount, address indexed to);
    event SwapExecuted(
        uint256 usdcAmount,
        uint256 tokenAmountReceived,
        uint256 timestamp
    );

    event PurchaseTokenSet(address indexed token);
    event SwapRouterSet(address indexed router);
    event SlippageToleranceSet(uint256 tolerance);

    // ============================================
    // Errors
    // ============================================

    error AgentAlreadyRegistered();
    error InvalidAddress();
    error TokenDoesNotExist();
    error BatchTooLarge();
    error ArrayLengthMismatch();
    error InsufficientAllowance();
    error SwapFailed();
    error SlippageExceeded();
    error NoPendingSwaps();
    error TreasuryWithdrawalFailed();
    error InvalidToken();
    error InvalidSlippage();
    error ZeroAmount();

    // ============================================
    // Initializer
    // ============================================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract (called once via proxy)
     * @param baseURI Base URI for NFT metadata
     * @param _usdc USDC token address
     * @param _purchaseToken Token to purchase with $1 from each registration
     * @param _swapRouter Uniswap V3 swap router address
     */
    function initialize(
        string memory baseURI,
        address _usdc,
        address _purchaseToken,
        address _swapRouter
    ) public initializer {
        __ERC721_init("ClawDAQ Agent", "CLAW");
        __ERC721URIStorage_init();
        __Ownable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        _baseTokenURI = baseURI;

        if (_usdc == address(0) || _purchaseToken == address(0) || _swapRouter == address(0)) {
            revert InvalidAddress();
        }

        usdc = IERC20(_usdc);
        purchaseToken = IERC20(_purchaseToken);
        swapRouter = ISwapRouter(_swapRouter);
        slippageTolerance = 500; // 5% default slippage
    }

    // ============================================
    // UUPS Upgrade Authorization
    // ============================================

    /**
     * @notice Authorize contract upgrades (only owner)
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ============================================
    // Registration with Payment
    // ============================================

    /**
     * @notice Register a new agent with USDC payment
     * @param agentId The ClawDAQ agent identifier
     * @param to The address to receive the NFT
     * @return tokenId The minted token ID
     * @dev Requires USDC approval of at least REGISTRATION_FEE
     */
    function registerAgentWithPayment(
        string calldata agentId,
        address to
    ) external nonReentrant returns (uint256 tokenId) {
        bytes32 agentHash = keccak256(abi.encodePacked(agentId));
        if (agentIdToTokenId[agentHash] != 0) revert AgentAlreadyRegistered();
        if (to == address(0)) revert InvalidAddress();

        // Check and transfer USDC
        uint256 allowance = usdc.allowance(msg.sender, address(this));
        if (allowance < REGISTRATION_FEE) revert InsufficientAllowance();

        usdc.safeTransferFrom(msg.sender, address(this), REGISTRATION_FEE);

        // Split: $4 to treasury, $1 to pending swap
        treasuryBalance += REGISTRATION_FEE - SWAP_AMOUNT;
        pendingSwapAmount += SWAP_AMOUNT;

        // Mint NFT
        _tokenIdCounter.increment();
        tokenId = _tokenIdCounter.current();

        _safeMint(to, tokenId);

        agentIdToTokenId[agentHash] = tokenId;
        tokenIdToAgentId[tokenId] = agentId;

        // Initialize reputation
        reputations[tokenId] = AgentReputation({
            karma: 0,
            questionsAsked: 0,
            answersGiven: 0,
            acceptedAnswers: 0,
            upvotesReceived: 0,
            downvotesReceived: 0,
            lastUpdated: block.timestamp,
            isActive: true
        });

        // Initialize activity tracking
        activities[tokenId] = AgentActivity({
            questionsCount: 0,
            answersCount: 0,
            upvotesReceived: 0,
            downvotesReceived: 0,
            lastUpdated: block.timestamp
        });

        emit AgentRegistered(tokenId, agentId, to, REGISTRATION_FEE);
        emit TreasuryDeposited(REGISTRATION_FEE - SWAP_AMOUNT);
    }

    // ============================================
    // Batch Registration (Owner Only)
    // ============================================

    /**
     * @notice Batch register multiple agents (for migration/backfill)
     * @param agentIds Array of ClawDAQ agent IDs
     * @param owners Array of addresses to receive NFTs
     * @dev Does NOT require payment - use for existing agents or backfill
     */
    function batchRegisterAgents(
        string[] calldata agentIds,
        address[] calldata owners
    ) external onlyOwner {
        if (agentIds.length != owners.length) revert ArrayLengthMismatch();
        if (agentIds.length > MAX_BATCH_SIZE) revert BatchTooLarge();

        for (uint256 i = 0; i < agentIds.length; i++) {
            bytes32 agentHash = keccak256(abi.encodePacked(agentIds[i]));
            if (agentIdToTokenId[agentHash] == 0 && owners[i] != address(0)) {
                _tokenIdCounter.increment();
                uint256 tokenId = _tokenIdCounter.current();

                _safeMint(owners[i], tokenId);

                agentIdToTokenId[agentHash] = tokenId;
                tokenIdToAgentId[tokenId] = agentIds[i];

                reputations[tokenId] = AgentReputation({
                    karma: 0,
                    questionsAsked: 0,
                    answersGiven: 0,
                    acceptedAnswers: 0,
                    upvotesReceived: 0,
                    downvotesReceived: 0,
                    lastUpdated: block.timestamp,
                    isActive: true
                });

                activities[tokenId] = AgentActivity({
                    questionsCount: 0,
                    answersCount: 0,
                    upvotesReceived: 0,
                    downvotesReceived: 0,
                    lastUpdated: block.timestamp
                });

                emit AgentRegistered(tokenId, agentIds[i], owners[i], 0);
            }
        }
    }

    // ============================================
    // Reputation Updates (Owner Only)
    // ============================================

    /**
     * @notice Update reputation for a single agent
     * @param tokenId The NFT token ID
     * @param update The reputation data to set
     */
    function updateReputation(
        uint256 tokenId,
        ReputationUpdate calldata update
    ) external onlyOwner {
        if (!_exists(tokenId)) revert TokenDoesNotExist();

        AgentReputation storage rep = reputations[tokenId];
        rep.karma = update.karma;
        rep.questionsAsked = update.questionsAsked;
        rep.answersGiven = update.answersGiven;
        rep.acceptedAnswers = update.acceptedAnswers;
        rep.upvotesReceived = update.upvotesReceived;
        rep.downvotesReceived = update.downvotesReceived;
        rep.lastUpdated = block.timestamp;

        emit ReputationUpdated(tokenId, update.karma, block.timestamp);
    }

    /**
     * @notice Batch update reputations for multiple agents
     * @param updates Array of reputation updates
     */
    function batchUpdateReputations(
        ReputationUpdate[] calldata updates
    ) external onlyOwner {
        if (updates.length > MAX_BATCH_SIZE) revert BatchTooLarge();

        for (uint256 i = 0; i < updates.length; i++) {
            if (_exists(updates[i].tokenId)) {
                AgentReputation storage rep = reputations[updates[i].tokenId];
                rep.karma = updates[i].karma;
                rep.questionsAsked = updates[i].questionsAsked;
                rep.answersGiven = updates[i].answersGiven;
                rep.acceptedAnswers = updates[i].acceptedAnswers;
                rep.upvotesReceived = updates[i].upvotesReceived;
                rep.downvotesReceived = updates[i].downvotesReceived;
                rep.lastUpdated = block.timestamp;

                emit ReputationUpdated(
                    updates[i].tokenId,
                    updates[i].karma,
                    block.timestamp
                );
            }
        }

        emit BatchReputationUpdated(updates.length, block.timestamp);
    }

    // ============================================
    // Activity Tracking (Owner Only)
    // ============================================

    /**
     * @notice Update activity for a single agent
     * @param tokenId The NFT token ID
     * @param questionsCount Total questions asked
     * @param answersCount Total answers given
     * @param upvotesReceived Total upvotes
     * @param downvotesReceived Total downvotes
     */
    function updateAgentActivity(
        uint256 tokenId,
        uint256 questionsCount,
        uint256 answersCount,
        uint256 upvotesReceived,
        uint256 downvotesReceived
    ) external onlyOwner {
        if (!_exists(tokenId)) revert TokenDoesNotExist();

        AgentActivity storage activity = activities[tokenId];
        activity.questionsCount = questionsCount;
        activity.answersCount = answersCount;
        activity.upvotesReceived = upvotesReceived;
        activity.downvotesReceived = downvotesReceived;
        activity.lastUpdated = block.timestamp;

        emit ActivityUpdated(tokenId, questionsCount, answersCount, block.timestamp);
    }

    /**
     * @notice Batch update activities for multiple agents
     * @param updates Array of activity updates
     */
    function batchUpdateActivities(
        ActivityUpdate[] calldata updates
    ) external onlyOwner {
        if (updates.length > MAX_BATCH_SIZE) revert BatchTooLarge();

        for (uint256 i = 0; i < updates.length; i++) {
            if (_exists(updates[i].tokenId)) {
                AgentActivity storage activity = activities[updates[i].tokenId];
                activity.questionsCount = updates[i].questionsCount;
                activity.answersCount = updates[i].answersCount;
                activity.upvotesReceived = updates[i].upvotesReceived;
                activity.downvotesReceived = updates[i].downvotesReceived;
                activity.lastUpdated = block.timestamp;

                emit ActivityUpdated(
                    updates[i].tokenId,
                    updates[i].questionsCount,
                    updates[i].answersCount,
                    block.timestamp
                );
            }
        }

        emit BatchActivityUpdated(updates.length, block.timestamp);
    }

    // ============================================
    // Treasury Management
    // ============================================

    /**
     * @notice Execute pending swaps to purchase tokens
     * @param minAmountOut Minimum tokens to receive (slippage protection)
     * @return amountOut Amount of tokens received
     */
    function executePendingSwap(
        uint256 minAmountOut
    ) external onlyOwner nonReentrant returns (uint256 amountOut) {
        if (pendingSwapAmount == 0) revert NoPendingSwaps();
        if (address(purchaseToken) == address(0)) revert InvalidToken();
        if (address(swapRouter) == address(0)) revert InvalidAddress();

        uint256 amountToSwap = pendingSwapAmount;
        pendingSwapAmount = 0;

        // Approve router
        usdc.safeApprove(address(swapRouter), amountToSwap);

        // Execute swap
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: address(usdc),
                tokenOut: address(purchaseToken),
                fee: POOL_FEE,
                recipient: address(this),
                deadline: block.timestamp + 300, // 5 minute deadline
                amountIn: amountToSwap,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0
            });

        amountOut = swapRouter.exactInputSingle(params);

        if (amountOut < minAmountOut) revert SlippageExceeded();

        totalTokensPurchased += amountOut;

        emit SwapExecuted(amountToSwap, amountOut, block.timestamp);
    }

    /**
     * @notice Withdraw USDC from treasury
     * @param amount Amount to withdraw (in USDC smallest unit)
     * @param to Recipient address
     */
    function withdrawTreasury(
        uint256 amount,
        address to
    ) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert InvalidAddress();
        if (amount > treasuryBalance) revert TreasuryWithdrawalFailed();

        treasuryBalance -= amount;

        usdc.safeTransfer(to, amount);

        emit TreasuryWithdrawn(amount, to);
    }

    /**
     * @notice Withdraw purchased tokens from treasury
     * @param amount Amount to withdraw (in token smallest unit)
     * @param to Recipient address
     */
    function withdrawTokens(
        uint256 amount,
        address to
    ) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert InvalidAddress();

        uint256 tokenBalance = purchaseToken.balanceOf(address(this));
        if (amount > tokenBalance) revert TreasuryWithdrawalFailed();

        purchaseToken.safeTransfer(to, amount);

        emit TreasuryWithdrawn(amount, to);
    }

    // ============================================
    // Configuration (Owner Only)
    // ============================================

    /**
     * @notice Set the token to purchase with $1 swaps
     * @param _purchaseToken Token address
     */
    function setPurchaseToken(address _purchaseToken) external onlyOwner {
        if (_purchaseToken == address(0)) revert InvalidToken();
        purchaseToken = IERC20(_purchaseToken);
        emit PurchaseTokenSet(_purchaseToken);
    }

    /**
     * @notice Set the Uniswap V3 swap router
     * @param _swapRouter Router address
     */
    function setSwapRouter(address _swapRouter) external onlyOwner {
        if (_swapRouter == address(0)) revert InvalidAddress();
        swapRouter = ISwapRouter(_swapRouter);
        emit SwapRouterSet(_swapRouter);
    }

    /**
     * @notice Set slippage tolerance for swaps
     * @param _tolerance Tolerance in basis points (100 = 1%)
     */
    function setSlippageTolerance(uint256 _tolerance) external onlyOwner {
        if (_tolerance > 1000) revert InvalidSlippage(); // Max 10%
        slippageTolerance = _tolerance;
        emit SlippageToleranceSet(_tolerance);
    }

    /**
     * @notice Set agent active status
     * @param tokenId The NFT token ID
     * @param isActive Whether the agent is active
     */
    function setAgentActive(uint256 tokenId, bool isActive) external onlyOwner {
        if (!_exists(tokenId)) revert TokenDoesNotExist();
        reputations[tokenId].isActive = isActive;
    }

    /**
     * @notice Update base URI for metadata
     * @param baseURI New base URI
     */
    function setBaseURI(string calldata baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }

    // ============================================
    // View Functions
    // ============================================

    /**
     * @notice Get reputation for an agent by ClawDAQ ID
     * @param agentId The ClawDAQ agent identifier
     * @return reputation The agent's reputation data
     */
    function getReputationByAgentId(
        string calldata agentId
    ) external view returns (AgentReputation memory reputation) {
        bytes32 agentHash = keccak256(abi.encodePacked(agentId));
        uint256 tokenId = agentIdToTokenId[agentHash];
        if (tokenId == 0) revert TokenDoesNotExist();
        return reputations[tokenId];
    }

    /**
     * @notice Get activity for an agent by ClawDAQ ID
     * @param agentId The ClawDAQ agent identifier
     * @return activity The agent's activity data
     */
    function getActivityByAgentId(
        string calldata agentId
    ) external view returns (AgentActivity memory activity) {
        bytes32 agentHash = keccak256(abi.encodePacked(agentId));
        uint256 tokenId = agentIdToTokenId[agentHash];
        if (tokenId == 0) revert TokenDoesNotExist();
        return activities[tokenId];
    }

    /**
     * @notice Get token ID for a ClawDAQ agent ID
     * @param agentId The ClawDAQ agent identifier
     * @return tokenId The NFT token ID (0 if not registered)
     */
    function getTokenId(
        string calldata agentId
    ) external view returns (uint256 tokenId) {
        bytes32 agentHash = keccak256(abi.encodePacked(agentId));
        return agentIdToTokenId[agentHash];
    }

    /**
     * @notice Get total number of registered agents
     * @return count Total registered agents
     */
    function totalAgents() external view returns (uint256 count) {
        return _tokenIdCounter.current();
    }

    /**
     * @notice Check if an agent is registered
     * @param agentId The ClawDAQ agent identifier
     * @return isRegistered Whether the agent has an NFT
     */
    function isAgentRegistered(
        string calldata agentId
    ) external view returns (bool isRegistered) {
        bytes32 agentHash = keccak256(abi.encodePacked(agentId));
        return agentIdToTokenId[agentHash] != 0;
    }

    /**
     * @notice Get complete treasury state
     * @return _treasuryBalance USDC in treasury
     * @return _pendingSwapAmount USDC pending swap
     * @return _tokenBalance Purchased token balance
     * @return _totalTokensPurchased Total tokens ever purchased
     */
    function getTreasuryState()
        external
        view
        returns (
            uint256 _treasuryBalance,
            uint256 _pendingSwapAmount,
            uint256 _tokenBalance,
            uint256 _totalTokensPurchased
        )
    {
        return (
            treasuryBalance,
            pendingSwapAmount,
            purchaseToken.balanceOf(address(this)),
            totalTokensPurchased
        );
    }

    /**
     * @notice Get contract implementation version
     */
    function version() external pure returns (uint256) {
        return VERSION;
    }

    /**
     * @notice Calculate minimum output for swap with slippage
     * @param expectedOutput Expected output from quote
     * @return minOutput Minimum acceptable output
     */
    function calculateMinOutput(
        uint256 expectedOutput
    ) external view returns (uint256 minOutput) {
        return expectedOutput * (10000 - slippageTolerance) / 10000;
    }

    // ============================================
    // Internal Overrides
    // ============================================

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function _exists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    function _burn(
        uint256 tokenId
    ) internal override(ERC721Upgradeable, ERC721URIStorageUpgradeable) {
        super._burn(tokenId);
    }

    function tokenURI(
        uint256 tokenId
    )
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
