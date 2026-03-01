import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data
  await prisma.approval.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.intent.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.teamMember.deleteMany();

  const now = Math.floor(Date.now() / 1000);
  const day = 86400;
  const hour = 3600;

  // ── Vendors ──
  await prisma.vendor.createMany({
    data: [
      { address: "0x1234567890abcdef1234567890abcdef12345678", name: "Acme Cloud Services", allowed: true, addedAt: now - 90 * day },
      { address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd", name: "DigitalOcean", allowed: true, addedAt: now - 60 * day },
      { address: "0x9876543210fedcba9876543210fedcba98765432", name: "AWS Billing", allowed: true, addedAt: now - 120 * day },
      { address: "0x1111111111111111111111111111111111111111", name: "Vercel Inc", allowed: true, addedAt: now - 45 * day },
      { address: "0x2222222222222222222222222222222222222222", name: "OpenAI API", allowed: true, addedAt: now - 30 * day },
      { address: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef", name: "Unknown Vendor LLC", allowed: false, addedAt: now },
    ],
  });

  // ── Team ──
  await prisma.teamMember.createMany({
    data: [
      { address: "0x0000000000000000000000000000000000000001", name: "Alice Chen (Admin)", role: "ADMIN" },
      { address: "0x0000000000000000000000000000000000000002", name: "Bob Martinez (Approver)", role: "APPROVER" },
      { address: "0x0000000000000000000000000000000000000003", name: "Carol Liu (Operator)", role: "OPERATOR" },
      { address: "0x0000000000000000000000000000000000000004", name: "David Kim (Approver)", role: "APPROVER" },
    ],
  });

  // ── Intents — tells a story for the demo ──
  await prisma.intent.createMany({
    data: [
      // --- SCENARIO 1: Normal recurring payment (Acme, ~$2,500/mo) ---
      // History: several past executed payments
      {
        id: 1, creator: "0x0000000000000000000000000000000000000003",
        vendor: "0x1234567890abcdef1234567890abcdef12345678", vendorName: "Acme Cloud Services",
        token: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", amount: "2400000000", amountFormatted: 2400,
        categoryId: 1, invoiceHash: "0x" + "e1".repeat(32), memoHash: "0x" + "f1".repeat(32),
        memo: "Monthly cloud hosting - November 2024", dueDate: now - 60 * day,
        status: 3, approvalCount: 2, createdAt: now - 65 * day, executedAt: now - 62 * day,
        invoiceNumber: "INV-2024-011", txHash: "0x" + "c1".repeat(32), receiptId: "0x" + "r1".repeat(32),
      },
      {
        id: 2, creator: "0x0000000000000000000000000000000000000003",
        vendor: "0x1234567890abcdef1234567890abcdef12345678", vendorName: "Acme Cloud Services",
        token: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", amount: "2500000000", amountFormatted: 2500,
        categoryId: 1, invoiceHash: "0x" + "e2".repeat(32), memoHash: "0x" + "f2".repeat(32),
        memo: "Monthly cloud hosting - December 2024", dueDate: now - 30 * day,
        status: 3, approvalCount: 2, createdAt: now - 35 * day, executedAt: now - 32 * day,
        invoiceNumber: "INV-2024-012", txHash: "0x" + "c2".repeat(32), receiptId: "0x" + "r2".repeat(32),
      },
      {
        id: 3, creator: "0x0000000000000000000000000000000000000003",
        vendor: "0x1234567890abcdef1234567890abcdef12345678", vendorName: "Acme Cloud Services",
        token: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", amount: "2500000000", amountFormatted: 2500,
        categoryId: 1, invoiceHash: "0x" + "a1".repeat(32), memoHash: "0x" + "b1".repeat(32),
        memo: "Monthly cloud hosting - January 2025", dueDate: now + 7 * day,
        status: 1, approvalCount: 1, createdAt: now - 2 * day, invoiceNumber: "INV-2025-001",
      },

      // --- SCENARIO 2: Executed small payment (DigitalOcean) ---
      {
        id: 4, creator: "0x0000000000000000000000000000000000000003",
        vendor: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd", vendorName: "DigitalOcean",
        token: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", amount: "850000000", amountFormatted: 850,
        categoryId: 1, invoiceHash: "0x" + "a2".repeat(32), memoHash: "0x" + "b2".repeat(32),
        memo: "Droplet hosting Q1", dueDate: now + 14 * day,
        status: 3, approvalCount: 2, createdAt: now - 5 * day, executedAt: now - 1 * day,
        invoiceNumber: "INV-2025-002", txHash: "0x" + "cc".repeat(32), receiptId: "0x" + "dd".repeat(32),
      },

      // --- SCENARIO 3: Anomalous spike from known vendor (AWS $12k vs avg $3k) ---
      // This is what triggers the circuit breaker in the risk panel
      {
        id: 5, creator: "0x0000000000000000000000000000000000000001",
        vendor: "0x9876543210fedcba9876543210fedcba98765432", vendorName: "AWS Billing",
        token: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", amount: "3200000000", amountFormatted: 3200,
        categoryId: 0, invoiceHash: "0x" + "e5".repeat(32), memoHash: "0x" + "f5".repeat(32),
        memo: "AWS infrastructure - December 2024", dueDate: now - 30 * day,
        status: 3, approvalCount: 2, createdAt: now - 40 * day, executedAt: now - 35 * day,
        invoiceNumber: "INV-2024-AWS-12", txHash: "0x" + "c5".repeat(32), receiptId: "0x" + "r5".repeat(32),
      },
      {
        id: 6, creator: "0x0000000000000000000000000000000000000001",
        vendor: "0x9876543210fedcba9876543210fedcba98765432", vendorName: "AWS Billing",
        token: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", amount: "12000000000", amountFormatted: 12000,
        categoryId: 0, invoiceHash: "0x" + "a3".repeat(32), memoHash: "0x" + "b3".repeat(32),
        memo: "AWS infrastructure - Feb 2025 (SPIKE — new GPU cluster)", dueDate: now + 3 * day,
        status: 1, approvalCount: 0, createdAt: now - 1 * day, invoiceNumber: "INV-2025-003",
      },

      // --- SCENARIO 4: Vercel — normal recurring ---
      {
        id: 7, creator: "0x0000000000000000000000000000000000000003",
        vendor: "0x1111111111111111111111111111111111111111", vendorName: "Vercel Inc",
        token: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", amount: "400000000", amountFormatted: 400,
        categoryId: 1, invoiceHash: "0x" + "e7".repeat(32), memoHash: "0x" + "f7".repeat(32),
        memo: "Pro plan - January 2025", dueDate: now + 10 * day,
        status: 3, approvalCount: 2, createdAt: now - 10 * day, executedAt: now - 8 * day,
        invoiceNumber: "VRC-2025-01", txHash: "0x" + "c7".repeat(32), receiptId: "0x" + "r7".repeat(32),
      },

      // --- SCENARIO 5: OpenAI API — moderate spend ---
      {
        id: 8, creator: "0x0000000000000000000000000000000000000003",
        vendor: "0x2222222222222222222222222222222222222222", vendorName: "OpenAI API",
        token: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", amount: "1800000000", amountFormatted: 1800,
        categoryId: 1, invoiceHash: "0x" + "e8".repeat(32), memoHash: "0x" + "f8".repeat(32),
        memo: "GPT-4o API usage - January 2025", dueDate: now + 5 * day,
        status: 1, approvalCount: 1, createdAt: now - 3 * day, invoiceNumber: "OAI-2025-01",
      },

      // --- SCENARIO 6: BLOCKED — unknown vendor, large amount ---
      {
        id: 9, creator: "0x0000000000000000000000000000000000000001",
        vendor: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef", vendorName: "Unknown Vendor LLC",
        token: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", amount: "45000000000", amountFormatted: 45000,
        categoryId: 0, invoiceHash: "0x" + "e9".repeat(32), memoHash: "0x" + "f9".repeat(32),
        memo: "Consulting engagement — Q1 2025", dueDate: now + 2 * day,
        status: 4, approvalCount: 0, createdAt: now - 6 * hour, invoiceNumber: "UNK-001",
      },
    ],
  });

  // ── Approvals ──
  await prisma.approval.createMany({
    data: [
      { intentId: 3, approver: "0x0000000000000000000000000000000000000002", onchain: true, createdAt: now - 1 * day },
      { intentId: 8, approver: "0x0000000000000000000000000000000000000004", onchain: true, createdAt: now - 2 * day },
    ],
  });

  // ── Receipts (for executed intents) ──
  await prisma.receipt.createMany({
    data: [
      {
        receiptId: "0x" + "r1".repeat(32), intentId: 1,
        vendor: "0x1234567890abcdef1234567890abcdef12345678", vendorName: "Acme Cloud Services",
        token: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", amount: "2400000000", amountFormatted: 2400,
        categoryId: 1, invoiceHash: "0x" + "e1".repeat(32), memoHash: "0x" + "f1".repeat(32),
        executedAt: now - 62 * day, txHash: "0x" + "c1".repeat(32),
      },
      {
        receiptId: "0x" + "r2".repeat(32), intentId: 2,
        vendor: "0x1234567890abcdef1234567890abcdef12345678", vendorName: "Acme Cloud Services",
        token: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", amount: "2500000000", amountFormatted: 2500,
        categoryId: 1, invoiceHash: "0x" + "e2".repeat(32), memoHash: "0x" + "f2".repeat(32),
        executedAt: now - 32 * day, txHash: "0x" + "c2".repeat(32),
      },
      {
        receiptId: "0x" + "dd".repeat(32), intentId: 4,
        vendor: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd", vendorName: "DigitalOcean",
        token: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", amount: "850000000", amountFormatted: 850,
        categoryId: 1, invoiceHash: "0x" + "a2".repeat(32), memoHash: "0x" + "b2".repeat(32),
        executedAt: now - 1 * day, txHash: "0x" + "cc".repeat(32),
      },
      {
        receiptId: "0x" + "r5".repeat(32), intentId: 5,
        vendor: "0x9876543210fedcba9876543210fedcba98765432", vendorName: "AWS Billing",
        token: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", amount: "3200000000", amountFormatted: 3200,
        categoryId: 0, invoiceHash: "0x" + "e5".repeat(32), memoHash: "0x" + "f5".repeat(32),
        executedAt: now - 35 * day, txHash: "0x" + "c5".repeat(32),
      },
      {
        receiptId: "0x" + "r7".repeat(32), intentId: 7,
        vendor: "0x1111111111111111111111111111111111111111", vendorName: "Vercel Inc",
        token: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", amount: "400000000", amountFormatted: 400,
        categoryId: 1, invoiceHash: "0x" + "e7".repeat(32), memoHash: "0x" + "f7".repeat(32),
        executedAt: now - 8 * day, txHash: "0x" + "c7".repeat(32),
      },
    ],
  });

  console.log("✅ Seed complete — 9 intents, 6 vendors, 4 team members, 5 receipts");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
