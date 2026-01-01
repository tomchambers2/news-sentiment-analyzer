/**
 * Topic configurations - each topic has its own ID, description, and classification prompt.
 * 
 * Usage: Set TOPIC_ID environment variable or pass as argument:
 *   TOPIC_ID=cycling npm start
 *   npm start cycling
 */

export const TOPICS = {
  "liveable-neighbourhoods": {
    id: "liveable-neighbourhoods",
    description: "Low Traffic Neighbourhoods and traffic calming schemes",
    prompt: `Classify if each article is about Low Traffic Neighbourhood (LTN) schemes or closely related traffic-calming policies.

LTNs close residential streets to through-traffic using modal filters (bollards, planters, cameras). Related policies include school streets, pedestrianisation, and 20mph zones when part of neighbourhood traffic reduction.

✅ RELEVANT - mark as relevant=true:
- LTN schemes, modal filters, bollards blocking through-traffic
- "Liveable neighbourhood" or "low traffic neighbourhood" consultations
- School streets (cars banned outside schools at certain times)
- Pedestrianisation of streets/areas
- 20mph zones as part of traffic calming schemes
- Road closures to reduce rat-running through residential areas
- Community protests FOR or AGAINST these specific schemes

❌ NOT RELEVANT - mark as relevant=false:
- Parking charges, parking permits, car parks → parking policy
- Clean Air Zone, ULEZ, emission charges → air quality policy
- Congestion charges → road pricing policy  
- Cycle lanes on main roads → cycling infrastructure
- Bus routes, metrobus, public transport → transit policy
- General transport/budget plans without specific LTN mention
- Traffic accidents, roadworks, M4/M5/M32 news
- Housing developments mentioning "traffic impact"
- Climate protests not specifically about LTNs

KEY: The article must be ABOUT restricting car access to improve neighbourhoods - not just mention traffic/transport.`,
    analyzerPrompt: `Analyze this article's stance toward LIVEABLE NEIGHBOURHOODS/LTNs.

SENTIMENT DEFINITIONS:
- "supportive" = Promotes, praises, or advocates FOR liveable neighbourhoods/LTNs
- "negative" = Criticizes, opposes, or highlights problems WITH liveable neighbourhoods/LTNs  
- "neutral" = Factual reporting with NO clear stance (announcements, consultations)
- "mixed" = Gives SIGNIFICANT coverage to BOTH supportive AND opposing views

IMPORTANT:
- Focus ONLY on what article says about LTNs/traffic schemes
- If positive about "opposition to LTNs" → NEGATIVE sentiment
- If positive about "support for LTNs" → SUPPORTIVE sentiment

Respond in JSON:
{
  "sentiment": "supportive" | "negative" | "neutral" | "mixed",
  "sentiment_score": 1-10 (1=very negative, 10=very supportive),
  "sentiment_explanation": "What the article says about LTNs",
  "main_angle": "safety" | "environment" | "business" | "community" | "accessibility" | "traffic" | "health" | "policy",
  "framing": "progress" | "problem" | "debate" | "human_interest" | "policy" | "conflict",
  "evidence_type": "data" | "expert_opinion" | "personal_stories" | "official_statements" | "mixed" | "none",
  "balance": "one_sided_supportive" | "one_sided_critical" | "balanced" | "mostly_supportive" | "mostly_critical",
  "article_type": "news" | "opinion" | "analysis" | "announcement",
  "publication_date": "YYYY-MM-DD or 'unknown'",
  "geographic_focus": "specific area or 'general'",
  "publication": "publication name",
  "author": "author name or 'unknown'",
  "summary": "one sentence summary"
}

Publication: \${site}
Headline: \${title}
Article: \${text}`,
  },

  "cycling": {
    id: "cycling",
    description: "Cycling, bike lanes, and bicycle infrastructure",
    prompt: `Classify each article: is it about PEDAL BICYCLES?

REJECT IMMEDIATELY if the article is about:
- "recycling" "recycling centre" "recycling bags" = WASTE/RUBBISH → NOT relevant
- "motorbike" "motorcycle" "moped" "biker" "bikers" = MOTORIZED → NOT relevant  
- "upcycling" = CRAFTS → NOT relevant
- Crime where someone used a bike to commit robbery/assault → NOT relevant

ACCEPT if the main topic is:
- Cycle lanes, bike paths being built or debated
- Bicycle theft (bikes stolen)
- Cyclist safety, road rage against cyclists  
- Cycling events, charity rides
- Bike shops, bike hire schemes
- E-bikes (electric pedal bikes)

Each article: check if it mentions recycling/motorbike/upcycling - if yes, mark NOT relevant.
Only mark relevant if pedal cycling is the MAIN topic.`,
    analyzerPrompt: `Analyze this article's stance toward CYCLING and CYCLISTS.

SENTIMENT DEFINITIONS:
- "supportive" = Pro-cycling: promotes cycling infrastructure, celebrates cyclists, advocates for cyclist safety
- "negative" = Anti-cycling: criticizes cyclists, opposes bike lanes, highlights cycling problems
- "neutral" = Factual reporting with NO clear stance (announcements, incident reports)
- "mixed" = Gives SIGNIFICANT coverage to BOTH pro and anti-cycling views

FOCUS ON:
- Is the article positive or negative about cycling as transport?
- Does it support or oppose cycling infrastructure?
- How are cyclists portrayed (heroes, victims, nuisances)?

Respond in JSON:
{
  "sentiment": "supportive" | "negative" | "neutral" | "mixed",
  "sentiment_score": 1-10 (1=very anti-cycling, 10=very pro-cycling),
  "sentiment_explanation": "What the article says about cycling/cyclists",
  "main_angle": "safety" | "infrastructure" | "events" | "crime" | "health" | "environment" | "conflict" | "community",
  "framing": "progress" | "problem" | "celebration" | "human_interest" | "policy" | "conflict" | "warning",
  "evidence_type": "data" | "expert_opinion" | "personal_stories" | "official_statements" | "mixed" | "none",
  "balance": "one_sided_supportive" | "one_sided_critical" | "balanced" | "mostly_supportive" | "mostly_critical",
  "article_type": "news" | "opinion" | "analysis" | "announcement" | "event_coverage",
  "publication_date": "YYYY-MM-DD or 'unknown'",
  "geographic_focus": "specific area/route or 'general'",
  "publication": "publication name",
  "author": "author name or 'unknown'",
  "summary": "one sentence summary"
}

Publication: \${site}
Headline: \${title}
Article: \${text}`,
  },
};

/**
 * Get topic by ID - throws if not found
 */
export function getTopic(topicId) {
  const topic = TOPICS[topicId];
  if (!topic) {
    throw new Error(`Unknown topic: "${topicId}"`);
  }
  return topic;
}

/**
 * List all available topics
 */
export function listTopics() {
  return Object.values(TOPICS).map(t => ({
    id: t.id,
    description: t.description,
  }));
}

