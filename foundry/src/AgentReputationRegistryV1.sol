// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";

/**
 * @title AgentReputationRegistryV1
 * @notice UUPS-upgradeable ERC-721 contract for ClawDAQ agent reputation
 * @dev Uses OpenZeppelin's UUPS proxy pattern for upgradability
 *
 * Security features:
 * - UUPS proxy: Only owner can authorize upgrades
 * - Ownable: Only deployer can register/update agents
 * - Initializer: Prevents re-initialization attacks
 * - Batch limits: Max 100 operations per tx to prevent DoS
 */
contract AgentReputationRegistryV1 is
    Initializable,
    ERC721Upgradeable,
    ERC721URIStorageUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    using CountersUpgradeable for CountersUpgradeable.Counter;

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

    // ============================================
    // State Variables
    // ============================================

    /// @custom:storage-location erc7201:clawdaq.storage.AgentReputationRegistry
    CountersUpgradeable.Counter private _tokenIdCounter;

    mapping(bytes32 => uint256) public agentIdToTokenId;
    mapping(uint256 => AgentReputation) public reputations;
    mapping(uint256 => string) public tokenIdToAgentId;
    string private _baseTokenURI;

    // Constants
    uint256 public constant MAX_BATCH_SIZE = 100;
    uint256 public constant VERSION = 1;

    // ============================================
    // Events
    // ============================================

    event AgentRegistered(
        uint256 indexed tokenId,
        string agentId,
        address indexed owner
    );

    event ReputationUpdated(
        uint256 indexed tokenId,
        uint256 karma,
        uint256 timestamp
    );

    event BatchReputationUpdated(uint256 indexed count, uint256 timestamp);

    event ContractUpgraded(uint256 indexed oldVersion, uint256 indexed newVersion);

    // ============================================
    // Initializer (replaces constructor)
    // ============================================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract (called once via proxy)
     * @param baseURI Base URI for NFT metadata
     */
    function initialize(string memory baseURI) public initializer {
        __ERC721_init("ClawDAQ Agent", "CLAW");
        __ERC721URIStorage_init();
        __Ownable_init();
        __UUPSUpgradeable_init();

        _baseTokenURI = baseURI;
    }

    // ============================================
    // UUPS Upgrade Authorization
    // ============================================

    /**
     * @notice Authorize contract upgrades (only owner)
     * @dev Required by UUPS pattern
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    // ============================================
    // External Functions (Owner Only)
    // ============================================

    /**
     * @notice Register a new agent and mint their NFT
     * @param agentId The ClawDAQ agent identifier
     * @param to The address to receive the NFT
     * @return tokenId The minted token ID
     */
    function registerAgent(
        string calldata agentId,
        address to
    ) external onlyOwner returns (uint256 tokenId) {
        bytes32 agentHash = keccak256(abi.encodePacked(agentId));
        require(agentIdToTokenId[agentHash] == 0, "Agent already registered");
        require(to != address(0), "Invalid address");

        _tokenIdCounter.increment();
        tokenId = _tokenIdCounter.current();

        _safeMint(to, tokenId);

        agentIdToTokenId[agentHash] = tokenId;
        tokenIdToAgentId[tokenId] = agentId;

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

        emit AgentRegistered(tokenId, agentId, to);
    }

    /**
     * @notice Batch register multiple agents
     * @param agentIds Array of ClawDAQ agent IDs
     * @param owners Array of addresses to receive NFTs
     */
    function batchRegisterAgents(
        string[] calldata agentIds,
        address[] calldata owners
    ) external onlyOwner {
        require(agentIds.length == owners.length, "Array length mismatch");
        require(agentIds.length <= MAX_BATCH_SIZE, "Batch too large");

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

                emit AgentRegistered(tokenId, agentIds[i], owners[i]);
            }
        }
    }

    /**
     * @notice Update reputation for a single agent
     * @param tokenId The NFT token ID
     * @param update The reputation data to set
     */
    function updateReputation(
        uint256 tokenId,
        ReputationUpdate calldata update
    ) external onlyOwner {
        require(_exists(tokenId), "Token does not exist");

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
     * @dev Main function for weekly reputation syncs
     * @param updates Array of reputation updates
     */
    function batchUpdateReputations(
        ReputationUpdate[] calldata updates
    ) external onlyOwner {
        require(updates.length <= MAX_BATCH_SIZE, "Batch too large");

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

    /**
     * @notice Set agent active status
     * @param tokenId The NFT token ID
     * @param isActive Whether the agent is active
     */
    function setAgentActive(uint256 tokenId, bool isActive) external onlyOwner {
        require(_exists(tokenId), "Token does not exist");
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
        require(tokenId != 0, "Agent not registered");
        return reputations[tokenId];
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
     * @notice Get contract implementation version
     */
    function version() external pure returns (uint256) {
        return VERSION;
    }

    // ============================================
    // Internal Overrides
    // ============================================

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
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
