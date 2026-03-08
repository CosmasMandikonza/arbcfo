// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IRiskEngine — Solidity interface for the Stylus WASM Risk Engine
/// @notice Calls into the Arbitrum Stylus (Rust/WASM) contract for statistical
///         anomaly detection on vendor payments using EMA + Z-score analysis.
///         Cross-VM call is transparent — same ABI encoding as a Solidity call.
interface IRiskEngine {
    /// @notice Evaluate the risk of a vendor payment
    /// @param vendor The vendor address being paid
    /// @param amount The payment amount in token base units
    /// @return isSafe Whether the payment is within normal statistical range
    /// @return zScore The calculated Z-score (18-decimal fixed-point)
    function evaluateRisk(address vendor, uint256 amount)
        external
        returns (bool isSafe, uint256 zScore);

    /// @notice Get the current EMA for a vendor (18-decimal fixed-point)
    function getVendorEma(address vendor) external view returns (uint256);

    /// @notice Get the current variance for a vendor (18-decimal fixed-point)
    function getVendorVariance(address vendor) external view returns (uint256);

    /// @notice Get the transaction count for a vendor
    function getVendorTxCount(address vendor) external view returns (uint256);

    /// @notice Get all vendor stats in one call
    function getVendorStats(address vendor)
        external
        view
        returns (uint256 txCount, uint256 ema, uint256 variance);

    /// @notice Get the risk engine parameters (alpha, zThreshold, minTransactions)
    function getRiskParams()
        external
        view
        returns (uint256 alpha, uint256 zThreshold, uint256 minTransactions);
}
