// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/Agent0CustodialRegistry.sol";

/**
 * @title MockERC20
 * @notice Mock USDC token for testing
 */
contract MockERC20 is IERC20 {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

/**
 * @title MockIdentityRegistry
 * @notice Simulates the canonical ERC-8004 IdentityRegistry for testing.
 *         Mimics register() -> _safeMint(msg.sender, agentId) behavior.
 */
contract MockIdentityRegistry is IERC8004IdentityRegistry {
    uint256 private _lastId;
    mapping(uint256 => address) private _owners;
    mapping(uint256 => string) private _uris;
    mapping(uint256 => address) private _wallets;

    function register(string memory agentURI) external returns (uint256 agentId) {
        agentId = _lastId++;
        _owners[agentId] = msg.sender;
        _uris[agentId] = agentURI;
        _wallets[agentId] = msg.sender;

        // Simulate _safeMint callback (ERC-721 safe transfer check)
        if (msg.sender.code.length > 0) {
            bytes4 retval = IERC721Receiver(msg.sender).onERC721Received(
                address(this), address(0), agentId, ""
            );
            require(retval == IERC721Receiver.onERC721Received.selector, "ERC721: transfer rejected");
        }
    }

    function setAgentURI(uint256 agentId, string calldata newURI) external {
        require(_owners[agentId] == msg.sender, "Not authorized");
        _uris[agentId] = newURI;
    }

    function getAgentWallet(uint256 agentId) external view returns (address) {
        return _wallets[agentId];
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        return _uris[tokenId];
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        return _owners[tokenId];
    }

    /// @notice Helper to check current counter (for test assertions)
    function lastId() external view returns (uint256) {
        return _lastId;
    }
}

/**
 * @title Agent0CustodialRegistryTest
 * @notice Comprehensive test suite for Agent0CustodialRegistry with ERC-8004 integration
 */
contract Agent0CustodialRegistryTest is Test {
    Agent0CustodialRegistry public registry;
    MockERC20 public usdc;
    MockIdentityRegistry public identityReg;

    address public owner;
    address public agent1;
    address public agent2;
    address public agent3;
    address public treasury;

    uint256 public constant REGISTRATION_FEE = 5_000_000; // $5 USDC

    event AgentRegistered(uint256 indexed agentId, uint256 indexed tokenId, address indexed payerEoa, string agentUri);
    event AgentUriUpdated(uint256 indexed agentId, string agentUri);
    event AgentActiveUpdated(uint256 indexed agentId, bool isActive);
    event ReputationUpdated(uint256 indexed agentId, uint256 karma, uint256 timestamp);
    event BatchReputationUpdated(uint256 count, uint256 timestamp);
    event ActivityUpdated(uint256 indexed agentId, uint256 questionsCount, uint256 answersCount, uint256 timestamp);
    event BatchActivityUpdated(uint256 count, uint256 timestamp);
    event TreasuryWithdrawn(uint256 amount, address indexed to);

    function setUp() public {
        owner = address(this);
        agent1 = makeAddr("agent1");
        agent2 = makeAddr("agent2");
        agent3 = makeAddr("agent3");
        treasury = makeAddr("treasury");

        // Deploy mocks
        usdc = new MockERC20("USD Coin", "USDC", 6);
        identityReg = new MockIdentityRegistry();

        // Deploy registry with identity registry reference
        registry = new Agent0CustodialRegistry(address(usdc), address(identityReg), owner);

        // Mint USDC to test addresses
        usdc.mint(agent1, 100_000_000); // $100 USDC
        usdc.mint(agent2, 100_000_000);
        usdc.mint(agent3, 100_000_000);
    }

    // ============================================
    // Constructor Tests
    // ============================================

    function test_Constructor() public view {
        assertEq(address(registry.usdc()), address(usdc));
        assertEq(address(registry.identityRegistry()), address(identityReg));
        assertEq(registry.totalAgents(), 0);
        assertEq(registry.REGISTRATION_FEE(), REGISTRATION_FEE);
        assertEq(registry.MAX_BATCH_SIZE(), 200);
    }

    function test_Constructor_RevertInvalidUsdcAddress() public {
        vm.expectRevert(Agent0CustodialRegistry.InvalidAddress.selector);
        new Agent0CustodialRegistry(address(0), address(identityReg), owner);
    }

    function test_Constructor_RevertInvalidIdentityRegistryAddress() public {
        vm.expectRevert(Agent0CustodialRegistry.InvalidAddress.selector);
        new Agent0CustodialRegistry(address(usdc), address(0), owner);
    }

    // ============================================
    // Registration Tests
    // ============================================

    function test_RegisterAgent() public {
        string memory agentUri = "https://api.clawdaq.xyz/agents/1/registration.json";

        // First agent gets agentId=0 from ERC-8004 (starts at 0)
        vm.expectEmit(true, true, true, true);
        emit AgentRegistered(0, 0, agent1, agentUri);

        uint256 agentId = registry.registerAgent(agent1, agentUri);
        assertEq(agentId, 0);

        // Verify agent record
        (address payerEoa, string memory uri, uint256 registeredAt, bool isActive) = registry.agents(agentId);
        assertEq(payerEoa, agent1);
        assertEq(uri, agentUri);
        assertGt(registeredAt, 0);
        assertTrue(isActive);

        // Verify reputation initialized
        (
            uint256 karma,
            uint256 questionsAsked,
            uint256 answersGiven,
            uint256 acceptedAnswers,
            uint256 upvotesReceived,
            uint256 downvotesReceived,
            uint256 lastUpdated,
            bool repActive
        ) = registry.reputations(agentId);

        assertEq(karma, 0);
        assertEq(questionsAsked, 0);
        assertEq(answersGiven, 0);
        assertEq(acceptedAnswers, 0);
        assertEq(upvotesReceived, 0);
        assertEq(downvotesReceived, 0);
        assertGt(lastUpdated, 0);
        assertTrue(repActive);

        // Verify activity initialized
        (
            uint256 questionsCount,
            uint256 answersCount,
            uint256 upvotes,
            uint256 downvotes,
            uint256 activityLastUpdated
        ) = registry.activities(agentId);

        assertEq(questionsCount, 0);
        assertEq(answersCount, 0);
        assertEq(upvotes, 0);
        assertEq(downvotes, 0);
        assertGt(activityLastUpdated, 0);

        assertEq(registry.totalAgents(), 1);
    }

    function test_RegisterAgent_MintedToContract() public {
        uint256 agentId = registry.registerAgent(agent1, "https://example.com/agent");

        // NFT should be owned by the CustodialRegistry contract
        address nftOwner = identityReg.ownerOf(agentId);
        assertEq(nftOwner, address(registry));
    }

    function test_RegisterAgent_UriStoredOnIdentityRegistry() public {
        string memory uri = "https://api.clawdaq.xyz/agents/test/registration.json";
        uint256 agentId = registry.registerAgent(agent1, uri);

        // URI should be set on the IdentityRegistry
        string memory storedUri = identityReg.tokenURI(agentId);
        assertEq(storedUri, uri);
    }

    function test_RegisterAgent_RevertZeroAddress() public {
        vm.expectRevert(Agent0CustodialRegistry.InvalidAddress.selector);
        registry.registerAgent(address(0), "https://example.com/agent");
    }

    function test_RegisterAgent_RevertNotOwner() public {
        vm.prank(agent1);
        vm.expectRevert();
        registry.registerAgent(agent1, "https://example.com/agent");
    }

    function test_RegisterMultipleAgents() public {
        uint256 id0 = registry.registerAgent(agent1, "https://example.com/agent0");
        uint256 id1 = registry.registerAgent(agent2, "https://example.com/agent1");
        uint256 id2 = registry.registerAgent(agent3, "https://example.com/agent2");

        // ERC-8004 assigns sequential IDs starting from 0
        assertEq(id0, 0);
        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(registry.totalAgents(), 3);
    }

    function test_RegisterAgent_AgentIdStartsFromZero() public {
        // ERC-8004 IdentityRegistry uses _lastId++ (post-increment), starting from 0
        uint256 agentId = registry.registerAgent(agent1, "https://example.com/agent");
        assertEq(agentId, 0);
    }

    // ============================================
    // Agent URI Update Tests
    // ============================================

    function test_SetAgentUri() public {
        uint256 agentId = registry.registerAgent(agent1, "https://example.com/old");

        string memory newUri = "https://example.com/new";
        vm.expectEmit(true, true, true, true);
        emit AgentUriUpdated(agentId, newUri);

        registry.setAgentUri(agentId, newUri);

        // Local storage updated
        (, string memory uri,,) = registry.agents(agentId);
        assertEq(uri, newUri);

        // IdentityRegistry also updated
        string memory identityUri = identityReg.tokenURI(agentId);
        assertEq(identityUri, newUri);
    }

    function test_SetAgentUri_RevertTokenDoesNotExist() public {
        vm.expectRevert(Agent0CustodialRegistry.TokenDoesNotExist.selector);
        registry.setAgentUri(999, "https://example.com/new");
    }

    function test_SetAgentUri_RevertNotOwner() public {
        registry.registerAgent(agent1, "https://example.com/old");

        vm.prank(agent1);
        vm.expectRevert();
        registry.setAgentUri(0, "https://example.com/new");
    }

    // ============================================
    // Agent Active Status Tests
    // ============================================

    function test_SetAgentActive() public {
        uint256 agentId = registry.registerAgent(agent1, "https://example.com/agent");

        vm.expectEmit(true, true, true, true);
        emit AgentActiveUpdated(agentId, false);

        registry.setAgentActive(agentId, false);

        (,,, bool isActive) = registry.agents(agentId);
        assertFalse(isActive);

        (,,,,,,, bool repActive) = registry.reputations(agentId);
        assertFalse(repActive);
    }

    function test_SetAgentActive_RevertTokenDoesNotExist() public {
        vm.expectRevert(Agent0CustodialRegistry.TokenDoesNotExist.selector);
        registry.setAgentActive(999, false);
    }

    // ============================================
    // Reputation Update Tests
    // ============================================

    function test_UpdateReputation() public {
        uint256 agentId = registry.registerAgent(agent1, "https://example.com/agent");

        Agent0CustodialRegistry.ReputationUpdate memory update = Agent0CustodialRegistry.ReputationUpdate({
            agentId: agentId,
            karma: 100,
            questionsAsked: 5,
            answersGiven: 10,
            acceptedAnswers: 3,
            upvotesReceived: 50,
            downvotesReceived: 2
        });

        vm.expectEmit(true, true, true, true);
        emit ReputationUpdated(agentId, 100, block.timestamp);

        registry.updateReputation(agentId, update);

        (
            uint256 karma,
            uint256 questionsAsked,
            uint256 answersGiven,
            uint256 acceptedAnswers,
            uint256 upvotesReceived,
            uint256 downvotesReceived,
            ,
        ) = registry.reputations(agentId);

        assertEq(karma, 100);
        assertEq(questionsAsked, 5);
        assertEq(answersGiven, 10);
        assertEq(acceptedAnswers, 3);
        assertEq(upvotesReceived, 50);
        assertEq(downvotesReceived, 2);
    }

    function test_UpdateReputation_RevertTokenDoesNotExist() public {
        Agent0CustodialRegistry.ReputationUpdate memory update = Agent0CustodialRegistry.ReputationUpdate({
            agentId: 999,
            karma: 100,
            questionsAsked: 5,
            answersGiven: 10,
            acceptedAnswers: 3,
            upvotesReceived: 50,
            downvotesReceived: 2
        });

        vm.expectRevert(Agent0CustodialRegistry.TokenDoesNotExist.selector);
        registry.updateReputation(999, update);
    }

    function test_BatchUpdateReputations() public {
        // Register 3 agents (IDs: 0, 1, 2)
        uint256 id0 = registry.registerAgent(agent1, "https://example.com/agent0");
        uint256 id1 = registry.registerAgent(agent2, "https://example.com/agent1");
        uint256 id2 = registry.registerAgent(agent3, "https://example.com/agent2");

        Agent0CustodialRegistry.ReputationUpdate[] memory updates = new Agent0CustodialRegistry.ReputationUpdate[](3);

        updates[0] = Agent0CustodialRegistry.ReputationUpdate({
            agentId: id0,
            karma: 100,
            questionsAsked: 5,
            answersGiven: 10,
            acceptedAnswers: 3,
            upvotesReceived: 50,
            downvotesReceived: 2
        });

        updates[1] = Agent0CustodialRegistry.ReputationUpdate({
            agentId: id1,
            karma: 200,
            questionsAsked: 10,
            answersGiven: 20,
            acceptedAnswers: 5,
            upvotesReceived: 100,
            downvotesReceived: 5
        });

        updates[2] = Agent0CustodialRegistry.ReputationUpdate({
            agentId: id2,
            karma: 50,
            questionsAsked: 2,
            answersGiven: 5,
            acceptedAnswers: 1,
            upvotesReceived: 25,
            downvotesReceived: 1
        });

        vm.expectEmit(true, true, true, true);
        emit BatchReputationUpdated(3, block.timestamp);

        registry.batchUpdateReputations(updates);

        (uint256 karma0,,,,,,,) = registry.reputations(id0);
        assertEq(karma0, 100);

        (uint256 karma1,,,,,,,) = registry.reputations(id1);
        assertEq(karma1, 200);

        (uint256 karma2,,,,,,,) = registry.reputations(id2);
        assertEq(karma2, 50);
    }

    function test_BatchUpdateReputations_SkipsNonExistentAgents() public {
        uint256 agentId = registry.registerAgent(agent1, "https://example.com/agent");

        Agent0CustodialRegistry.ReputationUpdate[] memory updates = new Agent0CustodialRegistry.ReputationUpdate[](2);

        updates[0] = Agent0CustodialRegistry.ReputationUpdate({
            agentId: agentId,
            karma: 100,
            questionsAsked: 5,
            answersGiven: 10,
            acceptedAnswers: 3,
            upvotesReceived: 50,
            downvotesReceived: 2
        });

        updates[1] = Agent0CustodialRegistry.ReputationUpdate({
            agentId: 999, // Non-existent
            karma: 200,
            questionsAsked: 10,
            answersGiven: 20,
            acceptedAnswers: 5,
            upvotesReceived: 100,
            downvotesReceived: 5
        });

        // Should not revert, just skip the non-existent agent
        registry.batchUpdateReputations(updates);

        (uint256 karma,,,,,,,) = registry.reputations(agentId);
        assertEq(karma, 100);
    }

    function test_BatchUpdateReputations_RevertBatchTooLarge() public {
        Agent0CustodialRegistry.ReputationUpdate[] memory updates = new Agent0CustodialRegistry.ReputationUpdate[](201);

        vm.expectRevert(Agent0CustodialRegistry.BatchTooLarge.selector);
        registry.batchUpdateReputations(updates);
    }

    // ============================================
    // Activity Update Tests
    // ============================================

    function test_UpdateAgentActivity() public {
        uint256 agentId = registry.registerAgent(agent1, "https://example.com/agent");

        vm.expectEmit(true, true, true, true);
        emit ActivityUpdated(agentId, 10, 20, block.timestamp);

        registry.updateAgentActivity(agentId, 10, 20, 50, 5);

        (
            uint256 questionsCount,
            uint256 answersCount,
            uint256 upvotesReceived,
            uint256 downvotesReceived,
        ) = registry.activities(agentId);

        assertEq(questionsCount, 10);
        assertEq(answersCount, 20);
        assertEq(upvotesReceived, 50);
        assertEq(downvotesReceived, 5);
    }

    function test_UpdateAgentActivity_RevertTokenDoesNotExist() public {
        vm.expectRevert(Agent0CustodialRegistry.TokenDoesNotExist.selector);
        registry.updateAgentActivity(999, 10, 20, 50, 5);
    }

    function test_BatchUpdateActivities() public {
        uint256 id0 = registry.registerAgent(agent1, "https://example.com/agent0");
        uint256 id1 = registry.registerAgent(agent2, "https://example.com/agent1");
        uint256 id2 = registry.registerAgent(agent3, "https://example.com/agent2");

        Agent0CustodialRegistry.ActivityUpdate[] memory updates = new Agent0CustodialRegistry.ActivityUpdate[](3);

        updates[0] = Agent0CustodialRegistry.ActivityUpdate({
            agentId: id0,
            questionsCount: 10,
            answersCount: 20,
            upvotesReceived: 50,
            downvotesReceived: 5
        });

        updates[1] = Agent0CustodialRegistry.ActivityUpdate({
            agentId: id1,
            questionsCount: 15,
            answersCount: 25,
            upvotesReceived: 60,
            downvotesReceived: 3
        });

        updates[2] = Agent0CustodialRegistry.ActivityUpdate({
            agentId: id2,
            questionsCount: 5,
            answersCount: 10,
            upvotesReceived: 30,
            downvotesReceived: 2
        });

        vm.expectEmit(true, true, true, true);
        emit BatchActivityUpdated(3, block.timestamp);

        registry.batchUpdateActivities(updates);

        (uint256 q0, uint256 a0,,,) = registry.activities(id0);
        assertEq(q0, 10);
        assertEq(a0, 20);

        (uint256 q1, uint256 a1,,,) = registry.activities(id1);
        assertEq(q1, 15);
        assertEq(a1, 25);
    }

    function test_BatchUpdateActivities_RevertBatchTooLarge() public {
        Agent0CustodialRegistry.ActivityUpdate[] memory updates = new Agent0CustodialRegistry.ActivityUpdate[](201);

        vm.expectRevert(Agent0CustodialRegistry.BatchTooLarge.selector);
        registry.batchUpdateActivities(updates);
    }

    // ============================================
    // Treasury Management Tests
    // ============================================

    function test_TreasuryBalance() public {
        assertEq(registry.treasuryBalance(), 0);

        vm.prank(agent1);
        usdc.transfer(address(registry), REGISTRATION_FEE);

        assertEq(registry.treasuryBalance(), REGISTRATION_FEE);
    }

    function test_WithdrawTreasury() public {
        vm.prank(agent1);
        usdc.transfer(address(registry), REGISTRATION_FEE);

        uint256 treasuryBalanceBefore = usdc.balanceOf(treasury);

        vm.expectEmit(true, true, true, true);
        emit TreasuryWithdrawn(REGISTRATION_FEE, treasury);

        registry.withdrawTreasury(REGISTRATION_FEE, treasury);

        assertEq(registry.treasuryBalance(), 0);
        assertEq(usdc.balanceOf(treasury), treasuryBalanceBefore + REGISTRATION_FEE);
    }

    function test_WithdrawTreasury_RevertZeroAmount() public {
        vm.expectRevert(Agent0CustodialRegistry.ZeroAmount.selector);
        registry.withdrawTreasury(0, treasury);
    }

    function test_WithdrawTreasury_RevertInvalidAddress() public {
        vm.expectRevert(Agent0CustodialRegistry.InvalidAddress.selector);
        registry.withdrawTreasury(1000, address(0));
    }

    function test_WithdrawTreasury_RevertInsufficientBalance() public {
        vm.expectRevert(Agent0CustodialRegistry.TreasuryWithdrawalFailed.selector);
        registry.withdrawTreasury(REGISTRATION_FEE, treasury);
    }

    function test_WithdrawTreasury_RevertNotOwner() public {
        vm.prank(agent1);
        usdc.transfer(address(registry), REGISTRATION_FEE);

        vm.prank(agent1);
        vm.expectRevert();
        registry.withdrawTreasury(REGISTRATION_FEE, treasury);
    }

    // ============================================
    // ERC721 Receiver Tests
    // ============================================

    function test_OnERC721Received() public view {
        bytes4 selector = registry.onERC721Received(address(0), address(0), 0, "");
        assertEq(selector, IERC721Receiver.onERC721Received.selector);
    }

    // ============================================
    // Integration Tests
    // ============================================

    function test_FullRegistrationAndReputationFlow() public {
        // Step 1: Agent pays USDC (simulated via x402 off-chain, USDC sent to registry)
        vm.prank(agent1);
        usdc.transfer(address(registry), REGISTRATION_FEE);

        // Step 2: Register agent atomically (ERC-8004 + custodial record)
        uint256 agentId = registry.registerAgent(agent1, "https://api.clawdaq.xyz/agents/1/registration.json");

        // Verify NFT minted to registry
        assertEq(identityReg.ownerOf(agentId), address(registry));

        // Step 3: Agent participates (simulated by reputation update)
        Agent0CustodialRegistry.ReputationUpdate memory update = Agent0CustodialRegistry.ReputationUpdate({
            agentId: agentId,
            karma: 150,
            questionsAsked: 10,
            answersGiven: 15,
            acceptedAnswers: 8,
            upvotesReceived: 75,
            downvotesReceived: 3
        });
        registry.updateReputation(agentId, update);

        // Step 4: Update activity
        registry.updateAgentActivity(agentId, 10, 15, 75, 3);

        // Step 5: Verify final state
        (uint256 karma,,,,,,,) = registry.reputations(agentId);
        assertEq(karma, 150);

        (uint256 questions, uint256 answers,,,) = registry.activities(agentId);
        assertEq(questions, 10);
        assertEq(answers, 15);

        // Step 6: Withdraw treasury
        assertEq(registry.treasuryBalance(), REGISTRATION_FEE);
        registry.withdrawTreasury(REGISTRATION_FEE, treasury);
        assertEq(registry.treasuryBalance(), 0);
    }

    function test_MultipleAgentsWithBatchUpdates() public {
        // Register 10 agents (IDs: 0-9)
        uint256[] memory ids = new uint256[](10);
        for (uint256 i = 0; i < 10; i++) {
            address payer = address(uint160(i + 100));
            ids[i] = registry.registerAgent(payer, string(abi.encodePacked("https://example.com/agent", i)));
        }

        assertEq(registry.totalAgents(), 10);

        // Batch update reputations
        Agent0CustodialRegistry.ReputationUpdate[] memory updates = new Agent0CustodialRegistry.ReputationUpdate[](10);
        for (uint256 i = 0; i < 10; i++) {
            updates[i] = Agent0CustodialRegistry.ReputationUpdate({
                agentId: ids[i],
                karma: (i + 1) * 10,
                questionsAsked: i + 1,
                answersGiven: (i + 1) * 2,
                acceptedAnswers: i,
                upvotesReceived: (i + 1) * 5,
                downvotesReceived: i
            });
        }

        registry.batchUpdateReputations(updates);

        // Verify a few agents
        (uint256 karma0,,,,,,,) = registry.reputations(ids[0]);
        assertEq(karma0, 10);

        (uint256 karma4,,,,,,,) = registry.reputations(ids[4]);
        assertEq(karma4, 50);

        (uint256 karma9,,,,,,,) = registry.reputations(ids[9]);
        assertEq(karma9, 100);
    }

    function test_SetAgentUri_SyncsToIdentityRegistry() public {
        uint256 agentId = registry.registerAgent(agent1, "https://example.com/old");

        // Update URI
        registry.setAgentUri(agentId, "https://example.com/new");

        // Both local and identity registry should have the new URI
        (, string memory localUri,,) = registry.agents(agentId);
        assertEq(localUri, "https://example.com/new");

        string memory identityUri = identityReg.tokenURI(agentId);
        assertEq(identityUri, "https://example.com/new");
    }
}
