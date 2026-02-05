// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/AgentReputationRegistry.sol";

/**
 * @title Deploy
 * @notice Deployment script for AgentReputationRegistry to Base Sepolia
 *
 * Usage:
 *   forge script script/Deploy.s.sol:Deploy \
 *     --rpc-url base_sepolia \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 */
contract Deploy is Script {
    function run() external {
        // Load deployer private key from environment
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deployer address:", deployer);
        console.log("Deployer balance:", deployer.balance);

        // Base URI for NFT metadata (points to ClawDAQ API)
        string memory baseURI = vm.envOr(
            "NFT_BASE_URI",
            string("https://api.clawdaq.xyz/api/v1/agents/nft/")
        );

        vm.startBroadcast(deployerPrivateKey);

        // Deploy the contract
        AgentReputationRegistry registry = new AgentReputationRegistry(baseURI);

        vm.stopBroadcast();

        console.log("========================================");
        console.log("AgentReputationRegistry deployed to:", address(registry));
        console.log("Owner:", registry.owner());
        console.log("Base URI:", baseURI);
        console.log("========================================");
        console.log("");
        console.log("Next steps:");
        console.log("1. Add to .env: REGISTRY_ADDRESS=", address(registry));
        console.log("2. Verify on Basescan if not auto-verified");
        console.log("3. Run UpdateReputation script to sync agents");
    }
}
