import skinConditionsData from '../knowledge/skinConditions.json';

interface KnowledgeDoc {
  id: string;
  topic: string;
  subtopic: string;
  text: string;
  keywords: string[];
}

const ALL_DOCS: KnowledgeDoc[] = skinConditionsData as KnowledgeDoc[];

function scoreDoc(doc: KnowledgeDoc, query: string, condition: string): number {
  const q = query.toLowerCase();
  let score = 0;

  // Keyword overlap (most important signal)
  doc.keywords.forEach(kw => {
    if (q.includes(kw.toLowerCase())) score += 2;
  });

  // Exact topic/condition match
  if (doc.topic === condition) score += 3;
  if (doc.topic === 'general') score += 1; // general advice always somewhat relevant

  // Subtopic signals from query
  if ((q.includes('why') || q.includes('cause') || q.includes('reason')) && doc.subtopic === 'causes') score += 3;
  if ((q.includes('diet') || q.includes('food') || q.includes('eat') || q.includes('nutrition')) && doc.subtopic === 'diet') score += 3;
  if ((q.includes('remedy') || q.includes('treatment') || q.includes('cure') || q.includes('fix') || q.includes('apply') || q.includes('pack') || q.includes('mask')) && doc.subtopic === 'remedy') score += 3;
  if ((q.includes('lifestyle') || q.includes('habit') || q.includes('daily') || q.includes('routine')) && doc.subtopic === 'lifestyle') score += 3;
  if ((q.includes('sun') || q.includes('spf') || q.includes('sunscreen')) && doc.subtopic === 'sun_protection') score += 3;

  // Region-specific signals
  if (q.includes('cheek') && doc.id.includes('cheek')) score += 4;
  if (q.includes('forehead') && doc.id.includes('forehead')) score += 4;
  if (q.includes('nose') && doc.id.includes('nose')) score += 4;
  if (q.includes('chin') && doc.id.includes('chin')) score += 4;

  // Severity and trend questions
  if ((q.includes('getting worse') || q.includes('worsening') || q.includes('increasing')) && doc.subtopic === 'causes') score += 2;
  if ((q.includes('improve') || q.includes('better') || q.includes('reduce')) && (doc.subtopic === 'remedy' || doc.subtopic === 'diet')) score += 2;

  return score;
}

export function retrieveContext(userMessage: string, condition: string, topK = 3): string {
  const scored = ALL_DOCS
    .map(doc => ({ doc, score: scoreDoc(doc, userMessage, condition) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  if (scored.length === 0) return '';

  return 'RETRIEVED SKIN KNOWLEDGE BASE:\n' +
    scored.map(x => `[${x.doc.topic}/${x.doc.subtopic}] ${x.doc.text}`).join('\n\n');
}
