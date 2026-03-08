// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ITransactionRiskOracle
/// @notice Composite risk oracle for onchain financial actions.
interface ITransactionRiskOracle {
    enum OracleDecision {
        SAFE,
        REVIEW,
        BLOCK
    }

    /// @notice Assess risk for a financial action.
    /// @param initiator The account initiating the action.
    /// @param recipient The recipient of value.
    /// @param token The asset being moved.
    /// @param amount The amount in token base units.
    function assessRisk(address initiator, address recipient, address token, uint256 amount)
        external
        returns (uint256 compositeScore, OracleDecision decision, bytes memory breakdown);

    /// @notice Preview risk without mutating oracle state.
    function previewRisk(address initiator, address recipient, address token, uint256 amount)
        external
        view
        returns (uint256 compositeScore, OracleDecision decision);
}
