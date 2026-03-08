// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { IArbCFOTypes } from "./IArbCFOTypes.sol";

/// @title PolicyEngine — onchain guardrails for payment intents
/// @notice Enforces vendor allowlist, per-invoice max, daily category budgets, token allowlist, and emergency pause.
contract PolicyEngine is AccessControl, Pausable, IArbCFOTypes {
    // ─── Roles ───
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant VAULT_ROLE = keccak256("VAULT_ROLE");

    // ─── State ───
    PolicyConfig public config;

    mapping(address => bool) public allowedVendors;
    mapping(address => bool) public allowedTokens;
    mapping(uint256 => CategoryBudget) public categoryBudgets;

    // ─── Constructor ───
    constructor(address admin, uint256 maxPerInvoice_) {
        if (admin == address(0)) revert ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);

        config = PolicyConfig({
            vendorAllowlistEnabled: false, maxPerInvoice: maxPerInvoice_, paused: false
        });
    }

    // ─── Policy Checks (called by Vault before execution) ───

    /// @notice Validate a payment intent against all active policies.
    /// @dev Reverts with PolicyViolation or specific error if any check fails.
    function validateIntent(address vendor, address token, uint256 amount, uint256 categoryId)
        external
        whenNotPaused
    {
        // Token allowlist
        if (!allowedTokens[token]) revert TokenNotAllowed(token);

        // Vendor allowlist (optional)
        if (config.vendorAllowlistEnabled && !allowedVendors[vendor]) {
            revert VendorNotAllowed(vendor);
        }

        // Max per invoice
        if (config.maxPerInvoice > 0 && amount > config.maxPerInvoice) {
            revert MaxPerInvoiceExceeded(amount, config.maxPerInvoice);
        }

        // Daily category budget
        CategoryBudget storage budget = categoryBudgets[categoryId];
        if (budget.dailyLimit > 0) {
            uint256 today = block.timestamp / 1 days;
            if (budget.lastResetDay < today) {
                budget.spentToday = 0;
                budget.lastResetDay = today;
            }
            if (budget.spentToday + amount > budget.dailyLimit) {
                revert DailyLimitExceeded(categoryId, budget.spentToday + amount, budget.dailyLimit);
            }
        }
    }

    /// @notice Record spending against a category budget after successful execution.
    /// @dev Only callable by the Vault contract.
    function recordSpend(uint256 categoryId, uint256 amount) external onlyRole(VAULT_ROLE) {
        CategoryBudget storage budget = categoryBudgets[categoryId];
        if (budget.dailyLimit > 0) {
            uint256 today = block.timestamp / 1 days;
            if (budget.lastResetDay < today) {
                budget.spentToday = 0;
                budget.lastResetDay = today;
            }
            budget.spentToday += amount;
        }
    }

    // ─── Admin: Vendor Allowlist ───

    function setVendorAllowlistEnabled(bool enabled) external onlyRole(ADMIN_ROLE) {
        config.vendorAllowlistEnabled = enabled;
        emit PolicyUpdated("vendorAllowlistEnabled");
    }

    function setVendorAllowed(address vendor, bool allowed) external onlyRole(ADMIN_ROLE) {
        if (vendor == address(0)) revert ZeroAddress();
        allowedVendors[vendor] = allowed;
        emit VendorAllowlistUpdated(vendor, allowed);
    }

    function batchSetVendors(address[] calldata vendors, bool[] calldata allowed)
        external
        onlyRole(ADMIN_ROLE)
    {
        require(vendors.length == allowed.length, "Length mismatch");
        for (uint256 i = 0; i < vendors.length; i++) {
            if (vendors[i] == address(0)) revert ZeroAddress();
            allowedVendors[vendors[i]] = allowed[i];
            emit VendorAllowlistUpdated(vendors[i], allowed[i]);
        }
    }

    // ─── Admin: Token Allowlist ───

    function setTokenAllowed(address token, bool allowed) external onlyRole(ADMIN_ROLE) {
        if (token == address(0)) revert ZeroAddress();
        allowedTokens[token] = allowed;
        emit TokenAllowlistUpdated(token, allowed);
    }

    // ─── Admin: Invoice Max ───

    function setMaxPerInvoice(uint256 max) external onlyRole(ADMIN_ROLE) {
        config.maxPerInvoice = max;
        emit PolicyUpdated("maxPerInvoice");
    }

    // ─── Admin: Category Budgets ───

    function setCategoryBudget(uint256 categoryId, uint256 dailyLimit)
        external
        onlyRole(ADMIN_ROLE)
    {
        categoryBudgets[categoryId].dailyLimit = dailyLimit;
        emit CategoryBudgetUpdated(categoryId, dailyLimit);
    }

    // ─── Admin: Emergency Pause ───

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
        config.paused = true;
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
        config.paused = false;
    }

    // ─── View helpers ───

    function getCategorySpentToday(uint256 categoryId) external view returns (uint256) {
        CategoryBudget storage budget = categoryBudgets[categoryId];
        uint256 today = block.timestamp / 1 days;
        if (budget.lastResetDay < today) return 0;
        return budget.spentToday;
    }

    function isPolicyPassing(address vendor, address token, uint256 amount, uint256 categoryId)
        external
        view
        returns (bool passing, string memory reason)
    {
        if (paused()) return (false, "Contract paused");
        if (!allowedTokens[token]) return (false, "Token not allowed");
        if (config.vendorAllowlistEnabled && !allowedVendors[vendor]) {
            return (false, "Vendor not allowed");
        }
        if (config.maxPerInvoice > 0 && amount > config.maxPerInvoice) {
            return (false, "Exceeds max per invoice");
        }

        CategoryBudget storage budget = categoryBudgets[categoryId];
        if (budget.dailyLimit > 0) {
            uint256 today = block.timestamp / 1 days;
            uint256 spent = budget.lastResetDay < today ? 0 : budget.spentToday;
            if (spent + amount > budget.dailyLimit) {
                return (false, "Daily category limit exceeded");
            }
        }

        return (true, "");
    }
}
