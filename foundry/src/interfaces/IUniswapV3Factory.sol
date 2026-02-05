// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/**
 * @title IUniswapV3Factory
 * @notice Interface for the Uniswap V3 factory
 * @dev From https://github.com/Uniswap/v3-core/blob/main/contracts/interfaces/IUniswapV3Factory.sol
 */
interface IUniswapV3Factory {
    /// @notice Returns the pool address for a given pair of tokens and a fee, or address 0 if it does not exist
    function getPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external view returns (address pool);
}
