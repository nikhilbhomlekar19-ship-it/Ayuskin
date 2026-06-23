export type SkinCondition = 'acne' | 'pigmentation' | 'tanning' | 'normal';
export type SkinType = 'oily' | 'dry' | 'combination' | 'normal' | 'unknown';

const CLEANSER: Record<string, string> = {
  oily:        'Neem + Tea Tree foam cleanser (deep-pore clean, pH 5.5, sulfate-free)',
  dry:         'Milk + Aloe vera gentle cream cleanser (no sulfates, no fragrance)',
  combination: 'Tulsi + Sandalwood gel cleanser (balances T-zone and cheeks)',
  normal:      'Rose water + Glycerin mild cleanser (gentle, non-stripping)',
  unknown:     'Gentle pH-balanced cleanser suitable for all skin types',
};

const TONER: Record<string, string> = {
  oily:        'Witch hazel toner (diluted 1:3) or neem water spray',
  dry:         'Rose water spray — soak cotton pad, press gently',
  combination: 'Rose water + apple cider vinegar (1:4) toner',
  normal:      'Plain rose water or aloe vera water spray',
  unknown:     'Rose water toner — universally suitable',
};

const TREATMENT: Record<string, string> = {
  acne:         'Niacinamide 10% serum + Salicylic acid 2% spot treatment on active pimples',
  pigmentation: 'Vitamin C 15% serum (morning) + Kojic acid or Alpha Arbutin spot treatment',
  tanning:      'Licorice root extract serum + Aloe vera brightening gel',
  normal:       'Hyaluronic acid 2% + Aloe vera hydrating serum',
};

const MOISTURISER: Record<string, string> = {
  oily:        'Oil-free gel moisturiser (aloe vera base, no petroleum, no mineral oil)',
  dry:         'Ceramide + Squalane cream — apply while skin is still slightly damp',
  combination: 'Light lotion — heavier on cheeks, minimal on T-zone',
  normal:      'Lightweight moisturiser with hyaluronic acid or aloe vera',
  unknown:     'Lightweight non-comedogenic moisturiser',
};

const NIGHT_TREATMENT: Record<string, string> = {
  acne:         'Benzoyl peroxide 2.5% on spots OR Azadirachta (neem) oil diluted 1:5 in carrier oil',
  pigmentation: 'Retinol 0.025% (beginners) or Bakuchiol serum (plant-based retinol alternative)',
  tanning:      'Glycolic acid 5% toner + Shea butter seal (alternate nights)',
  normal:       'Bakuchiol serum + light Jojoba oil massage',
};

export function buildRoutine(condition: SkinCondition, skinType: SkinType, season: string): { morning: string[]; night: string[] } {
  const spf = season === 'Summer'
    ? 'SPF 50+ broad-spectrum sunscreen (MUST — single most important step for all conditions)'
    : 'SPF 30 daily sunscreen (reapply every 2 hours if outdoors)';

  const moistType = (skinType === 'unknown' ? 'normal' : skinType) as string;

  return {
    morning: [
      `Step 1 — Cleanse: ${CLEANSER[moistType] || CLEANSER.unknown}`,
      `Step 2 — Tone: ${TONER[moistType] || TONER.unknown}`,
      `Step 3 — Treat: ${TREATMENT[condition]}`,
      `Step 4 — Moisturise: ${MOISTURISER[moistType] || MOISTURISER.unknown}`,
      `Step 5 — Protect: ${spf}`,
    ],
    night: [
      'Step 1 — Double cleanse: Oil massage (sesame/coconut) → foam cleanser (removes sunscreen + pollution)',
      `Step 2 — Tone: Same toner as morning`,
      `Step 3 — Night treatment: ${NIGHT_TREATMENT[condition]}`,
      `Step 4 — Moisturise: ${moistType === 'dry' ? 'Shea butter + Jojoba oil rich cream' : moistType === 'oily' ? 'Light gel moisturiser — skin still needs hydration even if oily' : MOISTURISER[moistType] || MOISTURISER.unknown}`,
      'Step 5 — Eye area: 2 drops of almond oil gently tapped (ring finger only) under and around eyes',
    ],
  };
}
