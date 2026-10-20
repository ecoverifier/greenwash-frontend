const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

// Exercise the real server modules without adding a test runner dependency.
require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  module._compile(output.outputText, filename);
};
const { knownCompany, parseCompany } = require('../app/api/audit/company.ts');
const { parseAudit } = require('../app/api/audit/scoring.ts');
const { generateAudit } = require('../app/api/audit/openrouter.ts');
const apple = knownCompany('Apple');
function finding(url, impact = 'harmful') {
  return { subject_company: apple.name, title: 'Company environmental event', summary: 'Sourced evidence about this company.', source_url: url,
    article_date: null, impact, severity: 1, credibility: 1, recency: 1, scope: 1, confidence: 1 };
}
function payload(findings, identity = apple) { return { valid_company: true, company: { name: identity.name, domain: identity.domain }, summary: 'A mixed record.', findings }; }
function parse(findings) { return parseAudit(JSON.stringify(payload(findings)), 'Apple', apple, findings.map(f => f.source_url).filter(Boolean)); }
function response(data, urls) {
  return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(data), annotations: urls.map(url => ({ type: 'url_citation', url_citation: { url } })) } }] }), { status: 200 });
}

test('ambiguous brand aliases resolve to businesses before environmental research', () => {
  for (const alias of ['Amazon', 'AMAZON', 'Amazon.com', 'Amazon.com, Inc.', 'https://www.amazon.com/']) assert.equal(knownCompany(alias).domain, 'amazon.com');
  for (const alias of ['Apple', 'Apple Inc.', 'apple.com']) assert.equal(knownCompany(alias).name, 'Apple Inc.');
  assert.equal(knownCompany('Amazon rainforest'), undefined);
  assert.equal(knownCompany('Apple Records'), undefined);
  assert.equal(parseCompany({ is_company: false, ambiguous: true }), null);
});
test('mixed evidence counts toward coverage and does not suppress Apple score', () => {
  const result = parse([finding('https://apple.com/report', 'beneficial'), finding('https://reuters.com/apple', 'mixed'), finding('https://greenpeace.org/apple', 'mixed')]);
  assert.equal(result.greenscore.evidence_sufficient, true);
  assert.equal(result.greenscore.score, 67);
});
test('three mixed sources produce a neutral score, rather than no score', () => {
  const result = parse(['a.com', 'b.com', 'c.com'].map(domain => finding(`https://${domain}/report`, 'mixed')));
  assert.equal(result.greenscore.evidence_sufficient, true); assert.equal(result.greenscore.score, 50);
});
test('one publisher cannot get several weights through subdomains or tracking URLs', () => {
  const result = parse([finding('https://apple.com/report'), finding('https://www.apple.com/report/?utm_source=x'), finding('https://news.apple.com/other'), finding('https://reuters.com/apple'), finding('https://greenpeace.org/apple', 'beneficial')]);
  assert.equal(result.eco_audit.findings.length, 4); assert.equal(result.greenscore.source_count, 3);
  const appleWeight = result.eco_audit.findings.filter(f => f.source_domain === 'apple.com').reduce((total, f) => total + f.contribution, 0);
  assert.ok(Math.abs(appleWeight - 1 / 3) < 1e-10); assert.equal(result.greenscore.score, 33);
});
test('one source still cannot produce a score', () => {
  const result = parse([finding('https://apple.com/report')]); assert.equal(result.greenscore.evidence_sufficient, false); assert.equal(result.eco_audit.findings[0].contribution, 0);
});
test('unknown dates preserve sourced evidence; incomplete factors are excluded', () => {
  const result = parse([{ ...finding('https://a.com/report'), article_date: 'unknown' }, finding('https://b.com/report'), finding('https://c.com/report'), { ...finding('https://d.com/report'), severity: '0.8' }]);
  assert.equal(result.greenscore.evidence_sufficient, true); assert.equal(result.greenscore.excluded_findings, 1); assert.equal(result.eco_audit.findings[0].article_date, null);
});
test('wrong company subjects and URLs absent from search results cannot enter scoring', () => {
  const findings = [finding('https://apple.com/report'), { ...finding('https://forest.org/amazon'), subject_company: 'Amazon rainforest' }, finding('https://invented.com/report')];
  const result = parseAudit(JSON.stringify(payload(findings)), 'Apple', apple, ['https://apple.com/report', 'https://forest.org/amazon']);
  assert.equal(result.eco_audit.findings.length, 1); assert.equal(result.greenscore.excluded_findings, 2);
  assert.throws(() => parseAudit(JSON.stringify(payload(findings, { name: 'Amazon rainforest', domain: 'forest.org' })), 'Apple', apple), /did not match/);
});
test('thin coverage triggers one follow-up and merges publishers into a scored report', async () => {
  const original = global.fetch; const requests = [];
  global.fetch = async (_url, init) => {
    const request = JSON.parse(init.body); requests.push(request);
    const findings = requests.length === 1 ? [finding('https://apple.com/report')] : [finding('https://reuters.com/apple', 'mixed'), finding('https://greenpeace.org/apple', 'mixed')];
    return response(payload(findings), findings.map(f => f.source_url));
  };
  try {
    const result = await generateAudit('Apple', 'test-key', 'test-model');
    assert.equal(requests.length, 2); assert.equal(result.greenscore.evidence_sufficient, true); assert.equal(result.greenscore.source_count, 3);
    assert.deepEqual(requests[1].tools[0].parameters.excluded_domains, ['apple.com']);
  } finally { global.fetch = original; }
});
test('Amazon requests carry its retail/cloud identity, and rainforest findings are rejected', async () => {
  const original = global.fetch; const amazon = knownCompany('Amazon'); const requests = [];
  global.fetch = async (_url, init) => {
    requests.push(JSON.parse(init.body));
    const findings = ['aboutamazon.com', 'reuters.com', 'epa.gov'].map(domain => ({ ...finding(`https://${domain}/amazon`), subject_company: amazon.name }));
    return response(payload(findings, amazon), findings.map(f => f.source_url));
  };
  try {
    const result = await generateAudit('Amazon', 'test-key', 'test-model');
    assert.equal(result.company, 'Amazon.com, Inc.'); assert.equal(result.greenscore.evidence_sufficient, true);
    assert.deepEqual(JSON.parse(requests[0].messages[1].content).target_company, amazon);
  } finally { global.fetch = original; }
});
test('unresolved business names stop before environmental research', async () => {
  const original = global.fetch; let count = 0;
  global.fetch = async (_url, init) => { count++; assert.equal(JSON.parse(init.body).tools, undefined); return response({ is_company: false, ambiguous: true }, []); };
  try { await assert.rejects(generateAudit('Amazon rainforest', 'test-key', 'test-model'), /Which company/); assert.equal(count, 1); }
  finally { global.fetch = original; }
});
