type ESGFinding = {
  date: string;
  article_date?: string | null;
  title: string;
  summary: string;
  source_url: string;
  source_domain?: string;

  trusted_for_score?: boolean;
  domain_is_trusted?: boolean;
  domain_credibility_score?: number;
  domain_category?: string;

  severity: number;
  credibility: number;
  recency: number;
  scope: number;
  confidence: number;

  event_risk_score: number;
  event_score_0_100: number;
  contribution?: number;
  calc?: {
    inputs: {
      severity: number;
      credibility: number;
      recency: number;
      scope: number;
      confidence: number;
    };
    influence: number;
    raw_risk: number;
    compressed: number;
    final_risk: number;
  };
};

type TopDriver = {
  title: string;
  url: string;
  event_risk_score: number;
  event_score_0_100: number;
  contribution_pct: number;
  credibility: number;
  recency: number;
  scope: number;
  domain_credibility_score?: number;
  domain_category?: string;
  domain_is_trusted?: boolean;
};

export type ReportType = {
  company: string;
  eco_audit: {
    last_audit_date: string;
    total_events: number;
    high_risk_flag_count: number;
    concern_level: string;
    summary: string;
    findings: ESGFinding[];
  };
  greenscore: {
    score: number;
    risk_score?: number;
    risk_level?: string;
    rationale?: string;
    factors?: string[];
    note: string;
    why?: string;
    top_drivers?: TopDriver[];
    counts?: {
      total_events: number;
      harmful_events: number;
      beneficial_events: number;
      trusted_events_used_for_score: number;
    };
    trusted_thresholds?: {
      min_domain_cred: number;
      min_model_cred: number;
      min_trusted_events_for_score: number;
    };
    base_score?: number;
  };
};

