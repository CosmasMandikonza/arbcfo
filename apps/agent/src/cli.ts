#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { readFileSync, existsSync } from "fs";
import { createHash } from "crypto";

const API_BASE = process.env.ARBCFO_API_URL || "http://localhost:3000";

// ─── Heuristic invoice parser (mirrors browser version) ───────────────────

interface ParsedInvoice {
  vendor: string | null;
  amount: number | null;
  currency: string;
  invoiceNumber: string | null;
  dueDate: string | null;
  memo: string | null;
  confidence: number;
}

function parseInvoiceText(text: string): ParsedInvoice {
  const result: ParsedInvoice = {
    vendor: null,
    amount: null,
    currency: "USD",
    invoiceNumber: null,
    dueDate: null,
    memo: null,
    confidence: 0,
  };

  let hits = 0;

  // Amount patterns
  const amountPatterns = [
    /(?:total|amount\s*due|balance\s*due|grand\s*total|pay\s*this\s*amount)[:\s]*\$?([\d,]+\.?\d*)/i,
    /\$\s*([\d,]+\.\d{2})/,
    /(?:USD|USDC)\s*([\d,]+\.?\d*)/i,
  ];
  for (const pat of amountPatterns) {
    const m = text.match(pat);
    if (m) {
      result.amount = parseFloat(m[1].replace(/,/g, ""));
      hits++;
      break;
    }
  }

  // Vendor patterns
  const vendorPatterns = [
    /(?:bill\s*from|from|vendor|payee|company)[:\s]*([A-Z][A-Za-z0-9\s&.,'-]{2,40})/i,
    /^([A-Z][A-Za-z0-9\s&.,'-]{2,30})\s*(?:Inc|LLC|Ltd|Corp|Co)/im,
  ];
  for (const pat of vendorPatterns) {
    const m = text.match(pat);
    if (m) {
      result.vendor = m[1].trim();
      hits++;
      break;
    }
  }

  // Invoice number
  const invPatterns = [
    /(?:invoice\s*(?:#|no|number)?)[:\s]*([A-Z0-9][\w-]{2,20})/i,
    /(?:inv|ref)[:\s#]*([A-Z0-9][\w-]{3,15})/i,
  ];
  for (const pat of invPatterns) {
    const m = text.match(pat);
    if (m) {
      result.invoiceNumber = m[1].trim();
      hits++;
      break;
    }
  }

  // Due date
  const datePatterns = [
    /(?:due\s*date|payment\s*due|due\s*by)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /(?:due\s*date|due\s*by)[:\s]*([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i,
  ];
  for (const pat of datePatterns) {
    const m = text.match(pat);
    if (m) {
      result.dueDate = m[1].trim();
      hits++;
      break;
    }
  }

  result.confidence = Math.min(hits / 4, 1);
  return result;
}

function computeHash(input: string | Buffer): string {
  return "0x" + createHash("sha256").update(input).digest("hex");
}

// ─── CLI ──────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name("arb-cfo")
  .description("ArbCFO Agent CLI — create and propose payment intents")
  .version("0.1.0");

// ─── intake command ───────────────────────────────────────────────────────

program
  .command("intake <file_or_text>")
  .description("Parse an invoice PDF or text and output a draft intent JSON")
  .option("-o, --output <path>", "Write JSON to file instead of stdout")
  .action(async (input: string, opts: { output?: string }) => {
    const spinner = ora("Parsing invoice…").start();

    try {
      let text: string;
      let invoiceHash: string;

      if (existsSync(input)) {
        const bytes = readFileSync(input);
        // For PDFs, we compute hash from raw bytes
        invoiceHash = computeHash(bytes);
        // Simple text extraction (for real PDFs, the web app uses pdfjs)
        text = bytes.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ");
        spinner.text = `Read file: ${input} (${bytes.length} bytes)`;
      } else {
        text = input;
        invoiceHash = computeHash(text);
      }

      const parsed = parseInvoiceText(text);

      const draft = {
        vendor: parsed.vendor,
        vendorAddress: null, // Needs manual entry or lookup
        amount: parsed.amount,
        currency: parsed.currency,
        invoiceNumber: parsed.invoiceNumber,
        dueDate: parsed.dueDate,
        memo: parsed.memo,
        invoiceHash,
        confidence: parsed.confidence,
        suggestedCategory: suggestCategory(parsed),
        status: "DRAFT",
        _meta: {
          source: existsSync(input) ? "file" : "text",
          parsedAt: new Date().toISOString(),
          agent: "arb-cfo-cli/0.1.0",
        },
      };

      spinner.succeed("Invoice parsed");

      if (opts.output) {
        const { writeFileSync } = await import("fs");
        writeFileSync(opts.output, JSON.stringify(draft, null, 2));
        console.log(chalk.green(`✓ Draft written to ${opts.output}`));
      } else {
        console.log();
        console.log(chalk.bold("Draft Intent:"));
        console.log(chalk.gray("─".repeat(50)));

        if (draft.vendor) console.log(`  ${chalk.cyan("Vendor:")}    ${draft.vendor}`);
        if (draft.amount) console.log(`  ${chalk.cyan("Amount:")}    $${draft.amount.toLocaleString()} ${draft.currency}`);
        if (draft.invoiceNumber) console.log(`  ${chalk.cyan("Invoice #:")} ${draft.invoiceNumber}`);
        if (draft.dueDate) console.log(`  ${chalk.cyan("Due Date:")}  ${draft.dueDate}`);
        console.log(`  ${chalk.cyan("Category:")}  ${draft.suggestedCategory}`);
        console.log(`  ${chalk.cyan("Hash:")}      ${draft.invoiceHash.slice(0, 20)}…`);
        console.log(`  ${chalk.cyan("Confidence:")} ${(draft.confidence * 100).toFixed(0)}%`);
        console.log();
        console.log(chalk.gray(JSON.stringify(draft, null, 2)));
      }
    } catch (err: any) {
      spinner.fail("Parse failed");
      console.error(chalk.red(err.message));
      process.exit(1);
    }
  });

// ─── propose command ──────────────────────────────────────────────────────

program
  .command("propose")
  .description("Post a draft intent to the ArbCFO API (requires approvals to execute)")
  .requiredOption("-v, --vendor <address>", "Vendor wallet address (0x…)")
  .requiredOption("-a, --amount <usdc>", "Amount in USDC (e.g., 1500.00)")
  .option("-n, --vendor-name <name>", "Vendor display name")
  .option("-c, --category <id>", "Category ID (0=Software, 1=Services, …)", "0")
  .option("-m, --memo <text>", "Memo / description")
  .option("-i, --invoice-hash <hash>", "Invoice hash (0x…)")
  .option("--api <url>", "API base URL", API_BASE)
  .action(async (opts) => {
    const spinner = ora("Submitting intent to ArbCFO…").start();

    try {
      const body = {
        vendor: opts.vendor,
        vendorName: opts.vendorName || null,
        amount: Math.round(parseFloat(opts.amount) * 1e6).toString(), // Convert to USDC 6 decimals
        categoryId: parseInt(opts.category),
        memo: opts.memo || null,
        invoiceHash: opts.invoiceHash || computeHash(`${opts.vendor}-${opts.amount}-${Date.now()}`),
      };

      const res = await fetch(`${opts.api}/api/intents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      spinner.succeed("Intent proposed!");

      console.log();
      console.log(chalk.bold.green("✓ Payment intent created"));
      console.log(chalk.gray("─".repeat(50)));
      console.log(`  ${chalk.cyan("ID:")}       ${data.intent?.id || "—"}`);
      console.log(`  ${chalk.cyan("Status:")}   Awaiting Approvals`);
      console.log(`  ${chalk.cyan("Vendor:")}   ${opts.vendor}`);
      console.log(`  ${chalk.cyan("Amount:")}   $${parseFloat(opts.amount).toLocaleString()} USDC`);
      console.log();
      console.log(chalk.yellow("⚠ This intent requires approvals before execution."));
      console.log(chalk.gray("  Open the ArbCFO web app to approve and execute."));
    } catch (err: any) {
      spinner.fail("Submit failed");
      console.error(chalk.red(err.message));
      process.exit(1);
    }
  });

// ─── status command ───────────────────────────────────────────────────────

program
  .command("status [intentId]")
  .description("Check the status of an intent or list recent intents")
  .option("--api <url>", "API base URL", API_BASE)
  .action(async (intentId: string | undefined, opts: { api: string }) => {
    const spinner = ora("Fetching…").start();

    try {
      if (intentId) {
        const res = await fetch(`${opts.api}/api/intents/${intentId}`);
        if (!res.ok) throw new Error(`Intent not found`);
        const data = await res.json();
        spinner.succeed("Intent found");
        console.log(chalk.gray(JSON.stringify(data.intent, null, 2)));
      } else {
        const res = await fetch(`${opts.api}/api/intents?limit=10`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        spinner.succeed(`${data.intents?.length || 0} recent intents`);
        for (const intent of data.intents || []) {
          const statusColor =
            intent.status === "EXECUTED" ? chalk.green :
            intent.status === "REJECTED" ? chalk.red :
            chalk.yellow;
          console.log(
            `  ${chalk.gray(intent.id.slice(0, 8))}  ${statusColor(intent.status.padEnd(12))}  $${(Number(intent.amount) / 1e6).toLocaleString()} USDC  ${intent.vendorName || "—"}`
          );
        }
      }
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

// ─── helpers ──────────────────────────────────────────────────────────────

function suggestCategory(parsed: ParsedInvoice): string {
  const text = [parsed.vendor, parsed.memo].filter(Boolean).join(" ").toLowerCase();
  if (/software|saas|cloud|aws|gcp|azure|hosting|license/i.test(text)) return "Software";
  if (/consult|legal|accounting|audit|advisory/i.test(text)) return "Services";
  if (/office|supplies|equipment|hardware/i.test(text)) return "Operations";
  if (/market|advertis|pr|campaign|media/i.test(text)) return "Marketing";
  if (/salary|payroll|contractor|freelanc/i.test(text)) return "Payroll";
  return "Other";
}

// ─── ai-intake command (LangChain-powered) ──────────────────────────────

program
  .command("ai-intake <file_or_text>")
  .description("Parse an invoice using GPT-4o (LangChain) — much more accurate than regex")
  .option("-o, --output <path>", "Write JSON to file instead of stdout")
  .option("--submit", "Also submit as a payment intent to the vault contract")
  .action(async (input: string, opts: { output?: string; submit?: boolean }) => {
    const spinner = ora("Loading AI agent…").start();

    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        spinner.fail("Missing OPENAI_API_KEY environment variable");
        console.error(chalk.red("\nSet your OpenAI API key:"));
        console.error(chalk.gray("  export OPENAI_API_KEY=sk-your-key-here"));
        process.exit(1);
      }

      // Dynamic import to avoid loading LangChain for non-AI commands
      const { ArbCFOAgent, validateInvoiceData } = await import("./agent.js");

      const agent = new ArbCFOAgent({
        openaiApiKey: apiKey,
        privateKey: process.env.PRIVATE_KEY as `0x${string}` | undefined,
        vaultAddress: process.env.VAULT_ADDRESS as `0x${string}` | undefined,
        usdcAddress: process.env.USDC_ADDRESS as `0x${string}` | undefined,
        rpcUrl: process.env.RPC_URL,
      });

      // Read input
      let text: string;
      if (existsSync(input)) {
        text = readFileSync(input, "utf-8");
        spinner.text = `Parsing ${input} with GPT-4o…`;
      } else {
        text = input;
        spinner.text = "Parsing invoice with GPT-4o…";
      }

      if (opts.submit) {
        // Full pipeline: parse → validate → submit to blockchain
        spinner.text = "Parsing + submitting to Arbitrum Sepolia…";
        const result = await agent.submitIntent(text);

        if (result.success) {
          spinner.succeed("Intent submitted to Arbitrum Sepolia!");
          console.log();
          console.log(chalk.bold.green("✓ Payment intent created on-chain"));
          console.log(chalk.gray("─".repeat(50)));
          console.log(`  ${chalk.cyan("TX Hash:")}   ${result.txHash}`);
          console.log(`  ${chalk.cyan("Vendor:")}    ${result.invoice?.vendorName}`);
          console.log(`  ${chalk.cyan("Address:")}   ${result.invoice?.vendorAddress}`);
          console.log(`  ${chalk.cyan("Amount:")}    $${result.invoice?.amount} USDC`);
          console.log(`  ${chalk.cyan("Due Date:")}  ${result.invoice?.dueDate}`);
          console.log(`  ${chalk.cyan("Category:")}  ${result.invoice?.suggestedCategory}`);
          console.log(`  ${chalk.cyan("Block:")}     ${result.receipt?.blockNumber}`);
          console.log(`  ${chalk.cyan("Gas Used:")}  ${result.receipt?.gasUsed}`);
          console.log();
          console.log(chalk.gray(`  Explorer: https://sepolia.arbiscan.io/tx/${result.txHash}`));
        } else {
          spinner.fail("Submission failed");
          console.error(chalk.red(`\n${result.error}`));
          if (result.validation?.errors.length) {
            for (const err of result.validation.errors) {
              console.error(chalk.yellow(`  ⚠ ${err}`));
            }
          }
          process.exit(1);
        }
      } else {
        // Parse only — show extracted data
        const invoice = await agent.parseInvoice(text);
        const validation = validateInvoiceData(invoice);

        spinner.succeed("Invoice parsed with GPT-4o");

        const draft = {
          ...invoice,
          invoiceHash: computeHash(text),
          validation: validation.valid ? "PASSED" : validation.errors,
          _meta: {
            source: existsSync(input) ? "file" : "text",
            parsedAt: new Date().toISOString(),
            agent: "arb-cfo-ai/1.0.0",
            model: "gpt-4o",
          },
        };

        if (opts.output) {
          const { writeFileSync } = await import("fs");
          writeFileSync(opts.output, JSON.stringify(draft, null, 2));
          console.log(chalk.green(`✓ Draft written to ${opts.output}`));
        } else {
          console.log();
          console.log(chalk.bold("AI-Extracted Invoice:"));
          console.log(chalk.gray("─".repeat(50)));
          console.log(`  ${chalk.cyan("Vendor:")}      ${invoice.vendorName}`);
          console.log(`  ${chalk.cyan("Address:")}     ${invoice.vendorAddress}`);
          console.log(`  ${chalk.cyan("Amount:")}      $${invoice.amount}`);
          console.log(`  ${chalk.cyan("Due Date:")}    ${invoice.dueDate}`);
          console.log(`  ${chalk.cyan("Category:")}    ${invoice.suggestedCategory}`);
          console.log(`  ${chalk.cyan("Description:")} ${invoice.description}`);
          console.log(`  ${chalk.cyan("Confidence:")}  ${(invoice.confidence * 100).toFixed(0)}%`);

          if (invoice.anomalyNotes !== "none") {
            console.log(`  ${chalk.yellow("⚠ Notes:")}    ${invoice.anomalyNotes}`);
          }

          if (!validation.valid) {
            console.log();
            console.log(chalk.yellow("  Validation issues:"));
            for (const err of validation.errors) {
              console.log(chalk.yellow(`    ⚠ ${err}`));
            }
          }

          console.log();
          console.log(chalk.gray(JSON.stringify(draft, null, 2)));
        }
      }
    } catch (err: any) {
      spinner.fail("AI parsing failed");
      console.error(chalk.red(err.message));
      process.exit(1);
    }
  });

program.parse();
