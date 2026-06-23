const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function getToken() { return localStorage.getItem('auth_token'); }

async function request<T = any>(
  method: string,
  endpoint: string,
  body?: any,
  isFormData = false
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData && body) headers['Content-Type'] = 'application/json';

  const res = await fetch(BASE_URL + endpoint, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || `HTTP ${res.status}`);
  return data as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  profileComplete: boolean;
  age?: number;
  gender?: string;
  skinType?: string;
  city?: string;
  createdAt: string;
}

export interface RegionResult {
  region: string;
  condition: string;
  confidence: number;
  probabilities: Record<string, number>;
  bbox: [number, number, number, number];
}

export interface SkinAnalysis {
  id: string;
  condition: 'acne' | 'pigmentation' | 'tanning' | 'normal';
  confidence: number;
  probabilities: Record<string, number>;
  imageUrl: string;
  heatmapUrl?: string;
  region: string;
  season: string;
  skinType: string;
  skinTypeMetrics?: Record<string, number>;
  regionAnalysis: RegionResult[];
  detectionSummary: string[];
  detectionCounts: Record<string, number>;
  severityScore: number;
  severityBand: 'clear' | 'mild' | 'moderate' | 'severe';
  modelType: string;
  isFallback: boolean;
  recommendations: {
    remedies: any[];
    dietPlan: any;
    exercises: any[];
    homemadePacks: any[];
    lifestyleTips: string[];
    avoidPractices: string[];
    explainedLogic: string;
    routine?: { morning: string[]; night: string[] };
    severityScore?: number;
  };
  createdAt: string;
}

export interface SkinAnalysisRecord extends SkinAnalysis {
  _id: string;
}

export interface ProgressSnapshot {
  _id: string;
  imageUrl: string;
  note?: string;
  analysisResult?: { condition: string; confidence: number; probabilities: Record<string, number> };
  comparisonWithPrevious?: {
    acneReduction: number;
    brightnessImprovement: number;
    uniformityImprovement: number;
    overallImprovement: boolean;
    insights: string[];
  };
  severityScore?: number;
  severityBand?: string;
  createdAt: string;
}

export interface TrendData {
  hasData: boolean;
  severityScore?: number;
  band?: string;
  direction?: string;
  weekOverWeekChange?: number;
  dataPoints?: number;
  trendConfidence?: string;
  alert?: { level: string; triggered: boolean; message: string; actionRequired: string; showDermatologistCard: boolean };
  insight?: string;
  timeline?: Array<{ date: string; severityScore: number; band: string; condition: string; skinType: string }>;
  latestCondition?: string;
}

export interface CompareResult {
  before: { id: string; condition: string; confidence: number; imageUrl: string; createdAt: string };
  after:  { id: string; condition: string; confidence: number; imageUrl: string; createdAt: string };
  mlComparison?: any;
  insights: string[];
  daysBetween: number;
}

export interface UserProfile {
  name: string;
  email: string;
  age?: number;
  gender?: string;
  skinType?: string;
  city?: string;
  profileComplete: boolean;
}

// ─── API namespaces ───────────────────────────────────────────────────────────
export const authApi = {
  signup: (name: string, email: string, password: string) =>
    request('POST', '/auth/signup', { name, email, password }),
  login: (email: string, password: string) =>
    request('POST', '/auth/login', { email, password }),
};

export const profileApi = {
  get: () => request<UserProfile>('GET', '/profile'),
  update: (data: Partial<UserProfile>) => request('POST', '/profile', data),
};

export const skinApi = {
  analyze: (image: File, region: string, season: string) => {
    const fd = new FormData();
    fd.append('image', image);
    fd.append('region', region);
    fd.append('season', season);
    return request<SkinAnalysis>('POST', '/skin/analyze', fd, true);
  },
  list: (page = 1, limit = 10) =>
    request<{ analyses: SkinAnalysisRecord[]; pagination: any }>('GET', `/skin/analyses?page=${page}&limit=${limit}`),
  get: (id: string) => request<SkinAnalysisRecord>('GET', `/skin/analyses/${id}`),
  delete: (id: string) => request('DELETE', `/skin/analyses/${id}`),
  compare: (id1: string, id2: string) =>
    request<CompareResult>('POST', '/skin/compare', { analysisId1: id1, analysisId2: id2 }),
};

export const progressApi = {
  createSnapshot: (image: File, note?: string) => {
    const fd = new FormData();
    fd.append('image', image);
    if (note) fd.append('note', note);
    return request<ProgressSnapshot>('POST', '/progress/snapshots', fd, true);
  },
  list: () => request<ProgressSnapshot[]>('GET', '/progress/snapshots'),
  delete: (id: string) => request('DELETE', `/progress/snapshots/${id}`),
  getTrend: () => request<TrendData>('GET', '/progress/trend'),
};

export const habitsApi = {
  logHabits: (data: any) => request('POST', '/habits/log', data),
  getLogs: (days = 30) => request('GET', `/habits/log?days=${days}`),
  getToday: () => request('GET', '/habits/today'),
  getCorrelation: () => request('GET', '/habits/correlation'),
};

export const chatApi = {
  createSession: (sessionId?: string) => request('POST', '/chat/session', { sessionId }),
  sendMessage: (sessionId: string, message: string) =>
    request('POST', '/chat/message', { sessionId, message }),
  clearSession: (sessionId: string) => request('DELETE', `/chat/session/${sessionId}`),
  analyzeCapture: (image: string, sessionId?: string) =>
    request('POST', '/capture/analyze', { image, sessionId }),
};

export const reportApi = {
  generate: (analysisId: string) =>
    request<{ pdfUrl: string }>('POST', '/report/generate', { analysisId }),
  getForAnalysis: (analysisId: string) =>
    request<{ pdfUrl: string; generatedAt: string }>('GET', `/report/${analysisId}`),
};

export const environmentApi = {
  get: (city: string) => request('GET', `/environment/${encodeURIComponent(city)}`),
};

export const gamificationApi = {
  getState: () => request('GET', '/gamification/state'),
  getBadges: () => request('GET', '/gamification/badges'),
};

export function getImageUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const base = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';
  return base + url;
}
