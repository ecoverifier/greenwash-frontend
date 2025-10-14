# Visual UI Examples - Source Credibility Display

This document shows visual examples of how sources are now displayed with credibility indicators.

---

## Before vs After Comparison

### BEFORE (Old Display):
```
Reuters
Major automaker announces 50% emissions reduction by 2030
reuters.com • [news] high impact, negative direction — 2024-01-15

Shell Press Release
Company commits to net-zero emissions
shell.com • [company] medium impact, positive direction — 2024-01-10
```

### AFTER (New Display with Credibility Badges):
```
[📰 Major News] [Trust: 95%] [high impact] [negative]
Reuters
Major automaker announces 50% emissions reduction by 2030
reuters.com • [news] • 2024-01-15

[🏢 Company] [Trust: 35%] [medium impact] [positive]
Shell Press Release
Company commits to net-zero emissions
shell.com • [company] • 2024-01-10
```

---

## Source Category Examples

### 1. Government Source (Highest Trust)
```
[🏛️ Government] [Trust: 100%] [high impact] [negative]
EPA Announces New Emissions Standards
Environmental Protection Agency releases stricter regulations for industrial emissions
epa.gov • [government] • 2024-03-01
```
**Badge Color:** Blue (#3B82F6)
**Trust Level:** 100%
**Use Case:** Official regulations, policies, fines

---

### 2. Academic Source (High Trust)
```
[🎓 Academic] [Trust: 90%] [high impact] [negative]
Climate Change Impact Study Published in Nature
Peer-reviewed research shows accelerating ice melt rates
nature.com • [academic] • 2024-02-15
```
**Badge Color:** Purple (#A855F7)
**Trust Level:** 85-95%
**Use Case:** Scientific studies, research papers

---

### 3. Major News Outlet (High Trust)
```
[📰 Major News] [Trust: 85%] [high impact] [negative]
Bloomberg: Tesla Faces Emissions Investigation
Federal investigation launched into vehicle emissions claims
bloomberg.com • [major_news] • 2024-01-20
```
**Badge Color:** Green (#10B981)
**Trust Level:** 75-90%
**Use Case:** Reuters, Bloomberg, AP, NYT, WSJ

---

### 4. Reputable News (Medium-High Trust)
```
[📄 News] [Trust: 70%] [medium impact] [negative]
Local Paper: Factory Emissions Exceed Limits
Regional environmental violations reported
localnews.com • [reputable_news] • 2024-01-18
```
**Badge Color:** Teal (#14B8A6)
**Trust Level:** 60-80%
**Use Case:** Regional news, specialized outlets

---

### 5. NGO/Advocacy (Medium Trust)
```
[🌱 NGO] [Trust: 65%] [medium impact] [negative]
Greenpeace Report on Corporate Greenwashing
Environmental group releases annual sustainability report
greenpeace.org • [ngo_advocacy] • 2024-01-12
```
**Badge Color:** Emerald (#059669)
**Trust Level:** 50-75%
**Use Case:** Environmental NGOs, advocacy groups

---

### 6. Industry Publication (Medium-Low Trust)
```
[🏭 Industry] [Trust: 50%] [low impact] [positive]
Oil & Gas Journal: New Carbon Capture Technology
Trade publication covers industry innovation
ogj.com • [industry] • 2024-01-08
```
**Badge Color:** Yellow (#EAB308)
**Trust Level:** 40-60%
**Use Case:** Trade magazines, industry news

---

### 7. Company Source (Low Trust)
```
[🏢 Company] [Trust: 30%] [medium impact] [positive]
ExxonMobil Announces Sustainability Initiative
Company press release on environmental commitments
exxonmobil.com • [company] • 2024-01-05
```
**Badge Color:** Orange (#F97316)
**Trust Level:** 20-40%
**Use Case:** Corporate PR, press releases

---

### 8. Unverified Source (Lowest Trust)
```
[⚠️ Unverified] [Trust: 15%] [low impact] [unclear]
Blog Post on Climate Change Claims
Unverified claims about environmental impact
randomsite.com • [low_credibility] • 2024-01-03
```
**Badge Color:** Red (#EF4444)
**Trust Level:** 0-25%
**Use Case:** Blogs, unverified sites, tabloids

---

## Impact & Direction Badges

### High Impact (Red)
```
[high impact]
```
**Color:** Red background (#FEE2E2), Red text (#991B1B)
**Meaning:** Significant environmental event or violation

### Medium Impact (Yellow)
```
[medium impact]
```
**Color:** Yellow background (#FEF3C7), Yellow text (#92400E)
**Meaning:** Moderate environmental concern

### Low Impact (Blue)
```
[low impact]
```
**Color:** Blue background (#DBEAFE), Blue text (#1E40AF)
**Meaning:** Minor environmental issue or general news

---

### Positive Direction (Green)
```
[positive]
```
**Color:** Green background (#D1FAE5), Green text (#065F46)
**Meaning:** Environmental improvements, achievements

### Negative Direction (Red)
```
[negative]
```
**Color:** Red background (#FEE2E2), Red text (#991B1B)
**Meaning:** Environmental violations, damages

### Unclear Direction (Gray)
```
[unclear]
```
**Color:** Gray background (#F3F4F6), Gray text (#374151)
**Meaning:** Mixed or neutral environmental impact

---

## Mobile Display

On mobile devices, badges wrap to maintain readability:

```
[📰 Major News]
[Trust: 95%]
[high impact]
[negative]

Reuters
Major automaker announces 50% emissions reduction
reuters.com • [news] • 2024-01-15
```

---

## GreenScore Display Enhancement

### Before:
```
GreenScore: 72

- Company has some positive initiatives
- Several negative incidents reported
```

### After (with base_score):
```
GreenScore: 72
Base: 68 • Final: 72

- Recent positive ESG initiatives (+4 bonus)
- Strong government source verification
- Mixed track record on emissions
- Active in renewable energy projects
```

---

## Accessibility Features

1. **Emoji Icons** - Visual indicators for quick scanning
2. **Color Coding** - Consistent color scheme across categories
3. **Text Labels** - Clear category names (not just colors)
4. **Semantic HTML** - Proper heading structure
5. **Responsive Design** - Works on all screen sizes

---

## Trust Score Color Scale

```
100-80%: 🟢 Green   (High Trust)
79-60%:  🟦 Teal    (Medium-High Trust)
59-40%:  🟡 Yellow  (Medium Trust)
39-20%:  🟠 Orange  (Low Trust)
19-0%:   🔴 Red     (Very Low Trust)
```

---

## Example Full Report View

```
═══════════════════════════════════════════════════════════
                    Sustainability Report
═══════════════════════════════════════════════════════════

Submitted Company: Tesla Inc.

┌─────────────────────────────────────────────────────────┐
│ GreenScore: 78                                          │
│ Base: 75 • Final: 78                                    │
│                                                          │
│ • Strong commitment to electric vehicle technology      │
│ • Government compliance bonus (+3 points)               │
│ • Recent labor practice concerns                        │
│ • Leading in renewable energy adoption                  │
└─────────────────────────────────────────────────────────┘

─────────────────────────────────────────────────────────────
                         Sources
─────────────────────────────────────────────────────────────

[🏛️ Government] [Trust: 100%] [high impact] [negative]
EPA Investigation into Factory Emissions
Federal investigation launched into reported violations
epa.gov • [government] • 2024-03-01

[📰 Major News] [Trust: 90%] [medium impact] [positive]
Bloomberg: Tesla Expands Solar Panel Production
Company doubles solar manufacturing capacity
bloomberg.com • [major_news] • 2024-02-28

[🎓 Academic] [Trust: 92%] [high impact] [positive]
MIT Study: Electric Vehicles Impact on Carbon Reduction
Peer-reviewed analysis shows significant emissions reduction
mit.edu • [academic] • 2024-02-20

[🏢 Company] [Trust: 35%] [low impact] [positive]
Tesla Sustainability Report 2024
Annual corporate sustainability commitments
tesla.com • [company] • 2024-02-15
```

---

## Design Principles

1. **Visual Hierarchy** - Most credible sources stand out
2. **Consistent Patterns** - Same layout for all sources
3. **Quick Scanning** - Emoji and colors for fast assessment
4. **Progressive Enhancement** - Works without new features
5. **Mobile-First** - Optimized for all devices

---

**Last Updated:** October 13, 2025
**Status:** ✅ Implemented in Production
