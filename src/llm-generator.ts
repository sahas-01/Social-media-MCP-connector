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
    const prompt = `You are an expert marketing copywriter for GrabOn.
Your task is to generate 18 unique, highly-optimized English copy templates for a merchant deal.
You must return a JSON object with 3 meaningly different A/B variants (urgency, value, socialProof) for the following 6 channels.

CONSTRAINTS PER CHANNEL:
1. Email snippet: Must be HTML format. Needs a subject line, a body headline, and a CTA snippet.
2. WhatsApp message: Maximum 160 characters.
3. Push notification: Maximum 50 characters for the title, and maximum 100 characters for the body.
4. Glance lock screen card: Maximum 160 characters. It MUST work without giving any previous context because it is shown directly on the lock screen.
5. PayU checkout banner: Maximum 40 characters. Must be action-oriented.
6. Instagram caption: Minimal and simplistic, ending with relevant hashtags.

VARIANT CONSTRAINTS:
The 3 variants (urgency vs value vs socialProof) MUST be semantically and meaningfully different from each other. Do not just use synonyms or swap words—they should convey the same underlying deal but use entirely different psychological framing to make the user want to check the deal out and be extremely catchy.

DEAL DETAILS:
Merchant ID: ${deal.merchant_id}
Category: ${deal.category}
Discount Value: ${deal.discount_value}
Discount Type: ${deal.discount_type}
Expiry: ${deal.expiry_timestamp}
Min Order Value: ${deal.min_order_value}
Max Redemptions: ${deal.max_redemptions}
Exclusive: ${deal.exclusive_flag}

You MUST return valid JSON matching this exact structure:
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
}

Return ONLY the JSON object, no markdown, no code fences.`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const rawText = completion.choices[0]?.message?.content;
    if (!rawText) {
      throw new Error('Empty response from OpenAI');
    }

    const parsed = JSON.parse(rawText);
    const validated = EnglishGenerationSchema.parse(parsed);
    return validated;
  }
}
