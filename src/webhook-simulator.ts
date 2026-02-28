import { FullGeneration, WebhookResult, LocalizedVariant } from './types.js';

export class WebhookSimulator {
  
  // A simple simulated network call with delay and random failure probability
  private async mockPostRequest(payload: unknown, failureProbability: number = 0.2): Promise<void> {
    const delay = Math.floor(Math.random() * 200) + 50; 
    await new Promise(resolve => setTimeout(resolve, delay));
    
    if (Math.random() < failureProbability) {
      throw new Error("Network timeout or 500 Internal Server Error");
    }
  }

  // Wraps a single POST request with an exponential backoff / retry system
  private async attemptDelivery(
    channelName: string, 
    lang: string, 
    variantName: string, 
    payload: unknown, 
    maxAttempts: number = 3
  ): Promise<WebhookResult> {
    let attempt = 0;
    while (attempt < maxAttempts) {
      attempt++;
      try {
        await this.mockPostRequest(payload);
        return { channel: channelName, language: lang, variant: variantName, status: 'delivered', attempts: attempt };
      } catch (e) {
        if (attempt === maxAttempts) {
          return { channel: channelName, language: lang, variant: variantName, status: 'failed', attempts: attempt };
        }
        // Exponential backoff
        await new Promise(res => setTimeout(res, Math.pow(2, attempt) * 100));
      }
    }
    return { channel: channelName, language: lang, variant: variantName, status: 'failed', attempts: attempt };
  }

  public async distributeAll(fullGen: FullGeneration): Promise<WebhookResult[]> {
    const promises: Promise<WebhookResult>[] = [];
    
    const languages = ['en', 'hi', 'te'] as const;
    const variantNames = ['urgency', 'value', 'socialProof'] as const;
    const channelNames = ['email', 'whatsApp', 'push', 'glance', 'payU', 'instagram'] as const;

    for (const lang of languages) {
      const vars = fullGen[lang];
      for (const variantName of variantNames) {
        const variant: LocalizedVariant = vars[variantName];
        for (const channelName of channelNames) {
          const payload = variant[channelName];
          promises.push(this.attemptDelivery(channelName, lang, variantName, payload));
        }
      }
    }

    return Promise.all(promises);
  }
}
