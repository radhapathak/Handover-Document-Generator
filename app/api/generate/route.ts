import { NextRequest, NextResponse } from "next/server";
import { generateKT } from "@/lib/generate";

export const maxDuration = 120; // the AI can take a minute or more to write

export async function POST(req: NextRequest) {
  const secret = process.env.KT_SHARED_SECRET;
  if (!secret || req.headers.get("x-kt-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { module, config } = await req.json();
    if (!module || !config) {
      return NextResponse.json({ error: "module and config are required" }, { status: 400 });
    }
    const configText = typeof config === "string" ? config : JSON.stringify(config);
    return NextResponse.json(await generateKT(String(module), configText));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
