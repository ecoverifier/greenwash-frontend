import type { ReportType } from "../../types/audit";
import type { CompanyIdentity } from "./company";

export class AuditError extends Error {
  constructor(message: string, public retryable = false) { super(message); }
}

type EventInput = {
  title: string; summary: string; source_url: string; article_date: string | null;
  impact: "harmful" | "beneficial" | "mixed";
  severity: number; credibility: number; recency: number; scope: number; confidence: number;
};

const unit = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const safeURL = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try { return ["https:", "http:"].includes(new URL(value).protocol); } catch { return false; }
};

export function sourceKey(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  for (const key of [...parsed.searchParams.keys()]) {
    if (key.startsWith("utm_") || ["fbclid", "gclid"].includes(key)) parsed.searchParams.delete(key);
  }
  parsed.searchParams.sort();
  return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/$/, "")}${parsed.search}`;
}

function publisher(url: string): string {
  const parts = new URL(url).hostname.replace(/^www\./, "").split(".");
  // Fold subdomains together, including common country-code publishing domains.
  const countrySuffix = /^(co|com|org|net|ac|gov)\.[a-z]{2}$/.test(parts.slice(-2).join("."));
  return parts.slice(countrySuffix ? -3 : -2).join(".");
}

export function parseAudit(content: string, company: string, identity?: CompanyIdentity, sourceURLs?: string[]): ReportType {
  let data: unknown;
  try { data = JSON.parse(content.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "")); }
  catch { throw new AuditError("The model returned invalid JSON. Try again or choose another model.", true); }
  if (!record(data)) throw new AuditError("The model returned an invalid report.", true);
  if (data.valid_company === false) throw new AuditError("No identifiable company was found. Try its full name or include its country.");
  if (data.valid_company !== true || typeof data.summary !== "string" || !Array.isArray(data.findings) || !data.findings.length || data.findings.length > 12) {
    throw new AuditError("Not enough sourced evidence to produce an audit. Try a more specific company name.", true);
  }
  if (identity && (!record(data.company) || data.company.name !== identity.name || data.company.domain !== identity.domain)) {
    throw new AuditError("The research did not match the requested company. Try its full business name or website.", true);
  }
  const searchedSources = sourceURLs ? new Set(sourceURLs.filter(safeURL).map(sourceKey)) : null;
  const inputs: EventInput[] = data.findings.flatMap((item: unknown) => {
    if (!record(item) || typeof item.title !== "string" || !item.title.trim() || typeof item.summary !== "string" || !safeURL(item.source_url) ||
      (identity && item.subject_company !== identity.name) ||
      (searchedSources && !searchedSources.has(sourceKey(item.source_url as string))) ||
      !["harmful", "beneficial", "mixed"].includes(String(item.impact)) ||
      ![item.severity, item.credibility, item.recency, item.scope, item.confidence].every(unit)) {
      return [];
    }
    // A missing publication date is unknown, not a reason to discard good evidence.
    const articleDate = typeof item.article_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.article_date) && Number.isFinite(Date.parse(item.article_date)) ? item.article_date : null;
    return [{ ...item, article_date: articleDate } as EventInput];
  });
  if (!inputs.length) throw new AuditError("The research returned no complete, sourced findings. Please try again.", true);
  const excludedFindings = data.findings.length - inputs.length;
  // Count a URL once, even when the model supplies different titles or tracking URLs.
  const unique = inputs.filter((item, index) => inputs.findIndex((other) => sourceKey(other.source_url) === sourceKey(item.source_url)) === index);
  const findings = unique.map((item) => {
    const risk = item.severity * item.credibility * item.recency * item.scope * item.confidence * (item.impact === "harmful" ? 1 : item.impact === "beneficial" ? -1 : 0);
    return { ...item, date: item.article_date ?? "", source_domain: publisher(item.source_url),
      trusted_for_score: false, domain_is_trusted: false,
      event_risk_score: risk, event_score_0_100: Math.round(50 - 50 * risk), contribution: 0 };
  });
  // Equal publisher weights prevent multiple articles from one site dominating.
  const publishers = [...new Set(findings.map((item) => item.source_domain))];
  // Mixed evidence still establishes coverage. It must not make the score disappear.
  const sufficient = publishers.length >= 3;
  findings.forEach((item) => {
    item.contribution = sufficient ? 1 / publishers.length / findings.filter((other) => other.source_domain === item.source_domain).length : 0;
  });
  const score = Math.round(50 - 50 * findings.reduce((sum, item) => sum + item.event_risk_score * item.contribution, 0));
  const level = score >= 80 ? "Low risk" : score < 50 ? "High risk" : "Medium risk";
  return {
    company: identity?.name ?? company, ...(identity ? { company_identity: identity } : {}), eco_audit: { last_audit_date: new Date().toISOString(), total_events: findings.length,
      high_risk_flag_count: findings.filter((f) => f.event_risk_score > 0.15).length, concern_level: sufficient ? level : "Insufficient evidence", summary: data.summary, findings },
    greenscore: { score, scoring_version: 3, excluded_findings: excludedFindings, evidence_sufficient: sufficient, source_count: publishers.length, risk_level: sufficient ? level : "Insufficient evidence", note: "AI-generated analysis using web search. Source URLs and model assessments are not independently verified; this is not a certified ESG rating.",
      rationale: data.summary, counts: { total_events: findings.length, harmful_events: findings.filter((f) => f.event_risk_score > 0).length,
        beneficial_events: findings.filter((f) => f.event_risk_score < 0).length, trusted_events_used_for_score: 0 } },
  };
}

