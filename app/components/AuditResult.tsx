"use client";

import { useState } from "react";
import type { ReportType } from "../types/audit";

export default function AuditResult({ report }: { report: ReportType }) {
  const [showAll, setShowAll] = useState(false);
  const findings = report.eco_audit.findings;
  const scored = report.greenscore.scoring_version === 3 && report.greenscore.evidence_sufficient === true;
  const current = report.greenscore.scoring_version === 3;
  const score = report.greenscore.score;
  const tone = score >= 80 ? "positive" : score < 50 ? "concern" : "mixed";
  const label = score >= 80 ? "Mostly positive evidence" : score < 50 ? "Environmental concerns" : "Mixed environmental record";
  return <article className="audit-result">
    <div className="result-topline"><span>Environmental snapshot</span><span>{report.greenscore.source_count ?? new Set(findings.map((f) => f.source_domain)).size} sources</span></div>
    <div className="result-heading">
      <div className="company-heading"><h2>{report.company}</h2>{report.company_identity && <p>{report.company_identity.description}<span> · {report.company_identity.domain}</span></p>}
        <p className={`result-verdict ${scored ? tone : "mixed"}`}>{scored ? label : current ? "Limited source coverage" : "Ready for an updated check"}</p>
      </div>
      {scored && <div className={`result-score ${tone}`} aria-label={`GreenScore ${score} out of 100`}><div>{score}<span>/100</span></div><p>GreenScore</p><span>Higher is better</span></div>}
    </div>
    {!scored && <p className="coverage-note">{current ? "We searched again, but couldn’t find enough usable coverage from three publishers to score this company responsibly." : "Run a fresh check above to use the improved company matching and scoring."}</p>}
    <p className="result-summary">{report.eco_audit.summary}</p>
    <section className="result-evidence" aria-labelledby="evidence-title">
      <div className="evidence-heading"><h3 id="evidence-title">Behind the score</h3><span>{findings.length} findings</span></div>
      <div>{(showAll ? findings : findings.slice(0, 3)).map((finding, index) => {
        const impact = finding.event_risk_score > 0 ? "Concern" : finding.event_risk_score < 0 ? "Progress" : "Mixed";
        return <details className="evidence-row" key={`${finding.source_url}-${index}`}>
          <summary><span className="evidence-title">{finding.title}<span className="evidence-meta"><span className={`impact-dot ${impact.toLowerCase()}`} />{impact}<span aria-hidden="true">·</span>{finding.source_domain || "Source"}</span></span><span className="evidence-toggle" aria-hidden="true">+</span></summary>
          <div className="evidence-body"><p>{finding.summary}</p><a href={finding.source_url} target="_blank" rel="noopener noreferrer">Read original source ↗</a>{finding.article_date && <span className="evidence-date">{finding.article_date}</span>}</div>
        </details>;
      })}</div>
      {findings.length > 3 && <button className="show-findings" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>{showAll ? "Show fewer findings" : `View all ${findings.length} findings`} <span aria-hidden="true">{showAll ? "−" : "+"}</span></button>}
    </section>
    <details className="assessment-note"><summary>How this works</summary><div>
      <p>AI searches for evidence about this specific business. New checks accept source links returned by the search service and need at least three publishers for a score. Mixed evidence counts toward coverage without pushing the score up or down.</p>
      <p>Each publisher has equal scoring weight, split between its findings. Event impact combines severity, credibility, recency, scope and confidence. Starting from 50, harmful evidence lowers the score and beneficial evidence raises it.</p>
      <p>Sources may repeat company claims or share ownership. Facts and model assessments are not independently verified, and the score is not a certified sustainability rating.{report.greenscore.excluded_findings ? ` ${report.greenscore.excluded_findings} incomplete or unsupported findings were excluded.` : ""}</p>
    </div></details>
    <p className="result-footnote">AI-assisted research. Read the sources before drawing conclusions.</p>
  </article>;
}
