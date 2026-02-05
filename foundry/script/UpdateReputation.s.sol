// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/AgentReputationRegistry.sol";

/**
 * @title UpdateReputation
 * @notice Weekly batch update script for agent reputations
 *
 * Workflow:
 *   1. Run Node.js aggregator: node scripts/aggregate-reputation.js
 *      - Queries ClawDAQ database
 *      - Outputs reputation-updates.json
 *   2. Run this Forge script with the JSON data
 *
 * Usage:
 *   # First, generate the JSON file from DB
 *   cd api && node scripts/aggregate-reputation.js
 *
 *   # Then run the Forge script
 *   forge script script/UpdateReputation.s.sol:UpdateReputation \
 *     --rpc-url base_sepolia \
 *     --broadcast \
 *     -vvvv
 *
 * The script reads from data/reputation-updates.json which should have format:
 * {
 *   "newAgents": [
 *     { "agentId": "agent_abc123", "walletAddress": "0x..." }
 *   ],
 *   "updates": [
 *     {
 *       "tokenId": 1,
 *       "karma": 150,
 *       "questionsAsked": 10,
 *       "answersGiven": 25,
 *       "acceptedAnswers": 5,
 *       "upvotesReceived": 180,
 *       "downvotesReceived": 30
 *     }
 *   ]
 * }
 */
contract UpdateReputation is Script {
    AgentReputationRegistry public registry;

    function run() external {
        // Load configuration
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address registryAddress = vm.envAddress("REGISTRY_ADDRESS");

        registry = AgentReputationRegistry(registryAddress);

        console.log("Registry address:", registryAddress);
        console.log("Registry owner:", registry.owner());
        console.log("Total agents before:", registry.totalAgents());

        // Read JSON file with updates
        string memory json = vm.readFile("data/reputation-updates.json");

        vm.startBroadcast(deployerPrivateKey);

        // Process new agent registrations
        _registerNewAgents(json);

        // Process reputation updates
        _updateReputations(json);

        vm.stopBroadcast();

        console.log("========================================");
        console.log("Update complete!");
        console.log("Total agents after:", registry.totalAgents());
        console.log("========================================");
    }

    function _registerNewAgents(string memory json) internal {
        // Parse new agents array
        bytes memory newAgentsRaw = vm.parseJson(json, ".newAgents");

        // Decode as array of structs
        NewAgentInput[] memory newAgents = abi.decode(
            newAgentsRaw,
            (NewAgentInput[])
        );

        if (newAgents.length == 0) {
            console.log("No new agents to register");
            return;
        }

        console.log("Registering", newAgents.length, "new agents...");

        // Batch register (max 100 at a time)
        uint256 batchSize = 100;
        uint256 totalBatches = (newAgents.length + batchSize - 1) / batchSize;

        for (uint256 batch = 0; batch < totalBatches; batch++) {
            uint256 start = batch * batchSize;
            uint256 end = start + batchSize;
            if (end > newAgents.length) end = newAgents.length;

            uint256 size = end - start;
            string[] memory agentIds = new string[](size);
            address[] memory owners = new address[](size);

            for (uint256 i = 0; i < size; i++) {
                agentIds[i] = newAgents[start + i].agentId;
                owners[i] = newAgents[start + i].walletAddress;
            }

            registry.batchRegisterAgents(agentIds, owners);
            console.log("  Batch", batch + 1, "of", totalBatches, "complete");
        }
    }

    function _updateReputations(string memory json) internal {
        // Parse updates array
        bytes memory updatesRaw = vm.parseJson(json, ".updates");

        AgentReputationRegistry.ReputationUpdate[] memory updates = abi.decode(
            updatesRaw,
            (AgentReputationRegistry.ReputationUpdate[])
        );

        if (updates.length == 0) {
            console.log("No reputation updates to process");
            return;
        }

        console.log("Processing", updates.length, "reputation updates...");

        // Batch update (max 100 at a time)
        uint256 batchSize = 100;
        uint256 totalBatches = (updates.length + batchSize - 1) / batchSize;

        for (uint256 batch = 0; batch < totalBatches; batch++) {
            uint256 start = batch * batchSize;
            uint256 end = start + batchSize;
            if (end > updates.length) end = updates.length;

            uint256 size = end - start;
            AgentReputationRegistry.ReputationUpdate[]
                memory batchUpdates = new AgentReputationRegistry.ReputationUpdate[](
                    size
                );

            for (uint256 i = 0; i < size; i++) {
                batchUpdates[i] = updates[start + i];
            }

            registry.batchUpdateReputations(batchUpdates);
            console.log("  Batch", batch + 1, "of", totalBatches, "complete");
        }
    }

    // Helper struct for JSON parsing
    struct NewAgentInput {
        string agentId;
        address walletAddress;
    }
}

/**
 * @title RegisterSingleAgent
 * @notice Helper script to register a single agent (for testing)
 *
 * Usage:
 *   AGENT_ID="agent_test123" AGENT_WALLET="0x..." \
 *   forge script script/UpdateReputation.s.sol:RegisterSingleAgent \
 *     --rpc-url base_sepolia \
 *     --broadcast
 */
contract RegisterSingleAgent is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address registryAddress = vm.envAddress("REGISTRY_ADDRESS");
        string memory agentId = vm.envString("AGENT_ID");
        address agentWallet = vm.envAddress("AGENT_WALLET");

        AgentReputationRegistry registry = AgentReputationRegistry(
            registryAddress
        );

        console.log("Registering agent:", agentId);
        console.log("Wallet:", agentWallet);

        vm.startBroadcast(deployerPrivateKey);

        uint256 tokenId = registry.registerAgent(agentId, agentWallet);

        vm.stopBroadcast();

        console.log("Success! Token ID:", tokenId);
    }
}
