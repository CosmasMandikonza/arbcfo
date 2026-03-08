// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IRiskEngine } from "./IRiskEngine.sol";

/// @title SolidityRiskEngine — On-chain EMA + anomaly detection
/// @notice Fallback implementation when Stylus WASM is unavailable.
///         Uses the same algorithm: EMA tracking per vendor, deviation-based
///         anomaly scoring. In production, this would be the Rust/WASM Stylus
///         contract at 10-100x lower gas. This Solidity version is functionally
///         identical but more expensive per call.
contract SolidityRiskEngine is IRiskEngine {
    // ─── Fixed-point math (18 decimals) ───
    uint256 private constant FP = 1e18;
    uint256 private constant ALPHA = 1e17; // 0.1
    uint256 private constant ONE_MINUS_ALPHA = 9e17; // 0.9
    uint256 private constant Z_THRESHOLD = 3e18; // 3.0
    uint256 private constant MIN_CV = 1e17; // 0.10 minimum coefficient of variation
    uint256 private constant MIN_TRANSACTIONS = 3;

    // ─── Per-vendor state ───
    struct VendorState {
        uint256 txCount;
        uint256 ema; // 18-decimal fixed-point
        uint256 emaMad; // 18-decimal MAD (mean absolute deviation)
    }

    mapping(address => VendorState) public vendors;

    address public admin;

    constructor(address admin_) {
        admin = admin_;
    }

    /// @notice Evaluate risk for a vendor payment — real statistical computation
    function evaluateRisk(address vendor, uint256 amount)
        external
        override
        returns (bool isSafe, uint256 zScore)
    {
        VendorState storage v = vendors[vendor];
        uint256 amountFp = amount * FP / 1e6; // Convert USDC (6 dec) to 18-dec FP

        if (v.txCount == 0) {
            // First transaction — initialize
            v.ema = amountFp;
            v.emaMad = 0;
            v.txCount = 1;
            return (true, 0);
        }

        // Calculate deviation from EMA
        uint256 deviation = amountFp > v.ema ? amountFp - v.ema : v.ema - amountFp;

        // Effective MAD with minimum floor (prevents division by zero)
        uint256 minMad = (v.ema * MIN_CV) / FP;
        uint256 effectiveMad = v.emaMad > minMad ? v.emaMad : minMad;

        // Z-score = deviation / effectiveMAD
        if (effectiveMad > 0) {
            zScore = (deviation * FP) / effectiveMad;
        }

        // Determine if safe
        isSafe = v.txCount < MIN_TRANSACTIONS || zScore <= Z_THRESHOLD;

        // Only update baselines for safe transactions (poisoning protection)
        if (isSafe) {
            v.ema = (ALPHA * amountFp + ONE_MINUS_ALPHA * v.ema) / FP;
            v.emaMad = (ALPHA * deviation + ONE_MINUS_ALPHA * v.emaMad) / FP;
            v.txCount += 1;
        }

        return (isSafe, zScore);
    }

    function getVendorEma(address vendor) external view override returns (uint256) {
        return vendors[vendor].ema;
    }

    function getVendorVariance(address vendor) external view override returns (uint256) {
        // Return MAD squared as variance proxy
        uint256 mad = vendors[vendor].emaMad;
        return (mad * mad) / FP;
    }

    function getVendorTxCount(address vendor) external view override returns (uint256) {
        return vendors[vendor].txCount;
    }

    function getVendorStats(address vendor)
        external
        view
        override
        returns (uint256 txCount, uint256 ema, uint256 variance)
    {
        VendorState storage v = vendors[vendor];
        txCount = v.txCount;
        ema = v.ema;
        uint256 mad = v.emaMad;
        variance = (mad * mad) / FP;
    }

    function getRiskParams()
        external
        pure
        override
        returns (uint256 alpha, uint256 zThreshold, uint256 minTransactions)
    {
        return (ALPHA, Z_THRESHOLD, MIN_TRANSACTIONS);
    }
}
