import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { IntentStatus } from "@arbcfo/shared";

type ApprovalRow = {
  approver: string;
};

const APPROVABLE_STATES: number[] = [
  IntentStatus.AwaitingApprovals,
  IntentStatus.PendingRiskReview,
];

const REJECTABLE_STATES: number[] = [
  IntentStatus.AwaitingApprovals,
  IntentStatus.PendingRiskReview,
  IntentStatus.Draft,
];

const EXECUTABLE_STATES: number[] = [
  IntentStatus.AwaitingApprovals,
  IntentStatus.Scheduled,
];

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);

  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid intent id" }, { status: 400 });
  }

  const intent = await prisma.intent.findUnique({
    where: { id },
    include: { approvals: true },
  });

  if (!intent) {
    return NextResponse.json({ error: "Intent not found" }, { status: 404 });
  }

  return NextResponse.json({ intent });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);

  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid intent id" }, { status: 400 });
  }

  const body = await req.json();
  const { action } = body as { action?: string };

  const intent = await prisma.intent.findUnique({
    where: { id },
    include: { approvals: true },
  });

  if (!intent) {
    return NextResponse.json({ error: "Intent not found" }, { status: 404 });
  }

  switch (action) {
    case "approve": {
      if (!APPROVABLE_STATES.includes(intent.status)) {
        return NextResponse.json(
          {
            error: `Cannot approve intent in status ${intent.status}. Must be AwaitingApprovals (1) or PendingRiskReview (6).`,
          },
          { status: 409 }
        );
      }

      const { approver, signature } = body as {
        approver?: string;
        signature?: string;
      };

      if (!approver || !signature) {
        return NextResponse.json(
          { error: "Missing approver or signature" },
          { status: 400 }
        );
      }

      if (signature === "0x" || signature.length < 130) {
        return NextResponse.json(
          { error: "Invalid signature - must be a real EIP-712 signature" },
          { status: 400 }
        );
      }

      const existing = intent.approvals.find(
        (a: ApprovalRow) =>
          a.approver.toLowerCase() === approver.toLowerCase()
      );

      if (existing) {
        return NextResponse.json(
          { error: "Already approved by this address" },
          { status: 409 }
        );
      }

      const nowTs = Math.floor(Date.now() / 1000);

      const approval = await prisma.approval.create({
        data: {
          intentId: intent.id,
          approver,
          signature,
          onchain: false,
          createdAt: nowTs,
        },
      });

      await prisma.intent.update({
        where: { id },
        data: { approvalCount: { increment: 1 } },
      });

      return NextResponse.json({ approval });
    }

    case "execute": {
      if (!EXECUTABLE_STATES.includes(intent.status)) {
        return NextResponse.json(
          {
            error: `Cannot execute intent in status ${intent.status}. Must be AwaitingApprovals (1) or Scheduled (2).`,
          },
          { status: 409 }
        );
      }

      const { txHash } = body as { txHash?: string };

      if (!txHash || txHash === "0x" + "0".repeat(64) || txHash.length < 66) {
        return NextResponse.json(
          { error: "Missing or invalid txHash - must be a real transaction hash" },
          { status: 400 }
        );
      }

      const nowTs = Math.floor(Date.now() / 1000);

      const updated = await prisma.intent.update({
        where: { id },
        data: {
          status: IntentStatus.Executed,
          executedAt: nowTs,
          txHash,
        },
      });

      return NextResponse.json({ intent: updated });
    }

    case "reject": {
      if (!REJECTABLE_STATES.includes(intent.status)) {
        return NextResponse.json(
          {
            error: `Cannot reject intent in status ${intent.status}. Must be Draft (0), AwaitingApprovals (1), or PendingRiskReview (6).`,
          },
          { status: 409 }
        );
      }

      const updated = await prisma.intent.update({
        where: { id },
        data: { status: IntentStatus.Rejected },
      });

      return NextResponse.json({ intent: updated });
    }

    case "pending_risk_review": {
      if (
        intent.status !== IntentStatus.AwaitingApprovals &&
        intent.status !== IntentStatus.Draft
      ) {
        return NextResponse.json(
          { error: `Cannot flag for risk review from status ${intent.status}.` },
          { status: 409 }
        );
      }

      const { riskScore } = body as { riskScore?: number | null };

      const updated = await prisma.intent.update({
        where: { id },
        data: {
          status: IntentStatus.PendingRiskReview,
          riskScore: typeof riskScore === "number" ? riskScore : null,
        },
      });

      return NextResponse.json({ intent: updated });
    }

    case "sync_onchain": {
      const allowedTargetStatuses: number[] = [
        IntentStatus.Executed,
        IntentStatus.Rejected,
      ];

      if (
        body.status !== undefined &&
        !allowedTargetStatuses.includes(body.status as number)
      ) {
        return NextResponse.json(
          { error: `sync_onchain cannot set arbitrary status ${body.status}` },
          { status: 400 }
        );
      }

      const data: Record<string, unknown> = {};

      if (body.onchainId !== undefined) data.onchainId = String(body.onchainId);
      if (body.status !== undefined) data.status = body.status;
      if (body.txHash !== undefined) data.txHash = body.txHash;
      if (body.executedAt !== undefined) {
        data.executedAt =
          typeof body.executedAt === "number"
            ? body.executedAt
            : Math.floor(new Date(body.executedAt).getTime() / 1000);
      }

      const updated = await prisma.intent.update({
        where: { id },
        data,
      });

      return NextResponse.json({ intent: updated });
    }

    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 }
      );
  }
}