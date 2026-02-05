// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/AgentReputationRegistryV2.sol";
import "../src/interfaces/ISwapRouter.sol";

/**
 * @title WeeklySync
 * @notice Combined weekly update script for agent activities and token swaps
 *
 * Workflow:
 *   1. Run Node.js aggregator: node scripts/aggregate-activity.js
 *      - Queries ClawDAQ database
 *      - Outputs activity-updates.json
 *   2. Run this Forge script with the JSON data
 *
 * Usage:
 *   # First, generate the JSON file from DB
 *   cd api && node scripts/aggregate-activity.js
 *
 *   # Then run the Forge script
 *   forge script script/WeeklySync.s.sol:WeeklySync \
 *     --rpc-url base_sepolia \
 *     --broadcast \
 *     -vvvv
 *
 * JSON Format (data/weekly-sync.json):
 * {
 *   "newAgents": [
 *     { "agentId": "agent_abc123", "walletAddress": "0x..." }
 *   ],
 *   "updates": [
 *     {
 *       "tokenId": 1,
 *       "questionsCount": 10,
 *       "answersCount": 25,
 *       "upvotesReceived": 180,
 *       "downvotesReceived": 30
 *     }
 *   ],
 *   "executeSwap": true,
 *   "minAmountOut": 0
 * }
 */
contract WeeklySync is Script {
    AgentReputationRegistryV2 public registry;

    function run() external {
        // Load configuration
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address registryAddress = vm.envAddress("REGISTRY_ADDRESS");

        registry = AgentReputationRegistryV2(registryAddress);

        console.log("========================================");
        console.log("Weekly Sync - AgentReputationRegistryV2");
        console.log("========================================");
        console.log("Registry address:", registryAddress);
        console.log("Registry owner:", registry.owner());
        console.log("Total agents:", registry.totalAgents());
        console.log("Treasury balance:", registry.treasuryBalance());
        console.log("Pending swap amount:", registry.pendingSwapAmount());
        console.log("");

        // Read JSON file with updates
        string memory json = vm.readFile("data/weekly-sync.json");

        vm.startBroadcast(deployerPrivateKey);

        // Process new agent registrations (owner-only, no payment)
        _registerNewAgents(json);

        // Process activity updates
        _updateActivities(json);

        // Execute swap if configured
        _executeSwapIfConfigured(json);

        vm.stopBroadcast();

        console.log("");
        console.log("========================================");
        console.log("Weekly Sync Complete!");
        console.log("========================================");
        console.log("Treasury balance:", registry.treasuryBalance());
        console.log("Pending swap amount:", registry.pendingSwapAmount());
        console.log("Total tokens purchased:", registry.totalTokensPurchased());
        console.log("========================================");
    }

    function _registerNewAgents(string memory json) internal {
        // Check if newAgents key exists
        try vm.parseJson(json, ".newAgents") returns (bytes memory newAgentsRaw) {
            if (newAgentsRaw.length == 0) {
                console.log("No new agents to register");
                return;
            }

            NewAgentInput[] memory newAgents = abi.decode(newAgentsRaw, (NewAgentInput[]));

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
        } catch {
            console.log("No new agents to register");
        }
    }

    function _updateActivities(string memory json) internal {
        try vm.parseJson(json, ".updates") returns (bytes memory updatesRaw) {
            if (updatesRaw.length == 0) {
                console.log("No activity updates to process");
                return;
            }

            AgentReputationRegistryV2.ActivityUpdate[] memory updates = 
                abi.decode(updatesRaw, (AgentReputationRegistryV2.ActivityUpdate[]));

            if (updates.length == 0) {
                console.log("No activity updates to process");
                return;
            }

            console.log("Processing", updates.length, "activity updates...");

            // Batch update (max 100 at a time)
            uint256 batchSize = 100;
            uint256 totalBatches = (updates.length + batchSize - 1) / batchSize;

            for (uint256 batch = 0; batch < totalBatches; batch++) {
                uint256 start = batch * batchSize;
                uint256 end = start + batchSize;
                if (end > updates.length) end = updates.length;

                uint256 size = end - start;
                AgentReputationRegistryV2.ActivityUpdate[] memory batchUpdates = 
                    new AgentReputationRegistryV2.ActivityUpdate[](size);

                for (uint256 i = 0; i < size; i++) {
                    batchUpdates[i] = updates[start + i];
                }

                registry.batchUpdateActivities(batchUpdates);
                console.log("  Batch", batch + 1, "of", totalBatches, "complete");
            }
        } catch {
            console.log("No activity updates to process");
        }
    }

    function _executeSwapIfConfigured(string memory json) internal {
        try vm.parseJson(json, ".executeSwap") returns (bytes memory executeSwapRaw) {
            bool executeSwap = abi.decode(executeSwapRaw, (bool));
            
            if (!executeSwap) {
                console.log("Swap execution skipped (executeSwap: false)");
                return;
            }

            uint256 pendingAmount = registry.pendingSwapAmount();
            if (pendingAmount == 0) {
                console.log("No pending swaps to execute");
                return;
            }

            console.log("Executing swap for", pendingAmount, "USDC...");

            // Get minAmountOut from JSON or use 0 (for testing only!)
            uint256 minAmountOut = 0;
            try vm.parseJson(json, ".minAmountOut") returns (bytes memory minAmountOutRaw) {
                minAmountOut = abi.decode(minAmountOutRaw, (uint256));
            } catch {}

            uint256 tokensReceived = registry.executePendingSwap(minAmountOut);
            console.log("Swap complete! Received", tokensReceived, "tokens");
        } catch {
            console.log("Swap execution skipped (no executeSwap flag)");
        }
    }

    // Helper struct for JSON parsing
    struct NewAgentInput {
        string agentId;
        address walletAddress;
    }
}

/**
 * @title UpdateActivity
 * @notice Update activity for a single agent or batch
 *
 * Usage:
 *   forge script script/WeeklySync.s.sol:UpdateActivity \
 *     --rpc-url base_sepolia \
 *     --broadcast \
 *     -vvvv
 */
contract UpdateActivity is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address registryAddress = vm.envAddress("REGISTRY_ADDRESS");

        AgentReputationRegistryV2 registry = AgentReputationRegistryV2(registryAddress);

        string memory json = vm.readFile("data/activity-updates.json");

        bytes memory updatesRaw = vm.parseJson(json, ".updates");
        AgentReputationRegistryV2.ActivityUpdate[] memory updates = 
            abi.decode(updatesRaw, (AgentReputationRegistryV2.ActivityUpdate[]));

        console.log("Updating", updates.length, "agent activities...");

        vm.startBroadcast(deployerPrivateKey);

        registry.batchUpdateActivities(updates);

        vm.stopBroadcast();

        console.log("Activity updates complete!");
    }
}

/**
 * @title ExecuteSwap
 * @notice Execute pending token swap
 *
 * Usage:
 *   MIN_AMOUNT_OUT=1000000 forge script script/WeeklySync.s.sol:ExecuteSwap \
 *     --rpc-url base_sepolia \
 *     --broadcast \
 *     -vvvv
 */
contract ExecuteSwap is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address registryAddress = vm.envAddress("REGISTRY_ADDRESS");
        uint256 minAmountOut = vm.envOr("MIN_AMOUNT_OUT", uint256(0));

        AgentReputationRegistryV2 registry = AgentReputationRegistryV2(registryAddress);

        console.log("========================================");
        console.log("Executing Pending Swap");
        console.log("========================================");
        console.log("Pending amount:", registry.pendingSwapAmount());
        console.log("Min amount out:", minAmountOut);

        vm.startBroadcast(deployerPrivateKey);

        uint256 tokensReceived = registry.executePendingSwap(minAmountOut);

        vm.stopBroadcast();

        console.log("Swap executed!");
        console.log("Tokens received:", tokensReceived);
        console.log("Total tokens purchased:", registry.totalTokensPurchased());
    }
}

/**
 * @title GetQuote
 * @notice Get a quote for the pending swap amount
 *
 * Usage:
 *   forge script script/WeeklySync.s.sol:GetQuote \
 *     --rpc-url base_sepolia \
 *     -vvvv
 */
contract GetQuote is Script {
    // Uniswap V3 QuoterV2 address (Base Sepolia)
    address public constant QUOTER_V2 = 0xC5290058841028F1614F3A6F0F5816cAd0df5E27;

    function run() external view {
        address registryAddress = vm.envAddress("REGISTRY_ADDRESS");
        AgentReputationRegistryV2 registry = AgentReputationRegistryV2(registryAddress);

        uint256 pendingAmount = registry.pendingSwapAmount();
        address usdc = address(registry.usdc());
        address purchaseToken = address(registry.purchaseToken());

        console.log("Pending swap amount:", pendingAmount);
        console.log("USDC:", usdc);
        console.log("Purchase token:", purchaseToken);
        console.log("Pool fee:", uint256(registry.POOL_FEE()));

        // Note: Getting actual quote requires calling QuoterV2
        // This is a view script, so we just log the parameters
        console.log("");
        console.log("To get actual quote, call QuoterV2.quoteExactInputSingle with:");
        console.log("  tokenIn:", usdc);
        console.log("  tokenOut:", purchaseToken);
        console.log("  amountIn:", pendingAmount);
        console.log("  fee:", uint256(registry.POOL_FEE()));
    }
}
