import OpenAI from 'openai';

const VALID_TYPES = new Set([
  'therapist',
  'psychiatrist',
  'clinic',
  'support_group',
  'wellness_center',
  'crisis'
]);

const TYPE_PATTERNS = [
  { type: 'therapist', pattern: /\b(therapist|therapists|therapy|counselor|counselors|counselling|counseling)\b/i },
  { type: 'psychiatrist', pattern: /\b(psychiatrist|psychiatrists|medication management)\b/i },
  { type: 'clinic', pattern: /\b(clinic|clinics)\b/i },
  { type: 'support_group', pattern: /\b(support group|support groups|group therapy)\b/i },
  { type: 'wellness_center', pattern: /\b(wellness|wellness center|wellness centres|meditation|yoga|mindfulness)\b/i },
  { type: 'crisis', pattern: /\b(crisis|hotline|urgent|emergency|immediate help|suicidal|988)\b/i }
];

const SPECIALIZATION_PATTERNS = [
  { specialization: 'anxiety', pattern: /\b(anxiety|anxious|panic)\b/i },
  { specialization: 'depression', pattern: /\b(depression|depressed)\b/i },
  { specialization: 'PTSD', pattern: /\b(ptsd|trauma)\b/i },
  { specialization: 'OCD', pattern: /\b(ocd|obsessive compulsive)\b/i },
  { specialization: 'bipolar', pattern: /\b(bipolar)\b/i },
  { specialization: 'ADHD', pattern: /\b(adhd|attention deficit)\b/i },
  { specialization: 'grief', pattern: /\b(grief|bereavement|loss)\b/i },
  { specialization: 'stress_management', pattern: /\b(stress|burnout)\b/i },
  { specialization: 'couples', pattern: /\b(couples|relationship|marriage)\b/i },
  { specialization: 'family', pattern: /\b(family|parenting)\b/i },
  { specialization: 'suicide_prevention', pattern: /\b(suicide|self-harm)\b/i }
];

const LOCATION_KEYWORDS = [
  'northwest',
  'northeast',
  'southwest',
  'southeast',
  'nw',
  'ne',
  'sw',
  'se',
  'georgetown',
  'dupont',
  'capitol hill',
  'adams morgan',
  'foggy bottom'
];

const SYSTEM_PROMPT = `You are a mental health resource finder assistant. Your job is to parse user queries and extract filter parameters from mental health resource data.

User queries will ask for mental health services, therapists, support groups, clinics, or wellness centers in Washington DC.

You MUST respond with ONLY valid JSON (no markdown, no code blocks, no explanations). The JSON must have this structure:
{
  "filters": {
    "types": [],
    "specializations": [],
    "acceptsInsurance": null,
    "minRating": null,
    "keywords": []
  },
  "reasoning": "Brief explanation of what the user is looking for"
}

Field guidelines:
- "types": Array of resource types. Valid values: "therapist", "psychiatrist", "clinic", "support_group", "wellness_center", "crisis". Only include if user specifies.
- "specializations": Array of mental health specializations. Examples: "anxiety", "depression", "PTSD", "OCD", "bipolar", "ADHD", "trauma", "couples", "family", etc.
- "acceptsInsurance": true/false/null. Only set if user explicitly mentions insurance.
- "minRating": Number 0-5. Only if user asks for highly rated services.
- "keywords": Array of any other important keywords from the query.

Examples:
1. User: "Show me therapists specializing in anxiety"
   Response: {"filters": {"types": ["therapist"], "specializations": ["anxiety"], "acceptsInsurance": null, "minRating": null, "keywords": []}, "reasoning": "User seeking anxiety specialists among therapists"}

2. User: "I need crisis help"
   Response: {"filters": {"types": ["crisis"], "specializations": [], "acceptsInsurance": null, "minRating": null, "keywords": ["urgent", "immediate"]}, "reasoning": "User in crisis situation needs immediate support"}

3. User: "Support groups for PTSD and trauma"
   Response: {"filters": {"types": ["support_group"], "specializations": ["PTSD", "trauma"], "acceptsInsurance": null, "minRating": null, "keywords": []}, "reasoning": "User seeking peer support for trauma-related issues"}`;

function createEmptyFilters() {
  return {
    types: [],
    specializations: [],
    acceptsInsurance: null,
    minRating: null,
    keywords: []
  };
}

function hasAnyFilter(filters) {
  return (
    (filters.types && filters.types.length > 0) ||
    (filters.specializations && filters.specializations.length > 0) ||
    filters.acceptsInsurance !== null ||
    filters.minRating !== null ||
    (filters.keywords && filters.keywords.length > 0)
  );
}

function normalizeFilters(filters = {}) {
  const normalized = createEmptyFilters();

  if (Array.isArray(filters.types)) {
    normalized.types = filters.types
      .filter((type) => typeof type === 'string')
      .map((type) => type.trim())
      .filter((type) => VALID_TYPES.has(type));
  }

  if (Array.isArray(filters.specializations)) {
    normalized.specializations = filters.specializations
      .filter((spec) => typeof spec === 'string')
      .map((spec) => spec.trim())
      .filter(Boolean);
  }

  if (typeof filters.acceptsInsurance === 'boolean') {
    normalized.acceptsInsurance = filters.acceptsInsurance;
  }

  if (typeof filters.minRating === 'number' && Number.isFinite(filters.minRating)) {
    normalized.minRating = Math.min(5, Math.max(0, filters.minRating));
  }

  if (Array.isArray(filters.keywords)) {
    normalized.keywords = filters.keywords
      .filter((keyword) => typeof keyword === 'string')
      .map((keyword) => keyword.trim())
      .filter(Boolean);
  }

  return normalized;
}

function parseIntentLocally(userQuery) {
  const filters = createEmptyFilters();
  const normalizedQuery = userQuery.toLowerCase();

  TYPE_PATTERNS.forEach(({ type, pattern }) => {
    if (pattern.test(userQuery) && !filters.types.includes(type)) {
      filters.types.push(type);
    }
  });

  SPECIALIZATION_PATTERNS.forEach(({ specialization, pattern }) => {
    if (pattern.test(userQuery) && !filters.specializations.includes(specialization)) {
      filters.specializations.push(specialization);
    }
  });

  if (/\b(insurance|in-network|covered)\b/i.test(userQuery)) {
    const wantsNoInsurance = /\b(no|without|not|don't|do not|self-pay|out of pocket)\b/i.test(userQuery);
    filters.acceptsInsurance = !wantsNoInsurance;
  }

  const minRatingMatch = normalizedQuery.match(/(?:at least|min(?:imum)?|over|above)\s*(\d(?:\.\d)?)/);
  if (minRatingMatch) {
    filters.minRating = Math.min(5, Math.max(0, Number.parseFloat(minRatingMatch[1])));
  } else if (/\b(highly rated|top rated|best rated|good reviews)\b/i.test(userQuery)) {
    filters.minRating = 4.5;
  }

  LOCATION_KEYWORDS.forEach((keyword) => {
    if (normalizedQuery.includes(keyword) && !filters.keywords.includes(keyword)) {
      filters.keywords.push(keyword);
    }
  });

  return {
    filters,
    reasoning: 'Parsed locally from query keywords'
  };
}

function isApiKeyConfigured() {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY?.trim();
  return Boolean(apiKey) && apiKey !== 'your_openai_api_key_here';
}

export async function parseUserIntent(userQuery) {
  if (!isApiKeyConfigured()) {
    return parseIntentLocally(userQuery);
  }

  try {
    const client = new OpenAI({
      apiKey: import.meta.env.VITE_OPENAI_API_KEY,
      dangerouslyAllowBrowser: true
    });

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 500,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: userQuery
        }
      ]
    });

    const content = response.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      return parseIntentLocally(userQuery);
    }

    const parsedResponse = JSON.parse(content);
    const normalizedFilters = normalizeFilters(parsedResponse.filters);

    if (!hasAnyFilter(normalizedFilters)) {
      return parseIntentLocally(userQuery);
    }

    return {
      filters: normalizedFilters,
      reasoning: parsedResponse.reasoning || 'Parsed by GPT'
    };
  } catch (error) {
    console.error('Error parsing user intent:', error);
    return parseIntentLocally(userQuery);
  }
}
