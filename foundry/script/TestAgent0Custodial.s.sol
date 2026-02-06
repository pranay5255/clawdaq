// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/Agent0CustodialRegistry.sol";

interface IERC20Mintable is IERC20 {
    function mint(address to, uint256 amount) external;
}

/**
 * @title TestAgent0CustodialScript
 * @notice Interactive test script for all Agent0CustodialRegistry functions
 */
contract TestAgent0CustodialScript is Script {
    Agent0CustodialRegistry public registry;
    IERC20Mintable public usdc;

    address public deployer;
    address public agent1 = address(0x1111);
    address public agent2 = address(0x2222);
    address public agent3 = address(0x3333);
    address public treasury = address(0x9999);

    uint256 public constant REGISTRATION_FEE = 5_000_000;

    function run() external {
        // Get deployment addresses from environment or use defaults
        address registryAddress = vm.envOr("REGISTRY_ADDRESS", address(0));
        address usdcAddress = vm.envOr("USDC_ADDRESS", address(0));

        require(registryAddress != address(0), "Set REGISTRY_ADDRESS");
        require(usdcAddress != address(0), "Set USDC_ADDRESS");

        registry = Agent0CustodialRegistry(registryAddress);
        usdc = IERC20Mintable(usdcAddress);

        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        deployer = vm.addr(deployerPrivateKey);

        console.log("\n=== Starting Agent0CustodialRegistry Tests ===");
        console.log("Registry:", address(registry));
        console.log("USDC:", address(usdc));
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        testContractInfo();
        testAgentRegistration();
        testAgentUriUpdate();
        testAgentActiveStatus();
        testReputationUpdates();
        testActivityUpdates();
        testBatchReputationUpdates();
        testBatchActivityUpdates();
        testTreasuryManagement();

        vm.stopBroadcast();

        console.log("\n=== All Tests Completed Successfully ===\n");
    }

    function testContractInfo() internal {
        console.log("\n--- Test 1: Contract Info ---");
        console.log("Total Agents:", registry.totalAgents());
        console.log("Registration Fee:", registry.REGISTRATION_FEE());
        console.log("Max Batch Size:", registry.MAX_BATCH_SIZE());
        console.log("Treasury Balance:", registry.treasuryBalance());
    }

    function testAgentRegistration() internal {
        console.log("\n--- Test 2: Agent Registration ---");

        // Register agent 1
        uint256 agentId1 = 1;
        string memory uri1 = "ipfs://QmTestAgent1abc123";
        registry.registerAgent(agentId1, agent1, uri1);
        console.log("Registered Agent ID:", agentId1);
        console.log("Payer EOA:", agent1);

        (address payerEoa, string memory agentUri, uint256 registeredAt, bool isActive) = registry.agents(agentId1);
        console.log("  Payer EOA:", payerEoa);
        console.log("  Agent URI:", agentUri);
        console.log("  Registered At:", registeredAt);
        console.log("  Is Active:", isActive);

        // Check reputation initialized
        (
            uint256 karma,
            uint256 questionsAsked,
            uint256 answersGiven,
            uint256 acceptedAnswers,
            uint256 upvotesReceived,
            uint256 downvotesReceived,
            uint256 lastUpdated,
            bool repActive
        ) = registry.reputations(agentId1);

        console.log("  Initial Reputation:");
        console.log("    Karma:", karma);
        console.log("    Questions Asked:", questionsAsked);
        console.log("    Answers Given:", answersGiven);
        console.log("    Accepted Answers:", acceptedAnswers);
        console.log("    Upvotes:", upvotesReceived);
        console.log("    Downvotes:", downvotesReceived);
        console.log("    Last Updated:", lastUpdated);
        console.log("    Active:", repActive);

        // Register agent 2
        uint256 agentId2 = 2;
        registry.registerAgent(agentId2, agent2, "ipfs://QmTestAgent2xyz456");
        console.log("Registered Agent ID:", agentId2);

        // Register agent 3
        uint256 agentId3 = 3;
        registry.registerAgent(agentId3, agent3, "ipfs://QmTestAgent3def789");
        console.log("Registered Agent ID:", agentId3);

        console.log("Total Agents:", registry.totalAgents());
    }

    function testAgentUriUpdate() internal {
        console.log("\n--- Test 3: Agent URI Update ---");

        uint256 agentId = 1;
        string memory newUri = "ipfs://QmUpdatedAgent1newHash";

        (,string memory oldUri,,) = registry.agents(agentId);
        console.log("Old URI:", oldUri);

        registry.setAgentUri(agentId, newUri);

        (,string memory updatedUri,,) = registry.agents(agentId);
        console.log("New URI:", updatedUri);
    }

    function testAgentActiveStatus() internal {
        console.log("\n--- Test 4: Agent Active Status ---");

        uint256 agentId = 2;

        (,,,bool isActiveBefore) = registry.agents(agentId);
        console.log("Agent", agentId, "Active (before):", isActiveBefore);

        // Deactivate
        registry.setAgentActive(agentId, false);

        (,,,bool isActiveAfter) = registry.agents(agentId);
        (,,,,,,, bool repActive) = registry.reputations(agentId);
        console.log("Agent", agentId, "Active (after):", isActiveAfter);
        console.log("Reputation Active:", repActive);

        // Reactivate
        registry.setAgentActive(agentId, true);
        (,,,bool isActiveAgain) = registry.agents(agentId);
        console.log("Agent", agentId, "Active (reactivated):", isActiveAgain);
    }

    function testReputationUpdates() internal {
        console.log("\n--- Test 5: Reputation Updates ---");

        uint256 agentId = 1;

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

        (
            uint256 karma,
            uint256 questionsAsked,
            uint256 answersGiven,
            uint256 acceptedAnswers,
            uint256 upvotesReceived,
            uint256 downvotesReceived,
            uint256 lastUpdated,
        ) = registry.reputations(agentId);

        console.log("Agent", agentId, "Reputation Updated:");
        console.log("  Karma:", karma);
        console.log("  Questions Asked:", questionsAsked);
        console.log("  Answers Given:", answersGiven);
        console.log("  Accepted Answers:", acceptedAnswers);
        console.log("  Upvotes Received:", upvotesReceived);
        console.log("  Downvotes Received:", downvotesReceived);
        console.log("  Last Updated:", lastUpdated);
    }

    function testActivityUpdates() internal {
        console.log("\n--- Test 6: Activity Updates ---");

        uint256 agentId = 1;

        registry.updateAgentActivity(agentId, 10, 15, 75, 3);

        (
            uint256 questionsCount,
            uint256 answersCount,
            uint256 upvotesReceived,
            uint256 downvotesReceived,
            uint256 lastUpdated
        ) = registry.activities(agentId);

        console.log("Agent", agentId, "Activity Updated:");
        console.log("  Questions Count:", questionsCount);
        console.log("  Answers Count:", answersCount);
        console.log("  Upvotes Received:", upvotesReceived);
        console.log("  Downvotes Received:", downvotesReceived);
        console.log("  Last Updated:", lastUpdated);
    }

    function testBatchReputationUpdates() internal {
        console.log("\n--- Test 7: Batch Reputation Updates ---");

        Agent0CustodialRegistry.ReputationUpdate[] memory updates = new Agent0CustodialRegistry.ReputationUpdate[](3);

        updates[0] = Agent0CustodialRegistry.ReputationUpdate({
            agentId: 1,
            karma: 200,
            questionsAsked: 15,
            answersGiven: 25,
            acceptedAnswers: 12,
            upvotesReceived: 100,
            downvotesReceived: 5
        });

        updates[1] = Agent0CustodialRegistry.ReputationUpdate({
            agentId: 2,
            karma: 180,
            questionsAsked: 12,
            answersGiven: 20,
            acceptedAnswers: 10,
            upvotesReceived: 90,
            downvotesReceived: 4
        });

        updates[2] = Agent0CustodialRegistry.ReputationUpdate({
            agentId: 3,
            karma: 120,
            questionsAsked: 8,
            answersGiven: 12,
            acceptedAnswers: 6,
            upvotesReceived: 60,
            downvotesReceived: 2
        });

        console.log("Updating", updates.length, "agents in batch...");
        registry.batchUpdateReputations(updates);

        // Verify updates
        for (uint256 i = 0; i < updates.length; i++) {
            (uint256 karma,,,,,,,) = registry.reputations(updates[i].agentId);
            console.log("  Agent", updates[i].agentId);
            console.log("  Karma:", karma);
        }
    }

    function testBatchActivityUpdates() internal {
        console.log("\n--- Test 8: Batch Activity Updates ---");

        Agent0CustodialRegistry.ActivityUpdate[] memory updates = new Agent0CustodialRegistry.ActivityUpdate[](3);

        updates[0] = Agent0CustodialRegistry.ActivityUpdate({
            agentId: 1,
            questionsCount: 20,
            answersCount: 30,
            upvotesReceived: 120,
            downvotesReceived: 8
        });

        updates[1] = Agent0CustodialRegistry.ActivityUpdate({
            agentId: 2,
            questionsCount: 18,
            answersCount: 25,
            upvotesReceived: 110,
            downvotesReceived: 6
        });

        updates[2] = Agent0CustodialRegistry.ActivityUpdate({
            agentId: 3,
            questionsCount: 12,
            answersCount: 18,
            upvotesReceived: 80,
            downvotesReceived: 4
        });

        console.log("Updating", updates.length, "agent activities in batch...");
        registry.batchUpdateActivities(updates);

        // Verify updates
        for (uint256 i = 0; i < updates.length; i++) {
            (uint256 q, uint256 a,,,) = registry.activities(updates[i].agentId);
            console.log("  Agent", updates[i].agentId);
            console.log("    Questions:", q);
            console.log("    Answers:", a);
        }
    }

    function testTreasuryManagement() internal {
        console.log("\n--- Test 9: Treasury Management ---");

        // Mint and transfer USDC to registry
        uint256 depositAmount = REGISTRATION_FEE * 3; // $15 USDC
        usdc.mint(deployer, depositAmount);
        usdc.transfer(address(registry), depositAmount);

        console.log("Deposited to treasury:", depositAmount);
        console.log("Treasury Balance:", registry.treasuryBalance());

        // Withdraw to treasury address
        uint256 withdrawAmount = REGISTRATION_FEE;
        uint256 treasuryBalanceBefore = usdc.balanceOf(treasury);

        console.log("Withdrawing:", withdrawAmount);
        registry.withdrawTreasury(withdrawAmount, treasury);

        uint256 treasuryBalanceAfter = usdc.balanceOf(treasury);
        console.log("Treasury received:", treasuryBalanceAfter - treasuryBalanceBefore);
        console.log("Remaining treasury balance:", registry.treasuryBalance());
    }
}
