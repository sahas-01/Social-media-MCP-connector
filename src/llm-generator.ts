import OpenAI from 'openai';
import { DealPayload, EnglishGeneration, EnglishGenerationSchema } from './types.js';

export class LLMGenerator {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  public async generateEnglishVariants(deal: DealPayload): Promise<EnglishGeneration> {
    const prompt = `You are GrabOn's top-performing conversion copywriter. Your copy has the highest click-through rates in India's coupon industry.

Your job: write 18 pieces of marketing copy that make people STOP scrolling and TAP immediately. Every word must earn its place. If it doesn't create curiosity, urgency, or desire — cut it.

DEAL TO PROMOTE:
- Merchant: ${deal.merchant_id} (Category: ${deal.category})
- Offer: ${deal.discount_value} ${deal.discount_type} off
- Expires: ${deal.expiry_timestamp}
- Min Order: ₹${deal.min_order_value}
- Only ${deal.max_redemptions} redemptions left
- ${deal.exclusive_flag ? '🔒 EXCLUSIVE to GrabOn — not available anywhere else' : 'Available across platforms'}

═══ CHANNEL-SPECIFIC RULES ═══

1. EMAIL (subjectLine ≤60 chars, headline ≤80 chars, cta ≤30 chars)
   - Subject line = the ONLY reason someone opens the email. Use numbers, personalization, or a curiosity gap.
   - Headline = reinforces the subject line's promise. Make the value crystal clear.
   - CTA = a verb-first action phrase. NOT "Click Here" or "Learn More". Use "Grab My Deal", "Unlock ₹X Off", "Claim Before Midnight".
   - BAD: "Check out our latest deals!" → GOOD: "Your ₹200 Zomato credit expires tonight"

2. WHATSAPP (≤160 chars)
   - Write like you're texting a friend about a deal you just found. Casual, excited, personal.
   - Start with an emoji. Use line breaks if needed. End with a nudge.
   - BAD: "Avail 50% discount on Zomato orders" → GOOD: "🍕 Bro, Zomato's doing 50% off rn. ₹200 min order. I already used it twice lol. Expires tonight → grab it"

3. PUSH NOTIFICATION (title ≤50 chars, body ≤100 chars)
   - Title = pattern interrupt. The phone buzzes, the user glances for 2 seconds. You have those 2 seconds.
   - Body = the payoff. One clear reason to open the app NOW.
   - BAD title: "New deal available" → GOOD title: "Your food just got 50% cheaper 🍔"

4. GLANCE LOCK SCREEN (≤160 chars)
   - This appears on a LOCKED phone with ZERO context. The user hasn't opened any app.
   - Must be completely self-explanatory, intriguing, and concise.
   - Write it like a magazine headline that makes someone pick up the magazine.
   - BAD: "Great deals available on GrabOn" → GOOD: "₹200 off your next Zomato order — only 47 people have claimed this so far"

5. PAYU CHECKOUT BANNER (≤40 chars)
   - The user is ALREADY at checkout, about to pay. This is the last-second save.
   - Pure action. Show the savings. Create instant regret if they ignore it.
   - BAD: "Save on your order" → GOOD: "Wait — save ₹200 on this order →"

6. INSTAGRAM CAPTION (≤400 chars)
   - Minimal. Aesthetic. Gen-Z energy. Not corporate.
   - Open with a hook line, then the deal, then 4-6 relevant hashtags.
   - BAD: "Amazing discounts available! #deals #savings" → GOOD: "when zomato says 50% off and you've been waiting for a sign 🪧✨\\n\\nyour sign is here. link in bio.\\n\\n#ZomatoDeals #FoodieLife #GrabOn #DealOfTheDay"

═══ VARIANT PSYCHOLOGY ═══

Generate 3 variants with COMPLETELY different emotional triggers:

• URGENCY: Time pressure, FOMO, scarcity, countdown language. Make them feel they'll lose something.
• VALUE: Rational savings, ROI, "smart shopper" identity. Make them feel clever for using the deal.
• SOCIAL PROOF: Popularity, crowd validation, trending status. Make them feel left out if they don't join.

These must NOT be rephrased versions of each other. They should feel like 3 different writers wrote them.

═══ TRANSLATION NOTE ═══

These English outputs will be machine-translated into Hindi and Telugu. Write copy that translates well:
- Use concrete numbers and emojis (₹200, 🔥, ⏰) — these survive translation perfectly.
- Avoid English-only puns, wordplay, or idioms that lose meaning when translated.
- Keep sentence structures simple and direct — complex clauses break in translation.

═══ HARD CHARACTER LIMITS — DO NOT EXCEED ═══

Count your characters carefully before outputting. If ANY field exceeds its limit, your output is INVALID.

| Field              | Max Characters |
| email.subjectLine  | 60             |
| email.headline     | 80             |
| email.cta          | 30             |
| whatsApp           | 160            |
| push.title         | 50             |
| push.body          | 100            |
| glance             | 160            |
| payU               | 40             |
| instagram          | 400            |

═══ OUTPUT FORMAT ═══

Return ONLY this JSON (no markdown, no code fences). Use EXACTLY these key names (lowercase, camelCase):
{
  "urgency": {
    "email": { "subjectLine": "...", "headline": "...", "cta": "..." },
    "whatsApp": "...",
    "push": { "title": "...", "body": "..." },
    "glance": "...",
    "payU": "...",
    "instagram": "..."
  },
  "value": { ... same structure ... },
  "socialProof": { ... same structure ... }
}`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const rawText = completion.choices[0]?.message?.content;
    if (!rawText) {
      throw new Error('Empty response from OpenAI');
    }

    const parsed = JSON.parse(rawText);

    // GPT-4o-mini sometimes uses different casing (Instagram vs instagram, Payu vs payU)
    // Normalize keys to match our exact Zod schema
    const normalizeVariant = (v: Record<string, unknown>): Record<string, unknown> => {
      const keyMap: Record<string, string> = {
        'instagram': 'instagram', 'Instagram': 'instagram',
        'whatsapp': 'whatsApp', 'WhatsApp': 'whatsApp', 'whatsApp': 'whatsApp', 'Whatsapp': 'whatsApp',
        'payu': 'payU', 'PayU': 'payU', 'payU': 'payU', 'Payu': 'payU', 'payu_banner': 'payU',
        'glance': 'glance', 'Glance': 'glance',
        'email': 'email', 'Email': 'email',
        'push': 'push', 'Push': 'push',
        'socialproof': 'socialProof', 'SocialProof': 'socialProof', 'socialProof': 'socialProof', 'social_proof': 'socialProof',
      };
      const normalized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(v)) {
        normalized[keyMap[key] || key] = value;
      }
      return normalized;
    };

    const normalized = {
      urgency: normalizeVariant((parsed.urgency || parsed.Urgency) as Record<string, unknown>),
      value: normalizeVariant((parsed.value || parsed.Value) as Record<string, unknown>),
      socialProof: normalizeVariant((parsed.socialProof || parsed.SocialProof || parsed.social_proof) as Record<string, unknown>),
    };

    const validated = EnglishGenerationSchema.parse(normalized);
    return validated;
  }
}
