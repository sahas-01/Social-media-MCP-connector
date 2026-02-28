import { SarvamAIClient } from 'sarvamai';
import { EnglishGeneration, FullGeneration, LocalizedVariant } from './types.js';

export class TranslatorService {
  private client: SarvamAIClient;

  constructor() {
    this.client = new SarvamAIClient({
      apiSubscriptionKey: process.env.SARVAM_API_KEY || ''
    });
  }

  private async translateText(text: string, targetLang: string): Promise<string> {
    try {
      const response = await this.client.text.translate({
        input: text,
        source_language_code: "en-IN",
        target_language_code: targetLang as "hi-IN" | "te-IN",
        model: "sarvam-translate:v1",
        numerals_format: "international"
      });

      // Sarvam SDK may return { content: "...", description: "...", ... } or { translated_text: "..." }
      const result = response as unknown as Record<string, unknown>;
      const translatedText = (result.content ?? result.translated_text) as string | undefined;
      
      if (typeof translatedText === 'string' && translatedText.trim().length > 0) {
        return translatedText.trim();
      }
      
      return text;
    } catch (error) {
      console.error(`Translation failed for ${targetLang}:`, error);
      return text;
    }
  }

  private async translateVariant(variant: LocalizedVariant, targetLang: string): Promise<LocalizedVariant> {
    const [subLine, head, cta, wa, pTitle, pBody, glnc, pu, ig] = await Promise.all([
      this.translateText(variant.email.subjectLine, targetLang),
      this.translateText(variant.email.headline, targetLang),
      this.translateText(variant.email.cta, targetLang),
      this.translateText(variant.whatsApp, targetLang),
      this.translateText(variant.push.title, targetLang),
      this.translateText(variant.push.body, targetLang),
      this.translateText(variant.glance, targetLang),
      this.translateText(variant.payU, targetLang),
      this.translateText(variant.instagram, targetLang),
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

  public async generateFullPayload(englishGen: EnglishGeneration): Promise<FullGeneration> {
    const [hiUrgency, hiValue, hiSocialProof, teUrgency, teValue, teSocialProof] = await Promise.all([
      this.translateVariant(englishGen.urgency, 'hi-IN'),
      this.translateVariant(englishGen.value, 'hi-IN'),
      this.translateVariant(englishGen.socialProof, 'hi-IN'),
      this.translateVariant(englishGen.urgency, 'te-IN'),
      this.translateVariant(englishGen.value, 'te-IN'),
      this.translateVariant(englishGen.socialProof, 'te-IN'),
    ]);

    return {
      en: englishGen,
      hi: { urgency: hiUrgency, value: hiValue, socialProof: hiSocialProof },
      te: { urgency: teUrgency, value: teValue, socialProof: teSocialProof },
    };
  }
}
