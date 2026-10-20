export type CompanyIdentity = { name: string; domain: string; description: string };

// Pin common ambiguous names before any environmental search is performed.
const knownCompanies: Record<string, CompanyIdentity> = {
  apple: { name: "Apple Inc.", domain: "apple.com", description: "Consumer electronics and technology" },
  amazon: { name: "Amazon.com, Inc.", domain: "amazon.com", description: "E-commerce, logistics and cloud computing" },
  shell: { name: "Shell plc", domain: "shell.com", description: "Energy and oil and gas" },
  tesla: { name: "Tesla, Inc.", domain: "tesla.com", description: "Electric vehicles and energy" },
};

export function knownCompany(input: string): CompanyIdentity | undefined {
  const key = input.toLowerCase().replace(/https?:\/\//g, "").replace(/^www\./, "").replace(/[.,/]/g, " ").replace(/\b(incorporated|inc|plc|corporation|corp|com)\b/g, "").trim().replace(/\s+/g, " ");
  return knownCompanies[key];
}

export function parseCompany(value: unknown): CompanyIdentity | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (data.is_company !== true || data.ambiguous !== false || typeof data.name !== "string" || !data.name.trim() ||
      typeof data.domain !== "string" || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(data.domain) ||
      typeof data.description !== "string" || !data.description.trim()) return null;
  return { name: data.name.trim(), domain: data.domain.toLowerCase().replace(/^www\./, ""), description: data.description.trim() };
}
