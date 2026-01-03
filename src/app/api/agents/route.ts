import { NextRequest, NextResponse } from "next/server";
import { getAgents, getAgentById, triggerHandoff, spawnPolecat } from "@/lib/gastown";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get("id");

  try {
    if (id) {
      const agent = getAgentById(id);
      if (!agent) {
        return NextResponse.json(
          { error: "Agent not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ agent });
    }

    const agents = getAgents();
    return NextResponse.json({ agents });
  } catch {
    // Return empty array when Gas Town isn't running
    return NextResponse.json({ agents: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, agentId, rig, beadId } = body;

    if (action === "handoff") {
      if (!agentId) {
        return NextResponse.json(
          { error: "agentId is required for handoff" },
          { status: 400 }
        );
      }
      const success = triggerHandoff(agentId);
      return NextResponse.json({ success });
    }

    if (action === "spawn") {
      if (!rig) {
        return NextResponse.json(
          { error: "rig is required for spawn" },
          { status: 400 }
        );
      }
      const result = spawnPolecat(rig, beadId);
      return NextResponse.json({ success: !!result, result });
    }

    return NextResponse.json(
      { error: "Unknown action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Agent action failed:", error);
    return NextResponse.json(
      { error: "Action failed" },
      { status: 500 }
    );
  }
}
