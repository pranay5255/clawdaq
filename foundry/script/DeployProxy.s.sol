// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/AgentReputationRegistryV1.sol";

/**
 * @title DeployProxy
 * @notice Deploys AgentReputationRegistryV1 behind a UUPS proxy
 *
 * Architecture:
 *   ┌──────────────────┐
 *   │   ERC1967Proxy   │  ← Users interact with this address
 *   │  (storage here)  │
 *   └────────┬─────────┘
 *            │ delegatecall
 *   ┌────────▼─────────┐
 *   │  RegistryV1      │  ← Logic/implementation
 *   │  (stateless)     │
 *   └──────────────────┘
 *
 * Usage:
 *   forge script script/DeployProxy.s.sol:DeployProxy \
 *     --rpc-url base_sepolia \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 */
contract DeployProxy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        string memory baseURI = vm.envOr(
            "NFT_BASE_URI",
            string("https://api.clawdaq.xyz/api/v1/agents/nft/")
        );

        console.log("========================================");
        console.log("Deploying AgentReputationRegistry (UUPS Proxy)");
        console.log("========================================");
        console.log("Deployer:", deployer);
        console.log("Balance:", deployer.balance);
        console.log("Base URI:", baseURI);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy implementation contract
        AgentReputationRegistryV1 implementation = new AgentReputationRegistryV1();
        console.log("Implementation deployed to:", address(implementation));

        // 2. Encode initialization data
        bytes memory initData = abi.encodeWithSelector(
            AgentReputationRegistryV1.initialize.selector,
            baseURI
        );

        // 3. Deploy proxy pointing to implementation
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            initData
        );
        console.log("Proxy deployed to:", address(proxy));

        vm.stopBroadcast();

        // Verify deployment
        AgentReputationRegistryV1 registry = AgentReputationRegistryV1(
            address(proxy)
        );

        console.log("");
        console.log("========================================");
        console.log("Deployment Complete!");
        console.log("========================================");
        console.log("Proxy (interact with this):", address(proxy));
        console.log("Implementation:", address(implementation));
        console.log("Owner:", registry.owner());
        console.log("Version:", registry.version());
        console.log("");
        console.log("Add to .env:");
        console.log("  REGISTRY_ADDRESS=", address(proxy));
        console.log("  IMPLEMENTATION_ADDRESS=", address(implementation));
        console.log("========================================");
    }
}

/**
 * @title UpgradeProxy
 * @notice Upgrades the proxy to a new implementation
 *
 * Usage:
 *   NEW_IMPLEMENTATION=0x... forge script script/DeployProxy.s.sol:UpgradeProxy \
 *     --rpc-url base_sepolia \
 *     --broadcast
 */
contract UpgradeProxy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address proxyAddress = vm.envAddress("REGISTRY_ADDRESS");
        address newImplementation = vm.envAddress("NEW_IMPLEMENTATION");

        AgentReputationRegistryV1 proxy = AgentReputationRegistryV1(
            proxyAddress
        );

        console.log("========================================");
        console.log("Upgrading AgentReputationRegistry");
        console.log("========================================");
        console.log("Proxy:", proxyAddress);
        console.log("Current version:", proxy.version());
        console.log("New implementation:", newImplementation);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Upgrade to new implementation
        proxy.upgradeTo(newImplementation);

        vm.stopBroadcast();

        console.log("Upgrade complete!");
        console.log("New version:", proxy.version());
    }
}
