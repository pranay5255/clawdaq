// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/Agent0CustodialRegistry.sol";

/**
 * @title DeployAgent0CustodialV2
 * @notice Enhanced deployment script for Agent0CustodialRegistry with network detection
 * @dev Supports Base Sepolia, Base Mainnet, and local Anvil
 */
contract DeployAgent0CustodialV2 is Script {
    // Base Sepolia addresses
    address constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    uint256 constant BASE_SEPOLIA_CHAIN_ID = 84532;

    // Base Mainnet addresses
    address constant BASE_MAINNET_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    uint256 constant BASE_MAINNET_CHAIN_ID = 8453;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        uint256 chainId = block.chainid;
        address usdcAddress;
        string memory network;

        // Network detection
        if (chainId == BASE_SEPOLIA_CHAIN_ID) {
            network = "Base Sepolia";
            usdcAddress = BASE_SEPOLIA_USDC;
        } else if (chainId == BASE_MAINNET_CHAIN_ID) {
            network = "Base Mainnet";
            usdcAddress = BASE_MAINNET_USDC;

            // Extra safety for mainnet
            console.log("========================================");
            console.log("WARNING: MAINNET DEPLOYMENT");
            console.log("Press Ctrl+C to cancel or wait 10 seconds...");
            console.log("========================================");
            vm.sleep(10000);

            require(
                vm.envOr("CONFIRM_MAINNET_DEPLOY", false),
                "Set CONFIRM_MAINNET_DEPLOY=true to deploy to mainnet"
            );
        } else if (chainId == 31337) {
            // Local Anvil
            network = "Local Anvil";
            usdcAddress = address(0); // Will deploy mock
        } else {
            revert("Unsupported network");
        }

        console.log("========================================");
        console.log("Deploying Agent0CustodialRegistry");
        console.log("========================================");
        console.log("Network:", network);
        console.log("Chain ID:", chainId);
        console.log("Deployer:", deployer);
        console.log("Deployer Balance:", deployer.balance);
        console.log("========================================");

        // Validate USDC on real networks
        if (chainId != 31337) {
            require(usdcAddress != address(0), "USDC address not set");

            // Check USDC exists and has correct decimals
            (bool success, bytes memory data) = usdcAddress.staticcall(
                abi.encodeWithSignature("decimals()")
            );
            require(success, "USDC contract not found at specified address");
            uint8 decimals = abi.decode(data, (uint8));
            require(decimals == 6, "USDC must have 6 decimals");

            console.log("USDC Address:", usdcAddress);
            console.log("USDC Decimals:", decimals);
            console.log("========================================");
        }

        vm.startBroadcast(deployerPrivateKey);

        // Deploy mock USDC for local testing
        if (chainId == 31337) {
            console.log("Deploying Mock USDC for local testing...");
            MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
            usdcAddress = address(usdc);
            usdc.mint(deployer, 1000_000_000); // Mint $1000 USDC
            console.log("Mock USDC deployed:", usdcAddress);
            console.log("Minted 1000 USDC to deployer");
            console.log("========================================");
        }

        // Deploy registry
        console.log("Deploying Agent0CustodialRegistry...");
        Agent0CustodialRegistry registry = new Agent0CustodialRegistry(usdcAddress, deployer);

        vm.stopBroadcast();

        // Log deployment info
        console.log("\n========================================");
        console.log("DEPLOYMENT SUCCESSFUL!");
        console.log("========================================");
        console.log("Registry Address:", address(registry));
        console.log("Owner:", registry.owner());
        console.log("USDC:", address(registry.usdc()));
        console.log("Registration Fee:", registry.REGISTRATION_FEE(), "($5.00 USDC)");
        console.log("Max Batch Size:", registry.MAX_BATCH_SIZE());
        console.log("Total Agents:", registry.totalAgents());
        console.log("Treasury Balance:", registry.treasuryBalance());
        console.log("========================================");

        // Save to .env format
        console.log("\nAdd to .env:");
        console.log(string(abi.encodePacked("REGISTRY_ADDRESS=", vm.toString(address(registry)))));
        console.log(string(abi.encodePacked("USDC_ADDRESS=", vm.toString(usdcAddress))));
        console.log("========================================");

        // Save deployment info to JSON
        string memory json = string(abi.encodePacked(
            '{\n',
            '  "network": "', network, '",\n',
            '  "chainId": ', vm.toString(chainId), ',\n',
            '  "registryAddress": "', vm.toString(address(registry)), '",\n',
            '  "usdcAddress": "', vm.toString(usdcAddress), '",\n',
            '  "deployer": "', vm.toString(deployer), '",\n',
            '  "owner": "', vm.toString(registry.owner()), '",\n',
            '  "registrationFee": ', vm.toString(registry.REGISTRATION_FEE()), ',\n',
            '  "maxBatchSize": ', vm.toString(registry.MAX_BATCH_SIZE()), ',\n',
            '  "blockNumber": ', vm.toString(block.number), ',\n',
            '  "timestamp": ', vm.toString(block.timestamp), ',\n',
            '  "deployedAt": "', vm.toString(block.timestamp), '"\n',
            '}'
        ));

        string memory filename = string(abi.encodePacked(
            "deployments/agent0-custodial-",
            vm.toString(chainId),
            ".json"
        ));

        vm.writeFile(filename, json);
        console.log("\nDeployment info saved to:", filename);
        console.log("========================================\n");
    }
}

/**
 * @title MockERC20
 * @notice Mock USDC token for local Anvil testing
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
