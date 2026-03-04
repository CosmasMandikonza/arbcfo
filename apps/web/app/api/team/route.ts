import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const members = await prisma.teamMember.findMany({
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ members });
  } catch (error) {
    console.error("Failed to fetch team:", error);
    return NextResponse.json({ members: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address, name, role } = body;

    if (!address || !role) {
      return NextResponse.json({ error: "address and role required" }, { status: 400 });
    }

    const member = await prisma.teamMember.upsert({
      where: { address: address.toLowerCase() },
      update: { name: name || address, role },
      create: {
        address: address.toLowerCase(),
        name: name || address,
        role,
      },
    });

    return NextResponse.json({ member });
  } catch (error) {
    console.error("Failed to save team member:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json({ error: "address required" }, { status: 400 });
    }

    await prisma.teamMember.delete({
      where: { address: address.toLowerCase() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete team member:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
