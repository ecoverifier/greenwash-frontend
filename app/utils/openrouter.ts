import type { ReportType } from "../types/audit";

export class AuditError extends Error {
  constructor(message: string, public retryable = false) { super(message); }
}

export async function generateAudit(company: string): Promise<ReportType> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 130_000);
  try {
    const response = await fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company }),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) throw new AuditError(data.error ?? "Unable to generate an audit.", !!data.retryable);
    return data as ReportType;
  } catch (error) {
    if (error instanceof AuditError) throw error;
    throw new AuditError(controller.signal.aborted ? "The audit timed out. Please try again." : "Could not reach the audit service. Check your connection and try again.", true);
  } finally { clearTimeout(timeout); }
}
