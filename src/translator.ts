import { SarvamAIClient } from 'sarvamai';
import OpenAI from 'openai';
import { DealPayload, EnglishGeneration, FullGeneration, LocalizedVariant, ChannelVariantSchema } from './types.js';

export class TranslatorService {
  private openai: OpenAI;
  private sarvam: SarvamAIClient;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.sarvam = new SarvamAIClient({
      apiSubscriptionKey: process.env.SARVAM_API_KEY || ''
    });
  }

  /**
   * Step 1: OpenAI generates ORIGINAL marketing copy in the target language
   * directly from deal parameters. NOT translation — independent creative generation.
   */
  private async generateRegionalCopy(
    deal: DealPayload,
    targetLang: 'hi-IN' | 'te-IN'
  ): Promise<{ urgency: LocalizedVariant; value: LocalizedVariant; socialProof: LocalizedVariant }> {

    const langConfig = {
      'hi-IN': {
        name: 'Hindi',
        prompt: `You are "Raju" — the most viral marketing copywriter in India. You grew up in Delhi, binge Bollywood, and your WhatsApp group has 200 active friends. Your copy goes viral because people forward it thinking a friend wrote it.

WRITE ORIGINAL MARKETING COPY IN HINDI/HINGLISH for the deal below. You are NOT translating English — you are CREATING new copy as if English doesn't exist.

SCRIPT RULE (VERY IMPORTANT):
- ALL Hindi words MUST be in Devanagari script (देवनागरी): "यार", "भाई", "झपट ले", "मस्त", "पक्का"
- English words like brand names, "deal", "offer", "order", "save", "trip" stay in Roman/English script
- Example of CORRECT format: "यार, Zomato पर ₹100 का deal है — झपट ले! 🔥"
- Example of WRONG format: "Yaar, Zomato pe ₹100 ka deal hai — jhapat le!" (NO Roman Hindi!)

YOUR STYLE:
- Hinglish in Devanagari — the way Delhi/Mumbai youth type on WhatsApp
- Reference Bollywood dialogues: "रिश्ते में तो हम तुम्हारे बाप लगते हैं" energy, "पिक्चर अभी बाकी है" vibes
- Use trending slang: "फुल पैसा वसूल", "मस्त deal है यार", "सही वाला offer", "एक नंबर", "पक्का वाला"
- Write like you're telling your best friend about a deal you found
- Short, punchy mix — "₹100 बच गए तो biryani का plan बना! 🍗"
- Reference relatable Indian life: "salary आते ही उड़ाने वाले लोग", "month-end budget fix", "मम्मी को बोल देना savings हो गई"

ABSOLUTELY DO NOT:
- Write Hindi in Roman script (no "Yaar", "bhai", "jhapat")
- Translate from English
- Use formal Hindi (न्यूनतम, उपलब्ध, प्राप्त करें, रिडेम्पशन, समाप्त)
- Write like a corporate email
- Use "आप" — only "तू/तुम"

DEAL DETAILS:
- Brand: ${deal.merchant_id} (${deal.category})
- Offer: ${deal.discount_value} ${deal.discount_type} off
- Min Order: ₹${deal.min_order_value}
- Only ${deal.max_redemptions} people can use this (after that it's gone!)
- Expires: ${deal.expiry_timestamp}
- ${deal.exclusive_flag ? 'EXCLUSIVE — only on GrabOn, nowhere else!' : 'Available across platforms'}

Generate 3 variants (urgency / value / socialProof) × 6 channels = 18 pieces of ORIGINAL Hindi/Hinglish copy in DEVANAGARI script.

CHANNEL GUIDELINES (respect character limits):
1. EMAIL: subjectLine (≤60 chars) + headline (≤80 chars) + cta (≤30 chars)
2. WHATSAPP (≤160 chars) — exactly like texting a friend
3. PUSH: title (≤50 chars) + body (≤100 chars) — 2 seconds to hook
4. GLANCE (≤160 chars) — locked phone, no context
5. PAYU (≤40 chars) — user at checkout
6. INSTAGRAM (≤400 chars) — Gen-Z Hinglish aesthetic in Devanagari`
      },
      'te-IN': {
        name: 'Telugu',
        prompt: `You are "Ravi" — Hyderabad's top viral content creator. You make marketing feel like a friend's WhatsApp forward. You grew up watching Chiranjeevi, Prabhas, and Allu Arjun movies, and your Telugu has natural Hyderabadi swagger.

WRITE ORIGINAL MARKETING COPY IN TELUGU for the deal below. You are NOT translating English — you are CREATING new copy as if English doesn't exist.

YOUR STYLE:
- Natural Hyderabadi Telugu — how friends in Jubilee Hills or Ameerpet text each other
- Reference Telugu cinema when it fits: "Pushpa" style తగ్గేదేలే energy, "Baahubali" level offers, "Mind Block" deals
- Use local expressions: "ఒరేయ్ ఏంట్రా ఇది", "అమ్మో ఏం offer రా", "దీని ముందు అన్ని దండగ", "ఏం చెప్తావ్ బ్రో", "నీ ఇష్టం లే కానీ miss అయితే ఏడ్వకు"
- Write like you're excited about a deal and sharing it with your gang
- Mix Telugu and English freely: "₹100 save అవుతుంది అంటే biryani treat ఇచ్చెయ్! 🍗"
- Reference Hyderabadi life: "Irani chai budget లో", "Paradise biryani treat", "weekend plans sorted"

ABSOLUTELY DO NOT:
- Translate from English
- Use formal/literary Telugu (దయచేసి, తగ్గింపును పొందండి, అందుబాటులో, మీ తదుపరి)
- Write like a government notice
- Use overly respectful forms — keep it casual "నువ్వు/నీ"

DEAL DETAILS:
- Brand: ${deal.merchant_id} (${deal.category})
- Offer: ${deal.discount_value} ${deal.discount_type} off
- Min Order: ₹${deal.min_order_value}
- Only ${deal.max_redemptions} people can use this (after that it's gone!)
- Expires: ${deal.expiry_timestamp}
- ${deal.exclusive_flag ? 'EXCLUSIVE — only on GrabOn, nowhere else!' : 'Available across platforms'}

Generate 3 variants (urgency / value / socialProof) × 6 channels = 18 pieces of ORIGINAL Telugu copy.

CHANNEL GUIDELINES (respect character limits):
1. EMAIL: subjectLine (≤60 chars) + headline (≤80 chars) + cta (≤30 chars)
2. WHATSAPP (≤160 chars) — exactly like texting a friend
3. PUSH: title (≤50 chars) + body (≤100 chars) — 2 seconds to hook
4. GLANCE (≤160 chars) — locked phone, no context
5. PAYU (≤40 chars) — user at checkout
6. INSTAGRAM (≤400 chars) — trendy Telugu aesthetic`
      }
    };

    const config = langConfig[targetLang];

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: config.prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'regional_copy',
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
      temperature: 0.9,
    });

    const rawText = completion.choices[0]?.message?.content;
    if (!rawText) throw new Error(`Empty OpenAI response for ${targetLang}`);

    const parsed = JSON.parse(rawText);
    return {
      urgency: ChannelVariantSchema.parse(parsed.urgency),
      value: ChannelVariantSchema.parse(parsed.value),
      socialProof: ChannelVariantSchema.parse(parsed.socialProof),
    };
  }

  /**
   * Step 2: Sarvam-M refines each generated string for natural Indic language quality.
   * Acts as a "native language editor" — fixes grammar, script accuracy, and ensures
   * the text reads like a native speaker wrote it.
   */
  private async refineWithSarvam(text: string, langCode: string): Promise<string> {
    const langName = langCode === 'hi-IN' ? 'Hindi' : 'Telugu';
    try {
      const response = await this.sarvam.chat.completions({
        messages: [
          {
            role: 'assistant',
            content: `You are a ${langName} language expert and proofreader. Your ONLY job is to refine this marketing copy so it sounds perfectly natural in ${langName}. Fix any grammar issues, ensure the script is accurate, and make it read like a native ${langName} speaker wrote it. Keep the same meaning, emotional tone, slang, emojis, and brand names. Keep English words that are commonly mixed in ${langName} (deal, offer, order, save). Return ONLY the refined text.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.3,
        max_tokens: 300,
      });

      const result = response.choices?.[0]?.message?.content;
      if (typeof result === 'string' && result.trim().length > 0) {
        let cleaned = result.trim();
        // Strip wrapping quotes if model adds them
        if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
            (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
          cleaned = cleaned.slice(1, -1).trim();
        }
        return cleaned;
      }
      return text; // If Sarvam returns empty, keep OpenAI's version
    } catch (error) {
      console.error(`[Sarvam-M] Refinement failed for ${langName}, keeping OpenAI version`);
      return text; // Graceful fallback — never break the pipeline
    }
  }

  /**
   * Refines all 9 strings in a single variant through Sarvam-M concurrently.
   */
  private async refineVariant(variant: LocalizedVariant, langCode: string): Promise<LocalizedVariant> {
    const [subLine, head, cta, wa, pTitle, pBody, glnc, pu, ig] = await Promise.all([
      this.refineWithSarvam(variant.email.subjectLine, langCode),
      this.refineWithSarvam(variant.email.headline, langCode),
      this.refineWithSarvam(variant.email.cta, langCode),
      this.refineWithSarvam(variant.whatsApp, langCode),
      this.refineWithSarvam(variant.push.title, langCode),
      this.refineWithSarvam(variant.push.body, langCode),
      this.refineWithSarvam(variant.glance, langCode),
      this.refineWithSarvam(variant.payU, langCode),
      this.refineWithSarvam(variant.instagram, langCode),
    ]);

    return {
      email: { subjectLine: subLine, headline: head, cta },
      whatsApp: wa,
      push: { title: pTitle, body: pBody },
      glance: glnc,
      payU: pu,
      instagram: ig,
    };
  }

  /**
   * Full pipeline:
   *   1. OpenAI generates ORIGINAL Hindi & Telugu copy from deal params (creative direction)
   *   2. Sarvam-M refines each string for native Indic quality (language polish)
   *
   * OpenAI = the ad agency creative director
   * Sarvam-M = the native language editor who makes it sound perfectly local
   */
  public async generateFullPayload(englishGen: EnglishGeneration, deal: DealPayload): Promise<FullGeneration> {
    // Step 1: Generate ORIGINAL creative copy
    console.error('[Pipeline] Step 1/2: Generating original Hindi & Telugu copy via OpenAI...');
    const [hindiRaw, teluguRaw] = await Promise.all([
      this.generateRegionalCopy(deal, 'hi-IN'),
      this.generateRegionalCopy(deal, 'te-IN'),
    ]);

    // Step 2: Refine with Sarvam-M for native language polish
    console.error('[Pipeline] Step 2/2: Refining with Sarvam-M for native language polish...');
    const [hiUrgency, hiValue, hiSocial, teUrgency, teValue, teSocial] = await Promise.all([
      this.refineVariant(hindiRaw.urgency, 'hi-IN'),
      this.refineVariant(hindiRaw.value, 'hi-IN'),
      this.refineVariant(hindiRaw.socialProof, 'hi-IN'),
      this.refineVariant(teluguRaw.urgency, 'te-IN'),
      this.refineVariant(teluguRaw.value, 'te-IN'),
      this.refineVariant(teluguRaw.socialProof, 'te-IN'),
    ]);

    console.error('[Pipeline] ✅ All 54 variants generated and refined');

    return {
      en: englishGen,
      hi: { urgency: hiUrgency, value: hiValue, socialProof: hiSocial },
      te: { urgency: teUrgency, value: teValue, socialProof: teSocial },
    };
  }
}
