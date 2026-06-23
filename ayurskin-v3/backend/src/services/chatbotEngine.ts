// Rule-based chatbot engine for simple, fast intents
// LLM is used for complex/contextual questions (see llmChatbot.ts)

export type ChatState =
  | 'GREETING'
  | 'AWAITING_ACTION'
  | 'ANALYSIS_PROMPTED'
  | 'POST_ANALYSIS'
  | 'REMEDY_INFO'
  | 'DIET_INFO'
  | 'ROUTINE_INFO';

export interface ChatContext {
  userId: string;
  sessionId: string;
  state: ChatState;
  slots: {
    lastCondition?: string;
    lastSkinType?: string;
    lastRegion?: string;
  };
}

export interface ChatResponse {
  response: string;
  newState: ChatState;
  action: { type: 'navigate' | 'open_camera' | 'show_analysis' | 'none'; payload?: string };
}

export function createChatContext(userId: string, sessionId: string): ChatContext {
  return { userId, sessionId, state: 'GREETING', slots: {} };
}

const GREETINGS = ['hello', 'hi', 'hey', 'namaste', 'hii', 'helo', 'helloo'];
const CAMERA_TRIGGERS = ['camera', 'live', 'capture', 'photo', 'selfie', 'webcam', 'take photo'];
const UPLOAD_TRIGGERS = ['upload', 'analyze', 'analyse', 'scan', 'check my skin', 'test my skin'];
const REMEDY_TRIGGERS = ['remedy', 'remedies', 'treatment', 'cure', 'how to treat', 'home remedy'];
const DIET_TRIGGERS = ['diet', 'food', 'eat', 'nutrition', 'meal', 'what to eat'];
const ROUTINE_TRIGGERS = ['routine', 'morning', 'night', 'skincare routine', 'steps', 'order'];
const HELP_TRIGGERS = ['help', 'what can you do', 'features', 'commands'];

function matchesAny(text: string, triggers: string[]): boolean {
  const lower = text.toLowerCase();
  return triggers.some(t => lower.includes(t));
}

export function processMessage(ctx: ChatContext, message: string): ChatResponse {
  const msg = message.toLowerCase().trim();

  // ── Greeting ────────────────────────────────────────────────────────────────
  if (matchesAny(msg, GREETINGS) && msg.split(' ').length <= 3) {
    return {
      response: `Namaste! 🌿 I'm AyurSkin AI — your intelligent Ayurvedic skincare assistant.\n\nI can:\n• Analyse your skin via camera or photo upload\n• Answer questions about your skin condition and history\n• Suggest Ayurvedic remedies, diet plans, and routines\n• Track your improvement over time\n\nWhat would you like to do? You can say **"start camera"**, **"upload a photo"**, or ask me anything about your skin!`,
      newState: 'AWAITING_ACTION',
      action: { type: 'none' },
    };
  }

  // ── Help ────────────────────────────────────────────────────────────────────
  if (matchesAny(msg, HELP_TRIGGERS)) {
    return {
      response: `Here's what I can help with:\n\n📸 **Skin Analysis** — Say "start camera" or "upload photo"\n💬 **Ask questions** — "Why do I have acne on my cheeks?"\n🥗 **Diet advice** — "What should I eat for pigmentation?"\n🌿 **Remedies** — "What remedies work for tanning?"\n🧴 **Routines** — "Show me my morning routine"\n📈 **Progress** — "How has my skin changed?"\n\nFor complex questions, I use AI to give you personalized answers based on your actual skin data!`,
      newState: 'AWAITING_ACTION',
      action: { type: 'none' },
    };
  }

  // ── Camera / Live capture ────────────────────────────────────────────────────
  if (matchesAny(msg, CAMERA_TRIGGERS)) {
    return {
      response: `Opening the live camera for real-time skin analysis! 📸\n\nTips for best results:\n• Use good natural lighting (face a window)\n• Remove glasses and tie back hair\n• Hold still for 2-3 seconds\n• Aim for a neutral expression`,
      newState: 'ANALYSIS_PROMPTED',
      action: { type: 'open_camera' },
    };
  }

  // ── Upload / Analyse ────────────────────────────────────────────────────────
  if (matchesAny(msg, UPLOAD_TRIGGERS)) {
    return {
      response: `I'll take you to the analysis page where you can upload a photo! 🔬\n\nFor accurate results:\n• Use a clear, well-lit photo\n• Face the camera directly\n• No heavy filters or makeup\n• JPEG or PNG format, max 10MB`,
      newState: 'ANALYSIS_PROMPTED',
      action: { type: 'navigate', payload: 'analysis' },
    };
  }

  // ── Remedy questions ─────────────────────────────────────────────────────────
  if (matchesAny(msg, REMEDY_TRIGGERS) && ctx.slots.lastCondition) {
    const condition = ctx.slots.lastCondition;
    const remedyMap: Record<string, string> = {
      acne:         '**Neem & Turmeric Paste** (antibacterial + anti-inflammatory)\n**Multani Mitti + Aloe** (sebum control)\n**Tea Tree spot treatment** (clinically proven)',
      pigmentation: '**Kumkumadi Face Oil** (saffron + almond oil — tyrosinase inhibitor)\n**Papaya Enzyme Mask** (papain exfoliation)\n**Vitamin C + Gram Flour Pack** (brightening)',
      tanning:      '**Sandalwood + Rose De-tan Pack** (alpha-santalol lightens melanin)\n**Potato + Lemon Rub** (catecholase enzyme)\n**Yogurt Lactic Acid Mask** (AHA exfoliation)',
      normal:       '**Rose & Almond Maintenance Oil** (evening)\n**Oatmeal Gentle Cleanser** (weekly)',
    };
    return {
      response: `Based on your ${condition} diagnosis, here are the most effective Ayurvedic remedies:\n\n${remedyMap[condition] || remedyMap.normal}\n\nAll these are visible in your Analysis tab with full preparation instructions. Which one would you like to know more about?`,
      newState: 'REMEDY_INFO',
      action: { type: 'show_analysis' },
    };
  }

  // ── Diet questions ───────────────────────────────────────────────────────────
  if (matchesAny(msg, DIET_TRIGGERS) && ctx.slots.lastCondition) {
    const condition = ctx.slots.lastCondition;
    const dietMap: Record<string, string> = {
      acne:         '🚫 Avoid: Sugar, dairy, fried food, refined flour\n✅ Eat: Pumpkin seeds (zinc), flaxseeds (Omega-3), green tea, amla, probiotics\n💧 Drink: 3L water/day, neem tea, turmeric milk',
      pigmentation: '🚫 Avoid: Excess tea/coffee, processed foods, alcohol\n✅ Eat: Amla (Vitamin C), carrots, tomatoes, papaya, almonds (Vit E)\n💧 Drink: Amla juice daily, 2.5L water',
      tanning:      '🚫 Avoid: Spicy food, excess red meat, alcohol, sugar\n✅ Eat: Watermelon, cucumber, coconut water, mint, amla\n💧 Drink: 3L water, coconut water 3x/week, aloe vera juice',
      normal:       '✅ Balanced diet with seasonal fruits, whole grains, ghee, nuts\n💧 Drink: 2.5L water, one herbal tea daily',
    };
    return {
      response: `Here's your personalized diet guidance for **${condition}**:\n\n${dietMap[condition] || dietMap.normal}\n\nYour Analysis tab has a full 7-day meal plan with morning drinks, breakfast, lunch, snacks, and dinner — all tailored to your condition!`,
      newState: 'DIET_INFO',
      action: { type: 'show_analysis' },
    };
  }

  // ── Routine questions ────────────────────────────────────────────────────────
  if (matchesAny(msg, ROUTINE_TRIGGERS)) {
    return {
      response: `Your personalized AM/PM skincare routine is generated based on your skin condition AND skin type. Check the **Routine** tab in your latest analysis for the full step-by-step guide!\n\nQuick overview:\n• **Morning**: Cleanse → Tone → Treat → Moisturize → SPF (always!)\n• **Night**: Double cleanse → Tone → Active treatment → Rich moisturizer\n\nWant me to explain any specific step?`,
      newState: 'ROUTINE_INFO',
      action: { type: 'show_analysis' },
    };
  }

  // ── Progress questions ───────────────────────────────────────────────────────
  if (msg.includes('progress') || msg.includes('history') || msg.includes('improvement') || msg.includes('getting better')) {
    return {
      response: `Head to the **Progress** tab to see your skin improvement timeline with charts! 📈\n\nYou can also check the **History** tab to compare any two analyses side-by-side to see exact changes in brightness, uniformity, and condition.`,
      newState: 'AWAITING_ACTION',
      action: { type: 'navigate', payload: 'progress' },
    };
  }

  // ── Analysis complete (called programmatically) ───────────────────────────────
  // Fallback for simple messages — prompt for more info
  return {
    response: `I'd love to give you a detailed, personalized answer! Could you tell me:\n\n1. Which skin condition are you asking about? (acne/pigmentation/tanning)\n2. Which area of your face? (forehead, cheeks, nose, chin)\n\nOr if you've already done an analysis, ask me something like:\n*"Why do I have acne on my cheeks?"*\n*"What should I eat to reduce my pigmentation?"*`,
    newState: ctx.state,
    action: { type: 'none' },
  };
}

export function handleAnalysisComplete(
  ctx: ChatContext,
  condition: string,
  detectionResult: any,
  analysisId: string
): ChatResponse {
  ctx.slots.lastCondition = condition;
  const counts = detectionResult?.counts || {};
  const summary = detectionResult?.summary || [];

  const conditionMessages: Record<string, string> = {
    acne:         `Your analysis is complete! 🔬 I detected **acne** with ${counts.acne_spots || 0} spot(s) visible.\n\n${summary[0] || ''}\n\nYour personalized Ayurvedic remedies, 7-day diet plan, and morning/night routine are now ready. Ask me *"Why do I have acne?"* or *"What should I eat?"* for deeper insights!`,
    pigmentation: `Analysis complete! 🔬 I detected **pigmentation/dark spots**.\n\n${summary[0] || ''}\n\nYour brightening remedy plan and Vitamin C-rich diet are ready. Ask me anything about your results!`,
    tanning:      `Analysis complete! 🔬 I detected **sun tanning** across your skin.\n\n${summary[0] || ''}\n\nYour de-tanning routine and cooling diet plan are ready. Ask me *"How do I reverse my tan?"* for a detailed plan!`,
    normal:       `Great news! 🎉 Your skin appears **healthy and normal** — no significant conditions detected.\n\nYour maintenance routine and preventive diet are ready. Keep up the good habits!`,
  };

  return {
    response: conditionMessages[condition] || conditionMessages.normal,
    newState: 'POST_ANALYSIS',
    action: { type: 'show_analysis', payload: analysisId },
  };
}
