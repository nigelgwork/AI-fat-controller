import { NextRequest, NextResponse } from "next/server";
import { getConvoys, getConvoyById, createConvoy } from "@/lib/gastown";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get("id");

  try {
    if (id) {
      const convoy = getConvoyById(id);
      if (!convoy) {
        return NextResponse.json(
          { error: "Convoy not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ convoy });
    }

    const convoys = getConvoys();
    return NextResponse.json({ convoys });
  } catch {
    // Return empty array when Gas Town isn't running
    return NextResponse.json({ convoys: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, beadIds, notify, humanRequired } = body;

    if (!name || !beadIds || beadIds.length === 0) {
      return NextResponse.json(
        { error: "name and beadIds are required" },
        { status: 400 }
      );
    }

    const convoy = createConvoy(name, beadIds, { notify, humanRequired });

    if (!convoy) {
      return NextResponse.json(
        { error: "Failed to create convoy" },
        { status: 500 }
      );
    }

    return NextResponse.json({ convoy }, { status: 201 });
  } catch (error) {
    console.error("Failed to create convoy:", error);
    return NextResponse.json(
      { error: "Failed to create convoy" },
      { status: 500 }
    );
  }
}
