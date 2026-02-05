// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/AgentReputationRegistryV2.sol";
import "../src/interfaces/ISwapRouter.sol";

/**
 * @title MockERC20
 * @notice Mock ERC20 token for testing
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

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

/**
 * @title MockSwapRouter
 * @notice Mock Uniswap V3 router for testing
 */
contract MockSwapRouter is ISwapRouter {
    MockERC20 public usdc;
    MockERC20 public purchaseToken;
    uint256 public rate; // tokens per USDC (in purchase token decimals)

    constructor(address _usdc, address _purchaseToken, uint256 _rate) {
        usdc = MockERC20(_usdc);
        purchaseToken = MockERC20(_purchaseToken);
        rate = _rate;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut) {
        // Transfer USDC from sender
        require(usdc.transferFrom(msg.sender, address(this), params.amountIn), "Transfer failed");
        
        // Calculate output
        amountOut = params.amountIn * rate / (10 ** 6); // USDC has 6 decimals
        
        // Transfer purchase tokens to recipient
        require(purchaseToken.transfer(params.recipient, amountOut), "Transfer failed");
        
        return amountOut;
    }

    function exactInput(ExactInputParams calldata) external payable returns (uint256) {
        revert("Not implemented");
    }

    function exactOutputSingle(ExactOutputSingleParams calldata) external payable returns (uint256) {
        revert("Not implemented");
    }

    function exactOutput(ExactOutputParams calldata) external payable returns (uint256) {
        revert("Not implemented");
    }
}

/**
 * @title AgentReputationRegistryV2Test
 * @notice Comprehensive test suite for V2 contract
 */
contract AgentReputationRegistryV2Test is Test {
    AgentReputationRegistryV2 public implementation;
    AgentReputationRegistryV2 public registry;
    ERC1967Proxy public proxy;
    
    MockERC20 public usdc;
    MockERC20 public purchaseToken;
    MockSwapRouter public swapRouter;
    
    address public owner;
    address public agent1;
    address public agent2;
    
    string public constant BASE_URI = "https://api.clawdaq.xyz/api/v1/agents/nft/";
    uint256 public constant INITIAL_USDC = 1000 * 10**6; // 1000 USDC
    uint256 public constant SWAP_RATE = 2000 * 10**18; // 2000 tokens per USDC

    function setUp() public {
        owner = address(this);
        agent1 = makeAddr("agent1");
        agent2 = makeAddr("agent2");
        
        // Deploy mock tokens
        usdc = new MockERC20("USD Coin", "USDC", 6);
        purchaseToken = new MockERC20("Purchase Token", "PURCHASE", 18);
        
        // Deploy mock router
        swapRouter = new MockSwapRouter(address(usdc), address(purchaseToken), SWAP_RATE);
        
        // Mint tokens
        usdc.mint(owner, INITIAL_USDC);
        usdc.mint(agent1, INITIAL_USDC);
        usdc.mint(agent2, INITIAL_USDC);
        purchaseToken.mint(address(swapRouter), 1000000 * 10**18);
        
        // Deploy implementation
        implementation = new AgentReputationRegistryV2();
        
        // Deploy proxy
        bytes memory initData = abi.encodeWithSelector(
            AgentReputationRegistryV2.initialize.selector,
            BASE_URI,
            address(usdc),
            address(purchaseToken),
            address(swapRouter)
        );
        
        proxy = new ERC1967Proxy(address(implementation), initData);
        registry = AgentReputationRegistryV2(address(proxy));
    }

    // ============================================
    // Initialization Tests
    // ============================================
    
    function test_Initialization() public {
        assertEq(registry.owner(), owner);
        assertEq(registry.version(), 2);
        assertEq(address(registry.usdc()), address(usdc));
        assertEq(address(registry.purchaseToken()), address(purchaseToken));
        assertEq(address(registry.swapRouter()), address(swapRouter));
        assertEq(registry.slippageTolerance(), 500); // 5%
        assertEq(registry.REGISTRATION_FEE(), 5_000_000); // $5 USDC
        assertEq(registry.SWAP_AMOUNT(), 1_000_000); // $1 USDC
    }
    
    function test_Initialization_InvalidAddress() public {
        AgentReputationRegistryV2 newImpl = new AgentReputationRegistryV2();
        
        vm.expectRevert(AgentReputationRegistryV2.InvalidAddress.selector);
        new ERC1967Proxy(
            address(newImpl),
            abi.encodeWithSelector(
                AgentReputationRegistryV2.initialize.selector,
                BASE_URI,
                address(0),
                address(purchaseToken),
                address(swapRouter)
            )
        );
    }

    // ============================================
    // Registration with Payment Tests
    // ============================================
    
    function test_RegisterAgentWithPayment() public {
        uint256 initialTreasury = registry.treasuryBalance();
        uint256 initialPending = registry.pendingSwapAmount();
        
        // Approve USDC
        vm.prank(agent1);
        usdc.approve(address(registry), registry.REGISTRATION_FEE());
        
        // Register
        vm.prank(agent1);
        uint256 tokenId = registry.registerAgentWithPayment("agent_001", agent1);
        
        // Verify token minted
        assertEq(tokenId, 1);
        assertEq(registry.ownerOf(tokenId), agent1);
        
        // Verify treasury state
        assertEq(registry.treasuryBalance(), initialTreasury + 4_000_000); // $4
        assertEq(registry.pendingSwapAmount(), initialPending + 1_000_000); // $1
        
        // Verify agent registered
        assertTrue(registry.isAgentRegistered("agent_001"));
        assertEq(registry.getTokenId("agent_001"), tokenId);
        
        // Verify activity initialized
        (uint256 q, uint256 a, uint256 u, uint256 d, ) = registry.activities(tokenId);
        assertEq(q, 0);
        assertEq(a, 0);
        assertEq(u, 0);
        assertEq(d, 0);
    }
    
    function test_RegisterAgentWithPayment_InsufficientAllowance() public {
        vm.prank(agent1);
        usdc.approve(address(registry), 1_000_000); // Only $1
        
        vm.prank(agent1);
        vm.expectRevert(AgentReputationRegistryV2.InsufficientAllowance.selector);
        registry.registerAgentWithPayment("agent_001", agent1);
    }
    
    function test_RegisterAgentWithPayment_AlreadyRegistered() public {
        // First registration
        vm.prank(agent1);
        usdc.approve(address(registry), registry.REGISTRATION_FEE());
        vm.prank(agent1);
        registry.registerAgentWithPayment("agent_001", agent1);
        
        // Second registration with same ID
        vm.prank(agent2);
        usdc.approve(address(registry), registry.REGISTRATION_FEE());
        vm.prank(agent2);
        vm.expectRevert(AgentReputationRegistryV2.AgentAlreadyRegistered.selector);
        registry.registerAgentWithPayment("agent_001", agent2);
    }
    
    function test_RegisterAgentWithPayment_InvalidAddress() public {
        vm.prank(agent1);
        usdc.approve(address(registry), registry.REGISTRATION_FEE());
        
        vm.prank(agent1);
        vm.expectRevert(AgentReputationRegistryV2.InvalidAddress.selector);
        registry.registerAgentWithPayment("agent_001", address(0));
    }

    // ============================================
    // Batch Registration Tests
    // ============================================
    
    function test_BatchRegisterAgents() public {
        string[] memory agentIds = new string[](2);
        agentIds[0] = "agent_001";
        agentIds[1] = "agent_002";
        
        address[] memory owners = new address[](2);
        owners[0] = agent1;
        owners[1] = agent2;
        
        registry.batchRegisterAgents(agentIds, owners);
        
        assertEq(registry.totalAgents(), 2);
        assertTrue(registry.isAgentRegistered("agent_001"));
        assertTrue(registry.isAgentRegistered("agent_002"));
    }
    
    function test_BatchRegisterAgents_ArrayLengthMismatch() public {
        string[] memory agentIds = new string[](2);
        address[] memory owners = new address[](1);
        
        vm.expectRevert(AgentReputationRegistryV2.ArrayLengthMismatch.selector);
        registry.batchRegisterAgents(agentIds, owners);
    }
    
    function test_BatchRegisterAgents_BatchTooLarge() public {
        string[] memory agentIds = new string[](101);
        address[] memory owners = new address[](101);
        
        vm.expectRevert(AgentReputationRegistryV2.BatchTooLarge.selector);
        registry.batchRegisterAgents(agentIds, owners);
    }

    // ============================================
    // Activity Update Tests
    // ============================================
    
    function test_UpdateAgentActivity() public {
        // Register agent first
        vm.prank(agent1);
        usdc.approve(address(registry), registry.REGISTRATION_FEE());
        vm.prank(agent1);
        registry.registerAgentWithPayment("agent_001", agent1);
        
        // Update activity
        registry.updateAgentActivity(1, 10, 20, 50, 5);
        
        (uint256 q, uint256 a, uint256 u, uint256 d, uint256 lastUpdated) = registry.activities(1);
        assertEq(q, 10);
        assertEq(a, 20);
        assertEq(u, 50);
        assertEq(d, 5);
        assertGt(lastUpdated, 0);
    }
    
    function test_UpdateAgentActivity_TokenDoesNotExist() public {
        vm.expectRevert(AgentReputationRegistryV2.TokenDoesNotExist.selector);
        registry.updateAgentActivity(999, 10, 20, 50, 5);
    }
    
    function test_BatchUpdateActivities() public {
        // Register agents
        vm.prank(agent1);
        usdc.approve(address(registry), registry.REGISTRATION_FEE());
        vm.prank(agent1);
        registry.registerAgentWithPayment("agent_001", agent1);
        
        vm.prank(agent2);
        usdc.approve(address(registry), registry.REGISTRATION_FEE());
        vm.prank(agent2);
        registry.registerAgentWithPayment("agent_002", agent2);
        
        // Create updates
        AgentReputationRegistryV2.ActivityUpdate[] memory updates = 
            new AgentReputationRegistryV2.ActivityUpdate[](2);
        updates[0] = AgentReputationRegistryV2.ActivityUpdate(1, 10, 20, 50, 5);
        updates[1] = AgentReputationRegistryV2.ActivityUpdate(2, 5, 15, 30, 2);
        
        registry.batchUpdateActivities(updates);
        
        (uint256 q1, , , , ) = registry.activities(1);
        (uint256 q2, , , , ) = registry.activities(2);
        assertEq(q1, 10);
        assertEq(q2, 5);
    }

    // ============================================
    // Reputation Update Tests (V1 compatibility)
    // ============================================
    
    function test_UpdateReputation() public {
        // Register agent
        vm.prank(agent1);
        usdc.approve(address(registry), registry.REGISTRATION_FEE());
        vm.prank(agent1);
        registry.registerAgentWithPayment("agent_001", agent1);
        
        // Update reputation
        AgentReputationRegistryV2.ReputationUpdate memory update = 
            AgentReputationRegistryV2.ReputationUpdate(1, 100, 10, 20, 5, 50, 5);
        registry.updateReputation(1, update);
        
        (uint256 karma, uint256 questions, uint256 answers, uint256 accepted, , , , ) = 
            registry.reputations(1);
        assertEq(karma, 100);
        assertEq(questions, 10);
        assertEq(answers, 20);
        assertEq(accepted, 5);
    }

    // ============================================
    // Treasury Tests
    // ============================================
    
    function test_ExecutePendingSwap() public {
        // Register 3 agents to accumulate 3 USDC pending
        for (uint256 i = 0; i < 3; i++) {
            address agent = makeAddr(string(abi.encodePacked("agent", i)));
            usdc.mint(agent, registry.REGISTRATION_FEE());
            
            vm.prank(agent);
            usdc.approve(address(registry), registry.REGISTRATION_FEE());
            vm.prank(agent);
            registry.registerAgentWithPayment(string(abi.encodePacked("agent_", i)), agent);
        }
        
        uint256 pendingBefore = registry.pendingSwapAmount();
        assertEq(pendingBefore, 3_000_000); // $3
        
        // Execute swap
        uint256 tokensReceived = registry.executePendingSwap(0);
        
        // Verify state
        assertEq(registry.pendingSwapAmount(), 0);
        assertEq(registry.totalTokensPurchased(), tokensReceived);
        
        // Expected: 3 USDC * 2000 tokens/USDC = 6000 tokens (in 18 decimals)
        uint256 expectedTokens = 3 * SWAP_RATE * 10**6 / 10**6;
        assertEq(tokensReceived, expectedTokens);
    }
    
    function test_ExecutePendingSwap_NoPendingSwaps() public {
        vm.expectRevert(AgentReputationRegistryV2.NoPendingSwaps.selector);
        registry.executePendingSwap(0);
    }
    
    function test_WithdrawTreasury() public {
        // Register agent
        vm.prank(agent1);
        usdc.approve(address(registry), registry.REGISTRATION_FEE());
        vm.prank(agent1);
        registry.registerAgentWithPayment("agent_001", agent1);
        
        uint256 treasuryBefore = registry.treasuryBalance();
        uint256 ownerBalanceBefore = usdc.balanceOf(owner);
        
        // Withdraw
        registry.withdrawTreasury(4_000_000, owner);
        
        assertEq(registry.treasuryBalance(), treasuryBefore - 4_000_000);
        assertEq(usdc.balanceOf(owner), ownerBalanceBefore + 4_000_000);
    }
    
    function test_WithdrawTreasury_ZeroAmount() public {
        vm.expectRevert(AgentReputationRegistryV2.ZeroAmount.selector);
        registry.withdrawTreasury(0, owner);
    }
    
    function test_WithdrawTreasury_InvalidAddress() public {
        vm.expectRevert(AgentReputationRegistryV2.InvalidAddress.selector);
        registry.withdrawTreasury(1000, address(0));
    }
    
    function test_WithdrawTokens() public {
        // Register and swap to get tokens
        vm.prank(agent1);
        usdc.approve(address(registry), registry.REGISTRATION_FEE());
        vm.prank(agent1);
        registry.registerAgentWithPayment("agent_001", agent1);
        
        registry.executePendingSwap(0);
        
        uint256 tokenBalance = purchaseToken.balanceOf(address(registry));
        
        // Withdraw tokens
        registry.withdrawTokens(tokenBalance, owner);
        
        assertEq(purchaseToken.balanceOf(owner), tokenBalance);
    }

    // ============================================
    // Configuration Tests
    // ============================================
    
    function test_SetPurchaseToken() public {
        MockERC20 newToken = new MockERC20("New Token", "NEW", 18);
        
        registry.setPurchaseToken(address(newToken));
        assertEq(address(registry.purchaseToken()), address(newToken));
    }
    
    function test_SetPurchaseToken_InvalidToken() public {
        vm.expectRevert(AgentReputationRegistryV2.InvalidToken.selector);
        registry.setPurchaseToken(address(0));
    }
    
    function test_SetSlippageTolerance() public {
        registry.setSlippageTolerance(300); // 3%
        assertEq(registry.slippageTolerance(), 300);
    }
    
    function test_SetSlippageTolerance_InvalidSlippage() public {
        vm.expectRevert(AgentReputationRegistryV2.InvalidSlippage.selector);
        registry.setSlippageTolerance(1500); // > 10%
    }
    
    function test_SetBaseURI() public {
        registry.setBaseURI("https://new.uri/");
        // Note: _baseURI is internal, tested via tokenURI indirectly
    }

    // ============================================
    // View Function Tests
    // ============================================
    
    function test_GetTreasuryState() public {
        // Register agent
        vm.prank(agent1);
        usdc.approve(address(registry), registry.REGISTRATION_FEE());
        vm.prank(agent1);
        registry.registerAgentWithPayment("agent_001", agent1);
        
        (uint256 treasury, uint256 pending, uint256 tokenBalance, uint256 totalPurchased) = 
            registry.getTreasuryState();
        
        assertEq(treasury, 4_000_000);
        assertEq(pending, 1_000_000);
        assertEq(tokenBalance, 0);
        assertEq(totalPurchased, 0);
    }
    
    function test_CalculateMinOutput() public {
        // Default slippage is 5% (500 bps)
        uint256 expectedOutput = 1000;
        uint256 minOutput = registry.calculateMinOutput(expectedOutput);
        
        // 1000 * (10000 - 500) / 10000 = 950
        assertEq(minOutput, 950);
    }
    
    function test_GetActivityByAgentId() public {
        // Register and update
        vm.prank(agent1);
        usdc.approve(address(registry), registry.REGISTRATION_FEE());
        vm.prank(agent1);
        registry.registerAgentWithPayment("agent_001", agent1);
        
        registry.updateAgentActivity(1, 10, 20, 50, 5);
        
        (uint256 q, uint256 a, uint256 u, uint256 d, ) = registry.getActivityByAgentId("agent_001");
        assertEq(q, 10);
        assertEq(a, 20);
        assertEq(u, 50);
        assertEq(d, 5);
    }
    
    function test_GetActivityByAgentId_NotRegistered() public {
        vm.expectRevert(AgentReputationRegistryV2.TokenDoesNotExist.selector);
        registry.getActivityByAgentId("nonexistent");
    }

    // ============================================
    // Access Control Tests
    // ============================================
    
    function test_OnlyOwner_CanUpdateActivity() public {
        vm.prank(agent1);
        vm.expectRevert();
        registry.updateAgentActivity(1, 10, 20, 50, 5);
    }
    
    function test_OnlyOwner_CanExecuteSwap() public {
        vm.prank(agent1);
        vm.expectRevert();
        registry.executePendingSwap(0);
    }
    
    function test_OnlyOwner_CanWithdrawTreasury() public {
        vm.prank(agent1);
        vm.expectRevert();
        registry.withdrawTreasury(1000, agent1);
    }

    // ============================================
    // Edge Cases
    // ============================================
    
    function test_MultipleRegistrations_AccumulateCorrectly() public {
        // Register 5 agents
        for (uint256 i = 0; i < 5; i++) {
            address agent = makeAddr(string(abi.encodePacked("agent", i)));
            usdc.mint(agent, registry.REGISTRATION_FEE());
            
            vm.prank(agent);
            usdc.approve(address(registry), registry.REGISTRATION_FEE());
            vm.prank(agent);
            registry.registerAgentWithPayment(string(abi.encodePacked("agent_", i)), agent);
        }
        
        // Verify accumulation
        assertEq(registry.treasuryBalance(), 20_000_000); // 5 * $4
        assertEq(registry.pendingSwapAmount(), 5_000_000); // 5 * $1
        assertEq(registry.totalAgents(), 5);
    }
    
    function test_BatchUpdate_SkipsNonexistentTokens() public {
        // Register one agent
        vm.prank(agent1);
        usdc.approve(address(registry), registry.REGISTRATION_FEE());
        vm.prank(agent1);
        registry.registerAgentWithPayment("agent_001", agent1);
        
        // Try to update including non-existent token
        AgentReputationRegistryV2.ActivityUpdate[] memory updates = 
            new AgentReputationRegistryV2.ActivityUpdate[](2);
        updates[0] = AgentReputationRegistryV2.ActivityUpdate(1, 10, 20, 50, 5);
        updates[1] = AgentReputationRegistryV2.ActivityUpdate(999, 5, 10, 20, 2);
        
        // Should not revert, just skip non-existent
        registry.batchUpdateActivities(updates);
        
        // First update should still work
        (uint256 q, , , , ) = registry.activities(1);
        assertEq(q, 10);
    }
}
