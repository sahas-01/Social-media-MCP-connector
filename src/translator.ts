import { SarvamAIClient } from 'sarvamai';
import { EnglishGeneration, FullGeneration, LocalizedVariant } from './types.js';

interface SarvamChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

const LANG_NAMES: Record<string, string> = {
  'hi-IN': 'Hindi',
  'te-IN': 'Telugu',
};

const LANG_IDIOM_GUIDANCE: Record<string, string> = {
  'hi-IN': 'Use colloquial Hindi idioms and culturally resonant phrases. Avoid stiff, formal Hindi. Use language that urban and semi-urban North Indian audiences relate to — conversational and punchy.',
  'te-IN': 'Use culturally resonant Telugu idioms that a Telangana or Andhra Pradesh audience would recognize instantly. Avoid literal translations. Use catchy, expressive phrases from Telugu pop culture or daily speech.',
};

export class TranslatorService {
  private client: SarvamAIClient;

  constructor() {
    this.client = new SarvamAIClient({
      apiSubscriptionKey: process.env.SARVAM_API_KEY || ''
    });
  }

  private async localizeText(
    englishText: string,
    targetLang: string,
    channelContext: string,
    charLimit?: number
  ): Promise<string> {
    const langName = LANG_NAMES[targetLang] ?? targetLang;
    const idiomGuidance = LANG_IDIOM_GUIDANCE[targetLang] ?? '';
    const charConstraint = charLimit
      ? `The output MUST be under ${charLimit} characters.`
      : '';
    const systemPrompt = `You are an expert Indian marketing copywriter fluent in ${langName}. ${idiomGuidance}`;
    const userPrompt = `This is an English marketing copy snippet for a ${channelContext}:
"${englishText}"

Rewrite this as a culturally idiomatic, catchy ${langName} version. Do NOT translate it word-for-word. Instead, adapt it — use local idioms, common expressions, and appeal to emotions in a way that would resonate with a ${langName}-speaking audience in India and make them want to check out the deal.
${charConstraint}
Return ONLY the ${langName} text, nothing else.`;

    try {
      const response = await this.client.chat.completions({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 200,
      }) as unknown as SarvamChatResponse;

      const rawText: string = response?.choices?.[0]?.message?.content ?? englishText;
      return rawText.trim();
    } catch (error) {
      console.error(`Sarvam-M localization failed for ${langName}:`, error);
      return englishText; // fallback to English
    }
  }

  private async localizeVariant(variant: LocalizedVariant, targetLang: string): Promise<LocalizedVariant> {
    const loc = (text: string, ctx: string, limit?: number) =>
      this.localizeText(text, targetLang, ctx, limit);

    // Build queue of thunks with concurrency of 3 to avoid rate-limiting
    const queue: (() => Promise<string>)[] = [
      () => loc(variant.email.subjectLine, 'email subject line', 60),
      () => loc(variant.email.headline, 'email body headline', 80),
      () => loc(variant.email.cta, 'email call-to-action button', 30),
      () => loc(variant.whatsApp, 'WhatsApp message', 160),
      () => loc(variant.push.title, 'push notification title', 50),
      () => loc(variant.push.body, 'push notification body', 100),
      () => loc(variant.glance, 'Glance lock screen card (no context available, standalone message)', 160),
      () => loc(variant.payU, 'PayU checkout banner (action-oriented)', 40),
      () => loc(variant.instagram, 'Instagram caption with hashtags'),
    ];

    const results: string[] = [];
    while (queue.length > 0) {
      const batch = queue.splice(0, 3).map(fn => fn());
      results.push(...await Promise.all(batch));
    }

    const [subLine, head, cta, wa, pTitle, pBody, glnc, pu, ig] =
      results as [string, string, string, string, string, string, string, string, string];

    return {
      email: { subjectLine: subLine, headline: head, cta },
      whatsApp: wa,
      push: { title: pTitle, body: pBody },
      glance: glnc,
      payU: pu,
      instagram: ig,
    };
  }

  public async generateFullPayload(englishGen: EnglishGeneration): Promise<FullGeneration> {
    const [hiUrgency, hiValue, hiSocialProof, teUrgency, teValue, teSocialProof] = await Promise.all([
      this.localizeVariant(englishGen.urgency, 'hi-IN'),
      this.localizeVariant(englishGen.value, 'hi-IN'),
      this.localizeVariant(englishGen.socialProof, 'hi-IN'),
      this.localizeVariant(englishGen.urgency, 'te-IN'),
      this.localizeVariant(englishGen.value, 'te-IN'),
      this.localizeVariant(englishGen.socialProof, 'te-IN'),
    ]);

    return {
      en: englishGen,
      hi: { urgency: hiUrgency, value: hiValue, socialProof: hiSocialProof },
      te: { urgency: teUrgency, value: teValue, socialProof: teSocialProof },
    };
  }
}
