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

4. GLANCE LOCK SCREEN (≤160 chars, MUST work without context)
   - Glance is an AI-powered shopping agent that shows content on LOCKED phone screens.
   - The user has ZERO context — no app is open, they just glanced at their phone.
   - Must be FULLY self-explanatory: include brand name, offer amount, and a hook in one line.
   - Feel like a curated recommendation from a smart shopping assistant, not a generic ad.
   - BAD: "Great deals available!" → GOOD: "₹200 off your next Zomato order — only 47 people have claimed this so far"

5. PAYU CHECKOUT BANNER (≤40 chars)
   - PayU is India's leading payment gateway (5 lakh+ businesses). The user sees this at the CHECKOUT page while paying.
   - They're already committed to buying — this banner appears in the PayU Offer Engine alongside EMI/BNPL options.
   - Pure instant savings. Show the exact amount they save RIGHT NOW. No explanation needed, just the number.
   - BAD: "Save on your order" → GOOD: "Apply & save ₹200 instantly →"

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

═══ TONE GUIDELINES ═══

The copy must be PUNCHY and HIGH-CONVERTING but NEVER irritating, spammy, or desperate.

DO:
- Create genuine curiosity — make users WANT to check the deal, not feel pressured
- Use a confident, insider tone — like you're letting them in on something good
- Lead with value, not noise. Show them what they gain, not what they lose
- Be concise and sharp. Every word must earn its place
- Use subtle FOMO — "only 2 left" is powerful; "BUY NOW OR MISS OUT FOREVER!!!" is spam
- Make the user feel smart for finding this deal, not manipulated into clicking

DON'T:
- Use ALL CAPS excessively or multiple exclamation marks (!!!)
- Sound like a desperate salesperson. No "HURRY HURRY!" or "LAST CHANCE EVER!"
- Use clickbait that doesn't deliver. If the deal is ₹100 off, don't say "UNBELIEVABLE SAVINGS"
- Be generic. "Great deals await!" means nothing. Be specific: "₹100 off your next Zomato order"

The best copy feels like a helpful heads-up from a friend, not an ad screaming at you.

═══ LOCALIZATION NOTE ═══

These English outputs will be localized into Hindi and Telugu using a chat-based AI model:
- Use concrete numbers and emojis (₹200, 🔥, ⏰) — these carry over perfectly across languages.
- Avoid English-only puns, wordplay, or idioms that lose meaning in other languages.
- Keep sentence structures simple and direct — the localizer works best with clear, punchy inputs.

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
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'deal_variants',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              urgency: { $ref: '#/$defs/variant' },
              value: { $ref: '#/$defs/variant' },
              socialProof: { $ref: '#/$defs/variant' },
            },
            required: ['urgency', 'value', 'socialProof'],
            additionalProperties: false,
            $defs: {
              variant: {
                type: 'object',
                properties: {
                  email: {
                    type: 'object',
                    properties: {
                      subjectLine: { type: 'string' },
                      headline: { type: 'string' },
                      cta: { type: 'string' },
                    },
                    required: ['subjectLine', 'headline', 'cta'],
                    additionalProperties: false,
                  },
                  whatsApp: { type: 'string' },
                  push: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      body: { type: 'string' },
                    },
                    required: ['title', 'body'],
                    additionalProperties: false,
                  },
                  glance: { type: 'string' },
                  payU: { type: 'string' },
                  instagram: { type: 'string' },
                },
                required: ['email', 'whatsApp', 'push', 'glance', 'payU', 'instagram'],
                additionalProperties: false,
              },
            },
          },
        },
      },
      temperature: 0.7,
    });

    const rawText = completion.choices[0]?.message?.content;
    if (!rawText) {
      throw new Error('Empty response from OpenAI');
    }

    // Structured Outputs guarantees the JSON matches our schema exactly —
    // no normalization needed, keys are always correct.
    const parsed = JSON.parse(rawText);
    const validated = EnglishGenerationSchema.parse(parsed);
    return validated;
  }
}
