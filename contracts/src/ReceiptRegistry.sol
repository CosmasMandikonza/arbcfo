// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IArbCFOTypes } from "./IArbCFOTypes.sol";

/// @title ReceiptRegistry — Immutable onchain receipt storage for audit trails
/// @notice Stores receipts indexed by receiptId. More gas-efficient than ERC-721 for this use case.
contract ReceiptRegistry is AccessControl, IArbCFOTypes {
    bytes32 public constant VAULT_ROLE = keccak256("VAULT_ROLE");

    struct ReceiptData {
        bytes32 receiptId;
        uint256 intentId;
        address vendor;
        address token;
        uint256 amount;
        uint256 categoryId;
        bytes32 invoiceHash;
        bytes32 memoHash;
        uint256 executedAt;
        bool exists;
    }

    mapping(bytes32 => ReceiptData) public receipts;
    bytes32[] public receiptIds;

    // ─── Events ───
    event ReceiptMinted(
        bytes32 indexed receiptId,
        uint256 indexed intentId,
        address vendor,
        uint256 amount,
        uint256 executedAt
    );

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VAULT_ROLE, admin); // will be reassigned to vault
    }

    /// @notice Store a receipt. Only callable by the Vault.
    function mintReceipt(
        bytes32 receiptId,
        uint256 intentId,
        address vendor,
        address token,
        uint256 amount,
        uint256 categoryId,
        bytes32 invoiceHash,
        bytes32 memoHash
    ) external onlyRole(VAULT_ROLE) {
        require(!receipts[receiptId].exists, "Receipt already exists");

        receipts[receiptId] = ReceiptData({
            receiptId: receiptId,
            intentId: intentId,
            vendor: vendor,
            token: token,
            amount: amount,
            categoryId: categoryId,
            invoiceHash: invoiceHash,
            memoHash: memoHash,
            executedAt: block.timestamp,
            exists: true
        });

        receiptIds.push(receiptId);

        emit ReceiptMinted(receiptId, intentId, vendor, amount, block.timestamp);
    }

    // ─── Views ───

    function getReceipt(bytes32 receiptId) external view returns (ReceiptData memory) {
        require(receipts[receiptId].exists, "Receipt not found");
        return receipts[receiptId];
    }

    function getReceiptCount() external view returns (uint256) {
        return receiptIds.length;
    }

    function getReceiptIdAtIndex(uint256 index) external view returns (bytes32) {
        return receiptIds[index];
    }
}
