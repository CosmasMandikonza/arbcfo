// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IArbCFOTypes — shared structs, enums, events, and errors for ArbCFO
interface IArbCFOTypes {
    // ─── Enums ───
    enum IntentStatus {
        Draft,
        AwaitingApprovals,
        Scheduled,
        Executed,
        Rejected,
        Cancelled,
        PendingRiskReview
    }

    // ─── Structs ───
    struct PaymentIntent {
        uint256 id;
        address creator;
        address vendor;
        address token;
        uint256 amount;
        uint256 categoryId;
        bytes32 invoiceHash;
        bytes32 memoHash;
        uint256 dueDate;
        IntentStatus status;
        uint256 approvalCount;
        uint256 createdAt;
        uint256 executedAt;
    }

    struct PolicyConfig {
        bool vendorAllowlistEnabled;
        uint256 maxPerInvoice;
        bool paused;
    }

    struct CategoryBudget {
        uint256 dailyLimit;
        uint256 spentToday;
        uint256 lastResetDay;
    }

    // ─── Events ───
    event IntentCreated(
        uint256 indexed intentId,
        address indexed creator,
        address vendor,
        address token,
        uint256 amount,
        uint256 categoryId,
        bytes32 invoiceHash,
        bytes32 memoHash,
        uint256 dueDate
    );

    event IntentApproved(uint256 indexed intentId, address indexed approver, uint256 approvalCount);

    event IntentRejected(uint256 indexed intentId, address indexed rejector);

    event IntentExecuted(
        uint256 indexed intentId,
        address indexed vendor,
        address token,
        uint256 amount,
        bytes32 receiptId
    );

    event IntentCancelled(uint256 indexed intentId, address indexed canceller);

    event PaymentReceipt(
        bytes32 indexed receiptId,
        uint256 indexed intentId,
        address vendor,
        address token,
        uint256 amount,
        uint256 categoryId,
        bytes32 invoiceHash,
        bytes32 memoHash,
        uint256 executedAt
    );

    event Deposited(address indexed token, address indexed from, uint256 amount);
    event Withdrawn(address indexed token, address indexed to, uint256 amount);

    // ─── Risk / Oracle Events ───
    event RiskCheckPassed(
        uint256 indexed intentId, address indexed recipient, uint256 compositeScore
    );

    event RiskReviewRequired(
        uint256 indexed intentId,
        address indexed recipient,
        address token,
        uint256 amount,
        uint256 compositeScore,
        uint8 decision
    );

    event RiskBlocked(
        uint256 indexed intentId,
        address indexed recipient,
        address token,
        uint256 amount,
        uint256 compositeScore,
        uint8 decision
    );

    event RiskOverrideApproved(
        uint256 indexed intentId, address indexed approver, uint256 priorScore
    );

    event PolicyUpdated(string policyName);
    event VendorAllowlistUpdated(address indexed vendor, bool allowed);
    event CategoryBudgetUpdated(uint256 indexed categoryId, uint256 dailyLimit);
    event TokenAllowlistUpdated(address indexed token, bool allowed);

    // ─── Errors ───
    error NotAuthorized();
    error IntentNotFound();
    error InvalidStatus(IntentStatus current, IntentStatus expected);
    error PolicyViolation(string reason);
    error InsufficientFunds(uint256 available, uint256 required);
    error InvalidSignature();
    error AlreadyApproved();
    error ThresholdNotMet(uint256 current, uint256 required);
    error ZeroAddress();
    error ZeroAmount();
    error TokenNotAllowed(address token);
    error VendorNotAllowed(address vendor);
    error DailyLimitExceeded(uint256 categoryId, uint256 spent, uint256 limit);
    error MaxPerInvoiceExceeded(uint256 amount, uint256 max);
    error ContractPaused();
    error InvalidThreshold();
    error DuplicateIntent(bytes32 invoiceHash);
    error IntentNotRiskHeld(uint256 intentId);
    error SignatureArrayLengthMismatch();
}
