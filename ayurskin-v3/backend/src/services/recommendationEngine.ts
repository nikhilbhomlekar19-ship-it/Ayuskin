/**
 * Recommendation Engine -- Phase 2
 * Rule-based engine mapping skin conditions -> Ayurvedic remedies, diet, exercises
 * NO external AI API calls. Fully deterministic and explainable.
 */

export type SkinCondition = 'acne' | 'pigmentation' | 'tanning' | 'normal';

export interface Remedy {
  name: string;
  ingredients: string[];
  preparation: string;
  application: string;
  frequency: string;
  benefits: string[];
}

export interface DietDay {
  day: number;
  morning: string;
  breakfast: string;
  lunch: string;
  snack: string;
  dinner: string;
}

export interface DietPlan {
  condition: SkinCondition;
  generalTips: string[];
  avoidFoods: string[];
  superfoods: string[];
  days: DietDay[];
  hydration: string;
}

export interface Exercise {
  id: number;
  name: string;
  ayurvedicName: string;
  description: string;
  steps: string[];
  durationSeconds: number;
  repetitions: number;
  benefits: string[];
  suitableFor: SkinCondition[];
}

export interface FullRecommendation {
  condition: SkinCondition;
  remedies: Remedy[];
  dietPlan: DietPlan;
  exercises: Exercise[];
  homemadePacks: Remedy[];
  lifestyleTips: string[];
  avoidPractices: string[];
  explainedLogic: string;
}

// ====================================================
// REMEDIES DATABASE
// ====================================================
const REMEDIES_DB: Record<SkinCondition, Remedy[]> = {
  acne: [
    {
      name: 'Neem & Turmeric Paste',
      ingredients: ['2 tbsp neem powder', '1 tsp turmeric', '1 tsp raw honey', 'rose water (to make paste)'],
      preparation: 'Mix neem powder and turmeric. Add honey. Add rose water slowly until you get a smooth paste.',
      application: 'Apply thin layer on affected areas. Avoid eye area.',
      frequency: 'Every alternate day, leave for 20 minutes then wash with cool water.',
      benefits: [
        'Neem is antibacterial -- kills Propionibacterium acnes bacteria',
        'Turmeric (curcumin) reduces inflammation and redness',
        'Honey is humectant and has antimicrobial properties'
      ]
    },
    {
      name: 'Multani Mitti (Fullers Earth) & Aloe Pack',
      ingredients: ['2 tbsp multani mitti', '2 tbsp fresh aloe vera gel', '1 tsp lemon juice (optional for oily skin)'],
      preparation: 'Mix all ingredients until no lumps remain. Adjust consistency with rose water.',
      application: 'Apply evenly on face. Let dry completely (15-20 min).',
      frequency: 'Twice a week.',
      benefits: [
        'Multani mitti absorbs excess sebum -- key acne trigger',
        'Aloe vera soothes inflammation and accelerates healing',
        'Natural astringent -- minimizes pores'
      ]
    },
    {
      name: 'Tea Tree & Sandalwood Spot Treatment',
      ingredients: ['2 drops tea tree essential oil', '1 tsp sandalwood powder', '1 tsp coconut oil (carrier)'],
      preparation: 'Mix sandalwood powder with coconut oil. Add tea tree oil. Stir well.',
      application: 'Apply directly on pimples only using a cotton swab.',
      frequency: 'Daily at night.',
      benefits: [
        'Tea tree oil has proven antibacterial and antifungal properties',
        'Sandalwood cools and soothes inflamed skin (Pitta pacifying)',
        'Prevents scarring and post-acne marks'
      ]
    }
  ],

  pigmentation: [
    {
      name: 'Kumkumadi Tailam-Inspired Face Oil',
      ingredients: ['1 tsp saffron strands', '2 tbsp almond oil', '1 tsp turmeric powder', '1 tsp sandalwood powder'],
      preparation: 'Warm almond oil slightly. Soak saffron for 30 min. Mix in turmeric and sandalwood.',
      application: 'Massage 4-5 drops onto clean face in upward circular motions.',
      frequency: 'Nightly before bed. Rinse in the morning.',
      benefits: [
        'Saffron (crocin) inhibits melanin synthesis -- reduces dark spots',
        'Almond oil (vitamin E) protects against oxidative pigmentation',
        'Traditional Kumkumadi is an Ayurvedic brightening gold standard'
      ]
    },
    {
      name: 'Papaya Enzyme & Honey Brightening Mask',
      ingredients: ['2 tbsp ripe papaya pulp (mashed)', '1 tsp raw honey', '1 tsp milk or curd'],
      preparation: 'Mash fresh ripe papaya thoroughly. Mix in honey and milk/curd.',
      application: 'Apply uniformly on face and neck. Focus on dark patches.',
      frequency: '3 times per week, 15 minutes each session.',
      benefits: [
        'Papain enzyme in papaya naturally exfoliates dead skin cells',
        'Reduces hyperpigmentation by accelerating cell turnover',
        'Lactic acid in curd acts as gentle AHA for brightening'
      ]
    },
    {
      name: 'Vitamin C Citrus & Turmeric Brightening Pack',
      ingredients: ['1 tsp lemon juice', '1 tsp orange peel powder', '1/2 tsp turmeric', '1 tbsp gram flour (besan)'],
      preparation: 'Mix dry ingredients. Add lemon juice to form a thick paste.',
      application: 'Patch test first. Apply and leave for 10 minutes.',
      frequency: 'Twice weekly. Always apply SPF afterwards.',
      benefits: [
        'Vitamin C (ascorbic acid) blocks tyrosinase -- the melanin production enzyme',
        'Orange peel powder has bioflavonoids that reduce UV-induced pigmentation',
        'Gram flour gently exfoliates for brighter appearance'
      ]
    }
  ],

  tanning: [
    {
      name: 'Chandan (Sandalwood) & Rose De-tan Pack',
      ingredients: ['2 tbsp sandalwood powder', '1 tbsp rose water', '1 tbsp raw milk', '1 tsp honey'],
      preparation: 'Mix sandalwood powder with rose water and milk to form a paste. Add honey.',
      application: 'Apply generously on tanned areas (face, neck, arms). Leave for 25-30 min.',
      frequency: 'Every 2 days for first 2 weeks, then weekly for maintenance.',
      benefits: [
        'Sandalwoods alpha-santalol lightens melanin buildup from sun exposure',
        'Rose water has anti-inflammatory properties, soothes sun-stressed skin',
        'Milk (lactic acid) dissolves keratin plugs that hold discoloration'
      ]
    },
    {
      name: 'Potato & Lemon Depigmentation Rub',
      ingredients: ['1/2 raw potato (grated or juiced)', '1 tsp lemon juice', '1 tsp honey'],
      preparation: 'Grate potato and squeeze juice. Mix with lemon juice and honey.',
      application: 'Rub onto tanned areas. Gently massage in circular motions for 5 minutes. Leave for 20 min.',
      frequency: 'Daily or every alternate day.',
      benefits: [
        'Potato contains azelaic acid which inhibits melanin overproduction',
        'Catecholase enzyme in potato has natural bleaching action',
        'Proven effective for sun tan reversal in clinical herbology'
      ]
    },
    {
      name: 'Yogurt Lactic Acid Brightening Mask',
      ingredients: ['3 tbsp plain full-fat yogurt', '1 tsp turmeric', '1 tsp gram flour'],
      preparation: 'Mix all ingredients into a smooth consistency.',
      application: 'Apply thick layer on affected areas. Relax for 20-25 minutes.',
      frequency: '3-4 times per week.',
      benefits: [
        'Lactic acid in yogurt naturally exfoliates tan-holding dead skin cells',
        'Probiotic bacteria normalize skin microbiome disrupted by sun',
        'Cooling effect relieves heat stored in sun-damaged skin (reduces Pitta vata)'
      ]
    }
  ],

  normal: [
    {
      name: 'Rose & Almond Glow Maintenance Oil',
      ingredients: ['1 tbsp sweet almond oil', '5 drops rose essential oil', '1 tsp vitamin E oil'],
      preparation: 'Mix all oils in a small glass bottle. Shake well.',
      application: 'Massage 3-4 drops into face after cleansing.',
      frequency: 'Nightly.',
      benefits: [
        'Maintains natural skin moisture balance',
        'Rose oil tones and refines pores',
        'Vitamin E provides antioxidant protection'
      ]
    },
    {
      name: 'Oatmeal & Honey Gentle Cleanser',
      ingredients: ['2 tbsp finely ground oatmeal', '1 tbsp raw honey', '1 tbsp milk'],
      preparation: 'Mix all to form a mild scrub paste.',
      application: 'Use as weekly cleanser/scrub. Gently massage in circles.',
      frequency: 'Once weekly as maintenance.',
      benefits: [
        'Oatmeal soothes and maintains healthy skin barrier',
        'Preventive routine to maintain normal skin health',
        'No harsh chemicals that could disrupt balanced skin'
      ]
    }
  ]
};

// ====================================================
// DIET PLANS DATABASE
// ====================================================
const DIET_PLANS_DB: Record<SkinCondition, DietPlan> = {
  acne: {
    condition: 'acne',
    generalTips: [
      'Avoid high-glycemic foods -- they spike insulin, which triggers sebum overproduction',
      'Eat zinc-rich foods (pumpkin seeds, chickpeas) -- zinc is proven to reduce acne severity',
      'Consume omega-3 fatty acids (flaxseeds, walnuts) to reduce systemic inflammation',
      'Probiotics (curd, idli, dosa) support gut microbiome -- gut-skin axis is clinically established',
      'Drink at least 2.5-3L water daily to flush toxins and reduce skin congestion'
    ],
    avoidFoods: [
      'White bread, refined flour (maida) -- high glycemic index',
      'Cow\'s milk (may increase IGF-1 which worsens acne) -- switch to plant milk',
      'Fried foods and trans fats',
      'Chocolate (especially milk chocolate)',
      'Whey protein supplements',
      'Excess sugar and packaged sweet snacks',
      'Spicy food (increases body heat, worsens acne in some)'
    ],
    superfoods: ['Turmeric', 'Neem (in herbal teas)', 'Pumpkin seeds', 'Green tea', 'Probiotics (curd)', 'Flaxseeds', 'Cucumber'],
    hydration: 'Minimum 3L water daily. Add neem leaves or cucumber slices to water. Avoid sugary drinks completely.',
    days: [
      { day: 1, morning: 'Warm water with turmeric + black pepper', breakfast: 'Moong dal chilla with green chutney', lunch: 'Brown rice + dal + cucumber raita + sabzi', snack: 'Handful of pumpkin seeds + green tea', dinner: 'Vegetable soup + roti + stir-fried vegetables' },
      { day: 2, morning: 'Neem green tea (boil 5 neem leaves)', breakfast: 'Oats porridge with flaxseeds + berries', lunch: 'Jowar roti + palak sabzi + curd', snack: 'Carrot sticks with hummus', dinner: 'Khichdi (moong + rice) with ghee' },
      { day: 3, morning: 'Lemon warm water', breakfast: 'Idli (2-3) with sambar (no oil tempering)', lunch: 'Quinoa salad with roasted chickpeas + veggies', snack: 'Coconut water + walnuts (4-5)', dinner: 'Lauki sabzi + bajra roti + thin curd' },
      { day: 4, morning: 'Amla juice (1 shot)', breakfast: 'Poha with peas and minimal oil', lunch: 'Mixed grain dal (masoor + moong) + brown rice + salad', snack: 'Cucumber + mint cooler', dinner: 'Stuffed capsicum (with paneer/tofu) + roti' },
      { day: 5, morning: 'Tulsi + ginger tea (no sugar)', breakfast: 'Daliya (broken wheat) with milk + dates', lunch: 'Chole (chickpeas) + jowar roti + onion salad', snack: 'Apple + 5 almonds', dinner: 'Mung bean soup + rice + stir-fried green beans' },
      { day: 6, morning: 'Water with soaked chia seeds', breakfast: 'Besan chilla with spinach filling', lunch: 'Rajma (kidney beans -- zinc rich) + brown rice', snack: 'Green tea + roasted flaxseed crackers', dinner: 'Baked fish/tofu with turmeric + steamed vegetables' },
      { day: 7, morning: 'Wheatgrass juice or amla water', breakfast: 'Vegetable upma with curry leaves', lunch: 'Toor dal + rice + drumstick sabzi + curd', snack: 'Watermelon slices', dinner: 'Moong dal soup + whole wheat roti + stir-fried broccoli' }
    ]
  },

  pigmentation: {
    condition: 'pigmentation',
    generalTips: [
      'Load up on Vitamin C -- it inhibits tyrosinase (the melanin-making enzyme)',
      'Eat antioxidant-rich foods to neutralize free radicals that worsen pigmentation',
      'Vitamin E works synergistically with Vitamin C -- combine in diet',
      'Beta-carotene (carrots, sweet potato) converts to Vitamin A -- promotes even skin tone',
      'Avoid sun exposure between 11am-4pm; diet supports but cannot replace sun protection'
    ],
    avoidFoods: [
      'Processed foods with preservatives (worsen oxidative stress)',
      'Excess tea and coffee (tannins reduce iron absorption, affecting skin)',
      'Alcohol (dehydrates skin and worsens pigmentation)',
      'Excess salt (causes water retention and dull skin)',
      'Refined oils -- switch to cold-pressed mustard or coconut oil'
    ],
    superfoods: ['Amla (highest natural Vitamin C)', 'Carrots', 'Sweet potato', 'Tomatoes (lycopene)', 'Papaya', 'Pomegranate', 'Almonds (Vitamin E)'],
    hydration: '2.5-3L daily. Include amla juice or lemon water daily. Coconut water 3x per week for electrolytes.',
    days: [
      { day: 1, morning: 'Fresh amla juice (2-3 amlas juiced)', breakfast: 'Carrot-spinach paratha with curd', lunch: 'Sweet potato + chickpea curry + brown rice', snack: 'Orange or kiwi + almonds', dinner: 'Tomato-based dal + roti + salad' },
      { day: 2, morning: 'Lemon + honey warm water', breakfast: 'Papaya bowl with pumpkin seeds', lunch: 'Rajma + steamed rice + pomegranate raita', snack: 'Carrot sticks + hummus', dinner: 'Palak paneer + jowar roti' },
      { day: 3, morning: 'Amla + turmeric shot', breakfast: 'Besan chilla with tomato chutney', lunch: 'Masoor dal + rice + beetroot sabzi', snack: 'Strawberries + walnuts', dinner: 'Stuffed tomato with paneer/tofu + roti' },
      { day: 4, morning: 'Warm water with soaked raisins', breakfast: 'Oats + pomegranate + nuts bowl', lunch: 'Mixed vegetable curry (bell peppers, carrots) + millet roti', snack: 'Guava (Vitamin C powerhouse)', dinner: 'Fish/tofu in tomato-turmeric gravy + rice' },
      { day: 5, morning: 'Cucumber + mint detox water', breakfast: 'Idli + tomato-based sambar', lunch: 'Chickpea + spinach salad + brown rice', snack: 'Papaya slices + sunflower seeds', dinner: 'Baingan (eggplant) + sweet potato sabzi + roti' },
      { day: 6, morning: 'Fresh orange juice (no sugar)', breakfast: 'Poha with pomegranate and carrot', lunch: 'Lemon rice + dal + carrot-cucumber salad', snack: 'Almond milk with saffron', dinner: 'Bottle gourd + moong dal khichdi' },
      { day: 7, morning: 'Amla + ginger shot', breakfast: 'Daliya with berries and soaked almonds', lunch: 'Palak dal + brown rice + curd', snack: 'Grapes + walnuts', dinner: 'Paneer/tofu tikka (grilled) + salad + roti' }
    ]
  },

  tanning: {
    condition: 'tanning',
    generalTips: [
      'Cooling foods reduce excess Pitta (heat) that worsens tanning and sun damage',
      'Vitamin C accelerates reversal of UV-induced melanin overproduction',
      'Drink coconut water daily -- electrolytes restore sun-damaged skin hydration',
      'Include natural coolants: cucumber, watermelon, mint, coriander',
      'Silica-rich foods (cucumber, oats) support collagen and even skin texture'
    ],
    avoidFoods: [
      'Hot and spicy food (increases body heat/Pitta)',
      'Excess red meat (pro-inflammatory and heat-generating)',
      'Alcohol and caffeinated drinks (dehydrating)',
      'Sour fermented foods in excess (tamarind, very sour curd)',
      'Refined sugar (causes glycation, worsening sun damage effects)'
    ],
    superfoods: ['Watermelon (lycopene)', 'Cucumber', 'Coconut water', 'Mint', 'Amla', 'Aloe vera juice', 'Coriander (cooling)'],
    hydration: '3-3.5L daily minimum. Include cucumber-infused water, coconut water, and aam panna (mango). Avoid iced drinks.',
    days: [
      { day: 1, morning: 'Cucumber + mint detox water (overnight)', breakfast: 'Poha with coriander + coconut', lunch: 'Raita + curd rice + cucumber salad + tinda sabzi', snack: 'Watermelon slices + pumpkin seeds', dinner: 'Lauki (bottle gourd) dal + jowar roti' },
      { day: 2, morning: 'Aloe vera juice (2 tbsp pure gel + water)', breakfast: 'Moong dal chilla + mint chutney', lunch: 'Mung bean khichdi + buttermilk + salad', snack: 'Coconut water + 2-3 dates', dinner: 'Vegetable soup + multigrain roti' },
      { day: 3, morning: 'Amla juice + rose water (1 tsp in water)', breakfast: 'Oats with cucumber and mint smoothie', lunch: 'Brown rice + palak dal + boondi raita', snack: 'Cold curd with coriander', dinner: 'Stuffed parval (pointed gourd) + roti' },
      { day: 4, morning: 'Tender coconut water', breakfast: 'Idli + coconut chutney + sambar', lunch: 'Curd rice + karela (bitter gourd) sabzi + salad', snack: 'Musk melon / honeydew melon', dinner: 'Vegetable khichdi + plain curd' },
      { day: 5, morning: 'Lemon water with honey (room temp)', breakfast: 'Daliya (wheat porridge) + banana', lunch: 'Chickpea + cucumber salad + mint roti', snack: 'Watermelon juice (fresh, no sugar)', dinner: 'Moong dal soup + brown rice + stir-fried zucchini' },
      { day: 6, morning: 'Peppermint tea (cooled)', breakfast: 'Sattu drink (sattu + water + lemon + black salt)', lunch: 'Quinoa salad with cucumbers, tomatoes, coriander', snack: 'Coconut ladoo (homemade, jaggery) + nimbu pani', dinner: 'Arbi (taro root) sabzi + jowar roti + curd' },
      { day: 7, morning: 'Cucumber + aloe vera detox water', breakfast: 'Sprouts salad + lemon juice', lunch: 'Dal fry (no cream) + rice + tomato-cucumber raita', snack: 'Chaas (buttermilk) with roasted jeera', dinner: 'Pumpkin + potato sabzi + roti + curd' }
    ]
  },

  normal: {
    condition: 'normal',
    generalTips: [
      'Your skin is balanced -- focus on maintenance and prevention',
      'Eat a rainbow of vegetables to ensure diverse antioxidant intake',
      'Regular water intake (2.5L) and seasonal fruits maintain skin glow',
      'Include healthy fats (ghee, coconut oil, avocado) for natural moisture',
      'Seasonal eating (Ritucharya) is key in Ayurveda for sustained skin health'
    ],
    avoidFoods: [
      'Highly processed foods regularly',
      'Excess caffeine',
      'Skipping meals (disrupts digestion and skin metabolism)'
    ],
    superfoods: ['Seasonal fruits', 'Ghee', 'Nuts and seeds', 'Whole grains', 'Fresh curd'],
    hydration: '2.5L daily. Include one herbal tea per day.',
    days: [
      { day: 1, morning: 'Warm water with lemon', breakfast: 'Paneer paratha + curd', lunch: 'Dal + rice + seasonal sabzi + salad', snack: 'Fruits + nuts', dinner: 'Vegetable pulao + raita' },
      { day: 2, morning: 'Tulsi tea', breakfast: 'Upma + coconut chutney', lunch: 'Rajma + rice + onion salad', snack: 'Yogurt + seeds', dinner: 'Roti + mixed veg + curd' },
      { day: 3, morning: 'Warm water + honey', breakfast: 'Oats porridge + fruits', lunch: 'Chole + roti + salad', snack: 'Seasonal fruit', dinner: 'Khichdi + pickle + papad' },
      { day: 4, morning: 'Ginger tea', breakfast: 'Dosa + sambar', lunch: 'Fish curry / paneer + rice + curd', snack: 'Nuts + dates', dinner: 'Soup + roti + sabzi' },
      { day: 5, morning: 'Methi water', breakfast: 'Poha + peanuts', lunch: 'Mixed dal + brown rice + salad', snack: 'Sprouts chaat', dinner: 'Roti + dal makhani (light) + sabzi' },
      { day: 6, morning: 'Amla shot', breakfast: 'Smoothie bowl with berries + seeds', lunch: 'Palak paneer + roti + raita', snack: 'Green tea + roasted chana', dinner: 'Vegetable biryani (light) + curd' },
      { day: 7, morning: 'Warm lemon water', breakfast: 'Idli + tomato chutney + sambar', lunch: 'Satvik thali (all fresh, balanced)', snack: 'Seasonal fruit chaat', dinner: 'Moong dal + jowar roti + salad' }
    ]
  }
};

// ====================================================
// EXERCISES DATABASE
// ====================================================
const EXERCISES_DB: Exercise[] = [
  {
    id: 1,
    name: 'Pranayama -- Anulom Vilom',
    ayurvedicName: 'Nadi Shodhana Pranayama',
    description: 'Alternate nostril breathing that purifies nadis (energy channels), reduces cortisol (a major acne trigger), and improves oxygenation for healthy skin.',
    steps: [
      'Sit comfortably with spine erect (Sukhasana or chair)',
      'Close right nostril with right thumb. Inhale slowly through left nostril for 4 counts.',
      'Close both nostrils. Hold breath for 8 counts.',
      'Release right nostril. Exhale through right nostril for 8 counts.',
      'Inhale through right nostril for 4 counts.',
      'Close both. Hold for 8 counts.',
      'Exhale through left nostril for 8 counts.',
      'This completes ONE cycle. Repeat.'
    ],
    durationSeconds: 600,
    repetitions: 10,
    benefits: [
      'Reduces cortisol -- directly linked to acne and breakouts',
      'Improves blood circulation to skin',
      'Balances Vata and Pitta doshas',
      'Reduces stress-induced skin inflammation'
    ],
    suitableFor: ['acne', 'pigmentation', 'tanning', 'normal']
  },
  {
    id: 2,
    name: 'Face Yoga -- Lion Pose (Simhasana)',
    ayurvedicName: 'Simhasana Mudra',
    description: 'Energizing facial exercise that increases blood flow to face, tones facial muscles, and stimulates lymphatic drainage to reduce puffiness and dullness.',
    steps: [
      'Sit with knees bent and hands on knees.',
      'Inhale deeply through the nose.',
      'Open your mouth wide, stick tongue out toward chin.',
      'Exhale forcefully making "haaa" sound.',
      'Open eyes wide, look up at forehead (Shambhavi mudra).',
      'Hold for 5 seconds at maximum expression.',
      'Relax and breathe normally. Repeat.'
    ],
    durationSeconds: 30,
    repetitions: 8,
    benefits: [
      'Stimulates collagen production',
      'Drains lymph nodes, reducing puffiness',
      'Tones jawline and cheek muscles',
      'Increases blood circulation and natural glow'
    ],
    suitableFor: ['acne', 'pigmentation', 'tanning', 'normal']
  },
  {
    id: 3,
    name: 'Kapalbhati Pranayama',
    ayurvedicName: 'Kapal Bhati (Skull Shining Breath)',
    description: 'Rapid abdominal breathing technique that detoxifies the body from inside, supports liver function, and leads to natural skin brightening.',
    steps: [
      'Sit comfortably with straight spine.',
      'Take a deep inhale through both nostrils.',
      'Exhale sharply and forcefully through nose, pulling navel toward spine.',
      'Allow passive inhalation (stomach comes out naturally).',
      'Focus: exhale is ACTIVE, inhale is PASSIVE.',
      'Start slow (60 cycles/minute), build to 120/min over weeks.'
    ],
    durationSeconds: 300,
    repetitions: 3,
    benefits: [
      'Detoxifies blood -- reduces acne and pigmentation triggers',
      'Strengthens abdominal organs including liver and kidneys',
      'Increases metabolic rate',
      'Traditional text says it brings radiance (kapal = skull/face, bhati = shine)'
    ],
    suitableFor: ['acne', 'pigmentation', 'tanning', 'normal']
  },
  {
    id: 4,
    name: 'Cheek Lift & Forehead Smoother',
    ayurvedicName: 'Mukha Abhyanga Vyayama',
    description: 'Targeted facial muscle toning exercise that lifts cheeks, smoothens forehead lines, and improves lymphatic drainage for even skin tone.',
    steps: [
      'Smile wide with closed lips -- feel tension in cheeks.',
      'Wrinkle your nose and push cheeks upward. Hold 5 seconds.',
      'Alternate between wide smile and cheek lift 10 times.',
      'Place 3 fingers of each hand on forehead horizontally.',
      'Pull fingers apart (toward temples) while trying to wrinkle forehead. Hold 5 sec.',
      'Repeat forehead stretch 10 times.',
      'Finish with gentle tapping with fingertips from chin to forehead (lymphatic stimulation).'
    ],
    durationSeconds: 180,
    repetitions: 10,
    benefits: [
      'Natural facelift effect -- tones sagging areas',
      'Stimulates microcirculation for brighter complexion',
      'Reduces pigmentation by increasing local blood flow',
      'Non-invasive way to achieve toned, youthful appearance'
    ],
    suitableFor: ['pigmentation', 'tanning', 'normal']
  },
  {
    id: 5,
    name: 'Neck Roll & Jaw Release',
    ayurvedicName: 'Griva Sanchalana',
    description: 'Neck rotation that drains lymph nodes under the jaw, reducing water retention and improving skin circulation in the face.',
    steps: [
      'Sit with spine straight. Relax shoulders completely.',
      'Drop right ear toward right shoulder. Hold 3 seconds.',
      'Slowly roll chin to chest.',
      'Drop left ear to left shoulder. Hold 3 seconds.',
      'Come back to center. This is one complete roll.',
      'Reverse direction.',
      'After 5 rolls each direction, do jaw circles: open wide, shift jaw left, close, shift right, repeat 5 times.'
    ],
    durationSeconds: 120,
    repetitions: 5,
    benefits: [
      'Drains cervical lymph nodes -- reduces face puffiness',
      'Releases tension in neck muscles that restricts blood to scalp and face',
      'Helps de-tan neck and jawline area by improving circulation'
    ],
    suitableFor: ['tanning', 'pigmentation', 'normal']
  },
  {
    id: 6,
    name: 'Eye Palming & Trataka (Candle Gazing)',
    ayurvedicName: 'Trataka Dharana',
    description: 'Yogic eye exercise that reduces periorbital pigmentation (dark circles), strengthens eye muscles, and calms the nervous system.',
    steps: [
      'Rub palms together briskly for 20 seconds until warm.',
      'Cup warm palms over closed eyes without pressure. Hold for 1 minute.',
      'For Trataka: Place a candle at eye level 2 feet away.',
      'Gaze at the flame without blinking for as long as possible.',
      'When eyes water or feel strain, close them. Visualize the flame internally.',
      'Repeat 3 cycles of gazing.'
    ],
    durationSeconds: 240,
    repetitions: 3,
    benefits: [
      'Palm warmth stimulates blood flow around eyes -- reduces dark circles',
      'Strengthens eye muscles and reduces digital eye strain',
      'Calms sympathetic nervous system -- reduces stress-induced skin reactions',
      'Traditional yogic technique for mind-skin connection'
    ],
    suitableFor: ['pigmentation', 'acne', 'normal']
  }
];

// ====================================================
// LIFESTYLE TIPS (by condition)
// ====================================================
const LIFESTYLE_TIPS: Record<SkinCondition, string[]> = {
  acne: [
    'Change pillowcases every 2-3 days -- bacteria from hair and sweat transfer to face',
    'Never sleep with makeup on -- always cleanse before bed',
    'Manage stress with 20-min meditation daily -- cortisol directly worsens acne',
    'Use non-comedogenic (oil-free) products -- check labels before buying',
    'Keep hair off face -- hair products and oils clog pores',
    'Wash gym/sports equipment that contacts face',
    'Sleep 7-8 hours -- skin repairs during sleep; lack of sleep spikes cortisol',
    'Use a clean soft towel for face only -- separate from body towel'
  ],
  pigmentation: [
    'Wear SPF 30+ every single day -- even indoors (UV passes through glass)',
    'Reapply sunscreen every 2 hours when outdoors -- most people skip this',
    'Wear a wide-brim hat between 11am-4pm',
    'Vitamin C serum in the morning + retinol at night is the clinical gold standard',
    'Avoid picking at any dark spots -- trauma worsens post-inflammatory hyperpigmentation',
    'Hormonal pigmentation (melasma) may require dermatologist consultation',
    'Keep track of which foods worsen your spots -- food diary helps identify triggers'
  ],
  tanning: [
    'Apply aloe vera gel (chilled from fridge) immediately after sun exposure',
    'Cold milk compress on tanned areas right after sun exposure -- lactic acid begins tan reversal',
    'Avoid hot water showers after sun exposure -- use cool water only',
    'De-tan at least twice a week if working outdoors regularly',
    'Internal cooling: eat one cooling fruit daily (watermelon, cucumber, musk melon)',
    'Outdoor workers: apply sunscreen 30 min before stepping out, not when going out',
    'Coconut oil is NOT a sunscreen -- it offers SPF 4, not sufficient protection'
  ],
  normal: [
    'Maintain your current routine -- consistency is key for normal skin',
    'Introduce one new product at a time so you can identify any reaction',
    'Practice Abhyanga (Ayurvedic self-massage) weekly with sesame or coconut oil',
    'Do a monthly face mask to maintain clarity and brightness',
    'Season-adjust your routine: lighter products in summer, richer in winter',
    'Regular exercise keeps skin oxygenated and healthy'
  ]
};

const AVOID_PRACTICES: Record<SkinCondition, string[]> = {
  acne: [
    'Over-washing face (more than twice a day strips protective oils, causing rebound oil production)',
    'Popping or squeezing pimples -- spreads bacteria, causes deeper infection and scars',
    'Scrubbing aggressively with harsh scrubs during active breakout',
    'Using heavy moisturizers or face oils with mineral oil or petroleum',
    'Taking unguided antibiotics for acne -- leads to resistance'
  ],
  pigmentation: [
    'Skipping sunscreen -- single most harmful thing for pigmentation',
    'Aggressive peeling treatments at home without patch testing',
    'Using bleaching products with mercury (check ingredient labels)',
    'Steroid creams without prescription -- initial lightening followed by severe rebound'
  ],
  tanning: [
    'Using lemon juice directly on skin without dilution -- can cause chemical burn especially with sun exposure',
    'Using skin lightening bleaches that contain harmful chemicals',
    'Skipping moisturizer after tan removal treatments -- skin becomes dry and patchwork forms',
    'Tanning beds -- cause skin cancer risk alongside worsening tanning'
  ],
  normal: [
    'Trying too many new products at once',
    'Over-exfoliating -- twice a week is maximum for most skin types',
    'Using hot water for face washing -- warm or cool water only'
  ]
};

// ====================================================
// MAIN RECOMMENDATION FUNCTION
// ====================================================
export function generateRecommendations(condition: SkinCondition): FullRecommendation {
  const conditionKey = condition.toLowerCase() as SkinCondition;
  const validConditions: SkinCondition[] = ['acne', 'pigmentation', 'tanning', 'normal'];
  const resolvedCondition: SkinCondition = validConditions.includes(conditionKey) ? conditionKey : 'normal';

  const remedies = REMEDIES_DB[resolvedCondition];
  const dietPlan = DIET_PLANS_DB[resolvedCondition];
  const exercises = EXERCISES_DB.filter(ex => ex.suitableFor.includes(resolvedCondition));
  const lifestyleTips = LIFESTYLE_TIPS[resolvedCondition];
  const avoidPractices = AVOID_PRACTICES[resolvedCondition];

  // First 2 remedies are for topical, last are homemade packs
  const topicalRemedies = remedies.slice(0, 2);
  const homemadePacks = remedies.slice(2);

  const explainedLogic = buildExplainedLogic(resolvedCondition);

  return {
    condition: resolvedCondition,
    remedies: topicalRemedies,
    dietPlan,
    exercises,
    homemadePacks,
    lifestyleTips,
    avoidPractices,
    explainedLogic
  };
}

function buildExplainedLogic(condition: SkinCondition): string {
  const explanations: Record<SkinCondition, string> = {
    acne: `Recommendations for ACNE are based on the following evidence-based logic:
1. REMEDIES: Neem + turmeric target the root cause (Propionibacterium acnes bacteria). Multani mitti addresses excess sebum. Tea tree oil is clinically proven antibacterial.
2. DIET: Eliminating high-glycemic foods reduces insulin spike -> less sebum -> fewer breakouts. Zinc supplementation from food has Level A clinical evidence for acne.
3. EXERCISES: Pranayama reduces cortisol (stress hormone that directly triggers acne). Kapalbhati detoxifies blood.
4. LOGIC SOURCE: Peer-reviewed studies on diet-acne relationship, traditional Ayurvedic texts (Ashtanga Hridayam), and modern dermatological guidelines.`,

    pigmentation: `Recommendations for PIGMENTATION are based on the following evidence-based logic:
1. REMEDIES: Saffron (crocin), Vitamin C (lemon, amla), and kojic acid precursors all inhibit tyrosinase -- the enzyme that produces melanin.
2. DIET: Vitamin C + E synergy is clinically proven to reduce melanin overproduction. Lycopene (tomatoes) provides internal UV protection.
3. EXERCISES: Face yoga improves microcirculation -- better blood flow prevents melanin clustering.
4. LOGIC SOURCE: Dermatology literature on tyrosinase inhibitors, Charaka Samhita on kumkumadi formulations, and Ayurvedic Panchakarma principles.`,

    tanning: `Recommendations for TANNING are based on the following evidence-based logic:
1. REMEDIES: Sandalwood's alpha-santalol, potato's catecholase, and yogurt's lactic acid all work on melanin dissolution via different mechanisms.
2. DIET: Cooling foods reduce Pitta (heat) accumulation that worsens UV-induced melanogenesis. Lycopene provides biological UV protection.
3. EXERCISES: Kapalbhati and Anulom Vilom improve overall circulation -- accelerating removal of excess melanin deposits.
4. LOGIC SOURCE: Ayurvedic Pitta-pacifying protocols from Sushruta Samhita, evidence on topical exfoliants for tan removal.`,

    normal: `Recommendations for NORMAL SKIN are based on the following logic:
1. REMEDIES: Maintenance-focused -- gentle cleansing and protective oils maintain the existing healthy barrier without disrupting it.
2. DIET: Balanced, seasonal eating (Ritucharya) ensures continuous antioxidant supply and micronutrient diversity.
3. EXERCISES: All exercises appropriate -- focus on general skin health maintenance.
4. LOGIC SOURCE: Preventive Ayurvedic principles (Swasthavritta) and modern evidence on lifestyle factors for sustained skin health.`
  };

  return explanations[condition] || explanations.normal;
}

export { REMEDIES_DB, DIET_PLANS_DB, EXERCISES_DB };
