// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/AgentReputationRegistryV2.sol";

/**
 * @title DeployV2
 * @notice Deploys AgentReputationRegistryV2 behind a UUPS proxy
 *
 * Architecture:
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                     Deployment Overview                          │
 *   │                                                                  │
 *   │   ┌──────────────────┐         ┌──────────────────────────┐     │
 *   │   │   ERC1967Proxy   │  ←      │  AgentReputationRegistryV2│    │
 *   │   │  (storage here)  │         │  Implementation           │    │
 *   │   │                  │         │  (stateless)              │    │
 *   │   │  - USDC Treasury │         │  - ERC721 + Treasury      │    │
 *   │   │  - Token Balance │         │  - Uniswap Integration    │    │
 *   │   │  - Activity Data │         └──────────────────────────┘     │
 *   │   └────────┬─────────┘                                          │
 *   │            │ delegatecall                                      │
 *   │            ▼                                                   │
 *   │   ┌──────────────────────────────────────────────────────────┐ │
 *   │   │   Contracts Interacted With:                             │ │
 *   │   │   • USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e     │ │
 *   │   │   • Uniswap V3 Router: 0x2626664c2603336E57B271c5C0b26F421741e481 │ │
 *   │   └──────────────────────────────────────────────────────────┘ │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * Usage:
 *   # Set environment variables in .env
 *   USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
 *   PURCHASE_TOKEN_ADDRESS=0x... # Token to buy with $1
 *   SWAP_ROUTER_ADDRESS=0x2626664c2603336E57B271c5C0b26F421741e481
 *
 *   # Deploy to Base Sepolia testnet
 *   forge script script/DeployV2.s.sol:DeployV2 \
 *     --rpc-url base_sepolia \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 *
 *   # Deploy to Base mainnet
 *   forge script script/DeployV2.s.sol:DeployV2 \
 *     --rpc-url base \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 */
contract DeployV2 is Script {
    // Base Sepolia addresses
    address public constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address public constant BASE_SEPOLIA_ROUTER = 0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4;
    
    // Base mainnet addresses
    address public constant BASE_MAINNET_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address public constant BASE_MAINNET_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        uint256 chainId = block.chainid;
        
        // Determine network and set addresses
        address usdc;
        address swapRouter;
        address purchaseToken;
        string memory network;
        
        if (chainId == 84532) {
            // Base Sepolia
            network = "Base Sepolia";
            usdc = BASE_SEPOLIA_USDC;
            swapRouter = BASE_SEPOLIA_ROUTER;
        } else if (chainId == 8453) {
            // Base Mainnet
            network = "Base Mainnet";
            usdc = BASE_MAINNET_USDC;
            swapRouter = BASE_MAINNET_ROUTER;
        } else {
            // Use env variables for other networks
            network = "Custom";
            usdc = vm.envAddress("USDC_ADDRESS");
            swapRouter = vm.envAddress("SWAP_ROUTER_ADDRESS");
        }
        
        // Get purchase token from env
        purchaseToken = vm.envAddress("PURCHASE_TOKEN_ADDRESS");
        
        string memory baseURI = vm.envOr(
            "NFT_BASE_URI",
            string("https://api.clawdaq.xyz/api/v1/agents/nft/")
        );

        console.log("========================================");
        console.log("Deploying AgentReputationRegistryV2");
        console.log("========================================");
        console.log("Network:", network);
        console.log("Chain ID:", chainId);
        console.log("Deployer:", deployer);
        console.log("Balance:", deployer.balance);
        console.log("USDC:", usdc);
        console.log("Purchase Token:", purchaseToken);
        console.log("Swap Router:", swapRouter);
        console.log("Base URI:", baseURI);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy implementation contract
        AgentReputationRegistryV2 implementation = new AgentReputationRegistryV2();
        console.log("Implementation deployed to:", address(implementation));

        // 2. Encode initialization data
        bytes memory initData = abi.encodeWithSelector(
            AgentReputationRegistryV2.initialize.selector,
            baseURI,
            usdc,
            purchaseToken,
            swapRouter
        );

        // 3. Deploy proxy pointing to implementation
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            initData
        );
        console.log("Proxy deployed to:", address(proxy));

        vm.stopBroadcast();

        // Verify deployment
        AgentReputationRegistryV2 registry = AgentReputationRegistryV2(
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
        console.log("Treasury Configuration:");
        console.log("  - Registration Fee: $5 USDC");
        console.log("  - Swap Amount: $1 USDC per registration");
        console.log("  - Treasury Amount: $4 USDC per registration");
        console.log("");
        console.log("Add to .env:");
        console.log(string(abi.encodePacked("  REGISTRY_ADDRESS=", vm.toString(address(proxy)))));
        console.log(string(abi.encodePacked("  IMPLEMENTATION_ADDRESS=", vm.toString(address(implementation)))));
        console.log("========================================");
    }
}

/**
 * @title UpgradeToV2
 * @notice Upgrades an existing V1 proxy to V2
 *
 * Prerequisites:
 *   - Original proxy was deployed with UUPS pattern
 *   - You have the deployer private key
 *
 * Usage:
 *   # First deploy V2 implementation
 *   forge script script/DeployV2.s.sol:DeployV2Impl \
 *     --rpc-url base_sepolia \
 *     --broadcast \
 *     -vvvv
 *
 *   # Then upgrade the proxy
 *   NEW_IMPLEMENTATION=0x... forge script script/DeployV2.s.sol:UpgradeToV2 \
 *     --rpc-url base_sepolia \
 *     --broadcast \
 *     -vvvv
 */
contract UpgradeToV2 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address proxyAddress = vm.envAddress("REGISTRY_ADDRESS");
        address newImplementation = vm.envAddress("NEW_IMPLEMENTATION");
        
        // V2 initialization parameters (for V1 -> V2 upgrade)
        address usdc = vm.envAddress("USDC_ADDRESS");
        address purchaseToken = vm.envAddress("PURCHASE_TOKEN_ADDRESS");
        address swapRouter = vm.envAddress("SWAP_ROUTER_ADDRESS");

        console.log("========================================");
        console.log("Upgrading to AgentReputationRegistryV2");
        console.log("========================================");
        console.log("Proxy:", proxyAddress);
        console.log("New Implementation:", newImplementation);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Get proxy contract
        AgentReputationRegistryV2 proxy = AgentReputationRegistryV2(proxyAddress);
        
        // Upgrade and reinitialize with new parameters
        // Note: This pattern assumes the proxy was initialized with V1
        // You may need to adjust based on actual V1 state
        proxy.upgradeToAndCall(
            newImplementation,
            abi.encodeWithSelector(
                AgentReputationRegistryV2.initialize.selector,
                "",  // baseURI (should be same as V1)
                usdc,
                purchaseToken,
                swapRouter
            )
        );

        vm.stopBroadcast();

        console.log("Upgrade complete!");
        console.log("New version:", proxy.version());
        console.log("Owner:", proxy.owner());
    }
}

/**
 * @title DeployV2Impl
 * @notice Deploys only the V2 implementation (for upgrades)
 *
 * Usage:
 *   forge script script/DeployV2.s.sol:DeployV2Impl \
 *     --rpc-url base_sepolia \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 */
contract DeployV2Impl is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("========================================");
        console.log("Deploying V2 Implementation Only");
        console.log("========================================");
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        AgentReputationRegistryV2 implementation = new AgentReputationRegistryV2();

        vm.stopBroadcast();

        console.log("Implementation deployed to:", address(implementation));
        console.log("");
        console.log("Use this address with UpgradeToV2 script");
        console.log(string(abi.encodePacked("  NEW_IMPLEMENTATION=", vm.toString(address(implementation)))));
    }
}

/**
 * @title RegisterAgent
 * @notice Helper script to register a single agent with payment
 *
 * Usage:
 *   AGENT_ID="agent_test123" AGENT_WALLET="0x..." \
 *   forge script script/DeployV2.s.sol:RegisterAgent \
 *     --rpc-url base_sepolia \
 *     --broadcast
 */
contract RegisterAgent is Script {
    function run() external {
        uint256 agentPrivateKey = vm.envUint("AGENT_PRIVATE_KEY");
        address registryAddress = vm.envAddress("REGISTRY_ADDRESS");
        string memory agentId = vm.envString("AGENT_ID");
        address agentWallet = vm.envAddress("AGENT_WALLET");
        
        AgentReputationRegistryV2 registry = AgentReputationRegistryV2(registryAddress);
        address usdc = address(registry.usdc());

        console.log("========================================");
        console.log("Registering Agent");
        console.log("========================================");
        console.log("Agent ID:", agentId);
        console.log("Agent Wallet:", agentWallet);
        console.log("Registration Fee:", registry.REGISTRATION_FEE());

        vm.startBroadcast(agentPrivateKey);

        // Approve USDC
        IERC20(usdc).approve(registryAddress, registry.REGISTRATION_FEE());
        
        // Register agent
        uint256 tokenId = registry.registerAgentWithPayment(agentId, agentWallet);

        vm.stopBroadcast();

        console.log("Registration complete!");
        console.log("Token ID:", tokenId);
    }
}

/**
 * @title WithdrawTreasury
 * @notice Withdraw USDC from treasury
 *
 * Usage:
 *   WITHDRAW_AMOUNT=5000000 WITHDRAW_TO=0x... \
 *   forge script script/DeployV2.s.sol:WithdrawTreasury \
 *     --rpc-url base_sepolia \
 *     --broadcast
 */
contract WithdrawTreasury is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address registryAddress = vm.envAddress("REGISTRY_ADDRESS");
        uint256 amount = vm.envUint("WITHDRAW_AMOUNT");
        address to = vm.envAddress("WITHDRAW_TO");

        AgentReputationRegistryV2 registry = AgentReputationRegistryV2(registryAddress);

        console.log("========================================");
        console.log("Withdrawing Treasury");
        console.log("========================================");
        console.log("Amount:", amount);
        console.log("To:", to);
        console.log("Current treasury:", registry.treasuryBalance());

        vm.startBroadcast(deployerPrivateKey);

        registry.withdrawTreasury(amount, to);

        vm.stopBroadcast();

        console.log("Withdrawal complete!");
        console.log("New treasury balance:", registry.treasuryBalance());
    }
}
