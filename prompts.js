export const prompts = {
  filter: {
    prompt: `Is this article about "\${topic}"? Liveable neighborhoods are also called low traffic neighborhoods, where modal filters are used to reduce car traffic in an area and remove through routes.

Respond with ONLY a JSON object in this exact format:
{
  "relevant": true,
  "reasoning": "brief explanation"
}

Or:
{
  "relevant": false,
  "reasoning": "brief explanation"
}

Headline: "\${headline}"

Article text: "\${snippet}"`,
    updated_at: "2025-10-18T20:00:00Z",
    version: "2.0.0",
    notes: "Added reasoning to filter decisions",
  },

  analyzer: {
    prompt: `CRITICAL: Analyze this article's stance specifically toward LIVEABLE NEIGHBOURHOODS/LTNs, NOT the article's general tone.

SENTIMENT DEFINITIONS:
- "supportive" = Article promotes, praises, or advocates FOR liveable neighbourhoods/LTNs
  Examples: "LTNs improving air quality", "residents embrace traffic calming", "scheme success stories"

- "negative" = Article criticizes, opposes, or highlights problems WITH liveable neighbourhoods/LTNs
  Examples: "residents protest LTN", "businesses hurt by scheme", "traffic chaos from road closures"

- "neutral" = Factual reporting with NO clear stance (announcements, plans, consultations, balanced reporting)
  Examples: "council announces LTN consultation", "scheme to be implemented next month"

- "mixed" = Article gives SIGNIFICANT coverage to BOTH supportive AND opposing views
  Examples: Article quotes both supporters praising schemes AND opponents criticizing them

DECISION PROCESS:
1. Does the article mention liveable neighbourhoods/LTNs/traffic schemes? If NO → this shouldn't be analyzed
2. What is the PRIMARY POSITION the article takes about LTNs?
3. Is it promoting them (supportive), criticizing them (negative), just reporting facts (neutral), or giving both sides equally (mixed)?

IMPORTANT:
- Ignore the article's tone about OTHER topics (community activism, cafes, etc.)
- Focus ONLY on what it says about liveable neighbourhoods/LTNs/traffic schemes
- If article is positive about "community opposition to LTNs" → that's NEGATIVE sentiment toward LTNs
- If article is positive about "community support for LTNs" → that's SUPPORTIVE sentiment toward LTNs

Respond in JSON:
{
  "sentiment": "supportive" | "negative" | "neutral" | "mixed",
  "sentiment_score": "1-10",
  "sentiment_explanation": "Explain what the article says specifically about liveable neighbourhoods/LTNs and why that indicates this sentiment",
  "main_angle": "safety" | "disability" | "children" | "environmental" | "business" | "community" | "driving" | "walking and cycling" | "public transport",
  "secondary_angles": ["safety" | "disability" | "children" | "environmental" | "business" | "community" | "driving" | "walking and cycling" | "public transport"],
  "framing": "progress" | "problem" | "debate" | "human_interest" | "policy_detail" | "conflict" | "solution" | "warning",
  "evidence_type": "data_statistics" | "expert_opinion" | "personal_stories" | "official_statements" | "mixed" | "none",
  "primary_voices": ["council" | "supportive_residents" | "opposing_residents" | "businesses" | "experts" | "activists" | "politicians" | "disabled_people" | "cyclists" | "other"],
  "balance": "one_sided_supportive" | "one_sided_critical" | "balanced" | "mostly_supportive" | "mostly_critical",
  "stakeholders": ["residents" | "council" | "businesses" | "activists" | "politicians" | "disabled_groups" | "cycling_groups" | "schools" | "emergency_services" | "traders" | "other"],
  "article_type": "news" | "opinion" | "analysis" | "report" | "interview" | "announcement",
  "article_length": "short" | "medium" | "long",
  "publication_date": "extract date if mentioned in article, format as YYYY-MM-DD, or 'unknown'",
  "geographic_focus": "specific area or neighborhood mentioned, or 'general'",
  "policy_mention": "specific policy, scheme name, or council decision mentioned, or 'none'",
  "political_parties": ["liberal_democrats" | "conservatives" | "green_party" | "ukip" | "labour" | "independent" | "other"],
  "opposition_mentioned": true | false,
  "support_mentioned": true | false,
  "data_driven": true | false,
  "publication": "name of publication that published the article",
  "author": "name of journalist who wrote the article or 'unknown'",
  "summary": "one sentence describing the main point"
}

Publication: \${site}

Headline: \${title}

Article text: \${text}`,
    updated_at: "2025-10-18T20:00:00Z",
    version: "3.0.0",
    notes:
      "Completely restructured to emphasize sentiment is specifically about LTNs, not article tone. Added examples and decision tree.",
  },
};
