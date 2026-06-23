import { retrieveContext } from './ragRetriever';

// ── Provider selection ─────────────────────────────────────────────────────────
// Set LLM_PROVIDER in backend/.env to switch between providers:
//   LLM_PROVIDER=gemini    (default — free, 1500 req/day)
//   LLM_PROVIDER=groq      (free, very fast, 14400 req/day)
//   LLM_PROVIDER=openrouter (free models available)
//   LLM_PROVIDER=anthropic  (original — paid)

const PROVIDER = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();

export interface UserContextForChat {
  name: string;
  skinType: string;
  city: string;
  age?: number;
  gender?: string;
  env: { humidity: number; temperature: number; uvIndex: number; aqi: number; season: string };
  latestAnalysis: {
    date: string;
    condition: string;
    severityScore: number;
    confidence: number;
    skinType?: string;
    regionAnalysis?: Array<{ region: string; condition: string; confidence: number }>;
  } | null;
  trend: { direction: string; weekOverWeekChange: number; currentBand: string } | null;
  analysisHistory: Array<{ date: string; condition: string; severityScore: number }>;
  habitCorrelations: Array<{ habit: string; correlationPct: number; direction: string }>;
  topHabitInsight?: string;
}

export interface ChatMessage { role: 'user' | 'assistant'; content: string; }

// ── LLM trigger patterns (unchanged) ─────────────────────────────────────────
const LLM_TRIGGERS = [
  /why\s+(is|are|did|does|do|my|i)/i,
  /what\s+(changed|happened|caused|should|can|is the)/i,
  /how\s+(long|much|can|should|do|to)/i,
  /explain|tell me|describe|suggest|recommend/i,
  /compare|vs\.|versus|difference/i,
  /should\s+(i|we)\s+(use|apply|try|stop|avoid|eat|drink)/i,
  /getting\s+(worse|better|clearer)/i,
  /not\s+(improving|working|helping|clearing)/i,
  /correlat|habit|water|sleep|stress|diet|dairy|sugar/i,
  /last\s+(week|month|analysis|time)/i,
  /forehead|cheek|nose|chin|region|area/i,
  /acne|pigmentation|tanning|dark spot|pimple/i,
  /vitamin|zinc|omega|supplement|neem|turmeric/i,
  /routine|morning|night|skincare|moistur/i,
];

export function shouldUseLLM(message: string): boolean {
  if (message.trim().length < 10) return false;
  if (/^(hi|hello|hey|namaste|yes|no|ok|thanks|okay|sure|fine)\.?$/i.test(message.trim())) return false;
  return LLM_TRIGGERS.some(p => p.test(message));
}

// ── System prompt builder (unchanged) ─────────────────────────────────────────
function buildSystemPrompt(ctx: UserContextForChat): string {
  const histStr = ctx.analysisHistory.length > 0
    ? ctx.analysisHistory.map(a => `  ${a.date}: ${a.condition} (severity ${a.severityScore}/100)`).join('\n')
    : '  No prior analyses yet.';

  const corrStr = ctx.habitCorrelations.length > 0
    ? ctx.habitCorrelations.map(c => `  ${c.habit}: ${Math.abs(c.correlationPct)}% ${c.direction === 'improves' ? 'associated with clearer skin' : 'associated with worse skin'}`).join('\n')
    : '  (Insufficient habit data — need 7+ days of logs + analyses)';

  const latestStr = ctx.latestAnalysis
    ? `Condition: ${ctx.latestAnalysis.condition} | Severity: ${ctx.latestAnalysis.severityScore}/100 (${ctx.trend?.currentBand ?? 'unknown'}) | Confidence: ${ctx.latestAnalysis.confidence}% | Skin type: ${ctx.latestAnalysis.skinType || ctx.skinType}`
    : 'No analysis yet.';

  const regionStr = ctx.latestAnalysis?.regionAnalysis?.length
    ? ctx.latestAnalysis.regionAnalysis.map(r => `  ${r.region.replace('_', ' ')}: ${r.condition} (${r.confidence}%)`).join('\n')
    : '  Region analysis not available.';

  const profileStr = [
    ctx.age    ? `Age: ${ctx.age}` : null,
    ctx.gender ? `Gender: ${ctx.gender}` : null,
    ctx.city   ? `City: ${ctx.city}` : null,
  ].filter(Boolean).join(' | ') || 'Profile incomplete.';

  const trendStr = ctx.trend
    ? `${ctx.trend.direction} (${ctx.trend.weekOverWeekChange > 0 ? '+' : ''}${ctx.trend.weekOverWeekChange}% week-over-week)`
    : 'Insufficient data.';

  return `You are AyurSkin AI — a warm, knowledgeable skincare assistant combining Ayurvedic wisdom with modern dermatology.

You have access to this user's REAL skin data. Always reference specific numbers, dates, and regions. Never give generic advice.

USER PROFILE: ${ctx.name} | ${profileStr} | Skin type: ${ctx.skinType}
LATEST ANALYSIS: ${latestStr}
TREND: ${trendStr}
REGION RESULTS:\n${regionStr}
HISTORY (last 5):\n${histStr}
ENVIRONMENT: ${ctx.env.temperature}C | Humidity: ${ctx.env.humidity}% | UV: ${ctx.env.uvIndex} | AQI: ${ctx.env.aqi} | Season: ${ctx.env.season}
HABIT CORRELATIONS:\n${corrStr}
${ctx.topHabitInsight ? `TOP INSIGHT: ${ctx.topHabitInsight}` : ''}

RULES:
1. Always cite specific numbers from the data above.
2. Reference region analysis when user asks about specific face areas.
3. Tone: warm and encouraging, like a knowledgeable friend.
4. Keep responses to 3-5 sentences. Longer only for comparisons.
5. If severity > 75 or rapidly worsening, end with: "I recommend consulting a dermatologist."
6. End health-claim responses with: "Note: Informational only, not medical advice."`;
}

// ── Fallback response ──────────────────────────────────────────────────────────
function fallbackResponse(ctx: UserContextForChat): string {
  const la = ctx.latestAnalysis;
  return la
    ? `I'm having trouble connecting right now. Your latest analysis shows ${la.condition} with severity ${la.severityScore}/100. Check the Analysis tab for full recommendations.`
    : 'I am having trouble connecting. Please check your API key in backend/.env and try again.';
}

// ══════════════════════════════════════════════════════════════════════════════
// PROVIDER 1 — Google Gemini (FREE: 1500 req/day, 1M tokens/min)
// Get key: https://aistudio.google.com/apikey
// .env: LLM_PROVIDER=gemini  GEMINI_API_KEY=AIza...
// ══════════════════════════════════════════════════════════════════════════════
async function callGemini(systemPrompt: string, history: ChatMessage[], userMessage: string): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model  = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: systemPrompt,
  });

  // Gemini rules:
  // 1. History must NEVER start with role 'model' — only 'user' can be first
  // 2. Roles must strictly alternate: user -> model -> user -> model
  // 3. The current userMessage goes via sendMessage(), NOT in history
  let raw = history.slice(-10);

  // Strip any leading assistant messages
  while (raw.length > 0 && raw[0].role === 'assistant') {
    raw = raw.slice(1);
  }

  // Collapse consecutive same-role messages (keep the last of each run)
  const alternating: ChatMessage[] = [];
  for (const msg of raw) {
    if (alternating.length > 0 && alternating[alternating.length - 1].role === msg.role) {
      alternating[alternating.length - 1] = msg;
    } else {
      alternating.push(msg);
    }
  }

  const geminiHistory = alternating.map(m => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const chat   = model.startChat({ history: geminiHistory });
  const result = await chat.sendMessage(userMessage);
  return result.response.text().trim();
}

// ══════════════════════════════════════════════════════════════════════════════
// PROVIDER 2 — Groq (FREE: 14,400 req/day, extremely fast inference)
// Get key: https://console.groq.com  → API Keys → Create
// .env: LLM_PROVIDER=groq  GROQ_API_KEY=gsk_...
// ══════════════════════════════════════════════════════════════════════════════
async function callGroq(systemPrompt: string, history: ChatMessage[], userMessage: string): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model:      'llama-3.1-8b-instant',   // free, very fast
      max_tokens: 600,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.slice(-10).map(m => ({ role: m.role, content: m.content })),
        { role: 'user',   content: userMessage },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Groq error: ${response.status} ${await response.text()}`);
  const data: any = await response.json();
  return data.choices[0].message.content.trim();
}

// ══════════════════════════════════════════════════════════════════════════════
// PROVIDER 3 — OpenRouter (FREE models: mistral, llama, gemma)
// Get key: https://openrouter.ai → Sign in → Keys
// Free models list: https://openrouter.ai/models?q=free
// .env: LLM_PROVIDER=openrouter  OPENROUTER_API_KEY=sk-or-...
// ══════════════════════════════════════════════════════════════════════════════
async function callOpenRouter(systemPrompt: string, history: ChatMessage[], userMessage: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer':  'http://localhost:5173',
      'X-Title':       'AyurSkin AI',
    },
    body: JSON.stringify({
      model:      process.env.OPENROUTER_MODEL || 'mistralai/mistral-7b-instruct:free',
      max_tokens: 600,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.slice(-10).map(m => ({ role: m.role, content: m.content })),
        { role: 'user',   content: userMessage },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenRouter error: ${response.status} ${await response.text()}`);
  const data: any = await response.json();
  return data.choices[0].message.content.trim();
}

// ══════════════════════════════════════════════════════════════════════════════
// PROVIDER 4 — Anthropic Claude (original — paid)
// .env: LLM_PROVIDER=anthropic  ANTHROPIC_API_KEY=sk-ant-...
// ══════════════════════════════════════════════════════════════════════════════
async function callAnthropic(systemPrompt: string, history: ChatMessage[], userMessage: string): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client    = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response  = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system:     systemPrompt,
    messages:   [...history.slice(-10), { role: 'user', content: userMessage }],
  });
  return response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim();
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT — routes to the configured provider
// ══════════════════════════════════════════════════════════════════════════════
export async function llmChat(
  userMessage: string,
  history: ChatMessage[],
  userContext: UserContextForChat
): Promise<string> {
  const condition   = userContext.latestAnalysis?.condition || 'normal';
  const ragContext  = retrieveContext(userMessage, condition, 3);
  let   systemPrompt = buildSystemPrompt(userContext);
  if (ragContext) {
    systemPrompt += `\n\nRELEVANT KNOWLEDGE:\n${ragContext}\n\nUse this knowledge for accuracy. Synthesize with the user's personal data.`;
  }

  try {
    switch (PROVIDER) {
      case 'gemini':      return await callGemini(systemPrompt, history, userMessage);
      case 'groq':        return await callGroq(systemPrompt, history, userMessage);
      case 'openrouter':  return await callOpenRouter(systemPrompt, history, userMessage);
      case 'anthropic':   return await callAnthropic(systemPrompt, history, userMessage);
      default:
        console.warn(`[LLM] Unknown provider "${PROVIDER}", falling back to Gemini`);
        return await callGemini(systemPrompt, history, userMessage);
    }
  } catch (error: any) {
    console.error(`[LLM Chatbot] ${PROVIDER} error:`, error?.message || error);
    return fallbackResponse(userContext);
  }
}
