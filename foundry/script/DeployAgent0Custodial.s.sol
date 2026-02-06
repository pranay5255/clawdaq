// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
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
 * @title DeployAgent0CustodialScript
 * @notice Deployment script for Agent0CustodialRegistry on Anvil testnet
 */
contract DeployAgent0CustodialScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));

        vm.startBroadcast(deployerPrivateKey);

        // Deploy mock USDC
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        console.log("Mock USDC deployed at:", address(usdc));

        // Deploy Agent0CustodialRegistry
        Agent0CustodialRegistry registry = new Agent0CustodialRegistry(address(usdc));
        console.log("Agent0CustodialRegistry deployed at:", address(registry));
        console.log("Owner:", registry.owner());
        console.log("Registration Fee:", registry.REGISTRATION_FEE());

        // Mint USDC to deployer for testing
        usdc.mint(msg.sender, 1000_000_000); // $1000 USDC
        console.log("Minted 1000 USDC to deployer:", msg.sender);

        vm.stopBroadcast();

        // Save deployment addresses
        console.log("\n=== Deployment Summary ===");
        console.log("USDC Address:", address(usdc));
        console.log("Registry Address:", address(registry));
        console.log("Deployer Address:", msg.sender);
        console.log("==========================\n");
    }
}
