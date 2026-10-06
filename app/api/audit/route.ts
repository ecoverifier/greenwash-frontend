import { NextResponse } from "next/server";
import { AuditError, generateAudit } from "./openrouter";

export const runtime = "nodejs";
export const maxDuration = 150;

const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403, headers });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Expected a JSON request." }, { status: 415, headers });
  }
  // Read with a hard cap, including requests without a Content-Length header.
  const reader = request.body?.getReader();
  if (!reader) return NextResponse.json({ error: "Enter a company name." }, { status: 400, headers });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2048) {
        await reader.cancel();
        return NextResponse.json({ error: "Request is too large." }, { status: 413, headers });
      }
      chunks.push(value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (typeof body?.company !== "string" || !body.company.trim() || body.company.trim().length > 200) {
      return NextResponse.json({ error: "Enter a company name between 1 and 200 characters." }, { status: 400, headers });
    }
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) return NextResponse.json({ error: "The audit service is not configured yet." }, { status: 503, headers });
    const report = await generateAudit(body.company.trim(), key, process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini");
    return NextResponse.json(report, { headers });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request." }, { status: 400, headers });
    return NextResponse.json({ error: error instanceof AuditError ? error.message : "The audit service could not complete this request.", retryable: error instanceof AuditError ? error.retryable : true }, { status: 502, headers });
  }
}
