import { FullGeneration, WebhookResult, LocalizedVariant } from './types.js';

/**
 * Per-channel mock configuration.
 * Each channel has its own failure rate and latency to simulate
 * real-world differences between delivery services.
 * In production, these would be replaced with actual API clients.
 */
const CHANNEL_CONFIG: Record<string, { failureRate: number; avgLatencyMs: number }> = {
  email:     { failureRate: 0.15, avgLatencyMs: 120 },
  whatsApp:  { failureRate: 0.20, avgLatencyMs: 80  },
  push:      { failureRate: 0.10, avgLatencyMs: 60  },
  glance:    { failureRate: 0.15, avgLatencyMs: 100 },
  payU:      { failureRate: 0.25, avgLatencyMs: 150 },
  instagram: { failureRate: 0.10, avgLatencyMs: 90  },
};

export class WebhookSimulator {
  
  /**
   * Simulates a POST to a channel-specific mock endpoint.
   * In production, this would be an actual HTTP call to the channel's API.
   */
  private async mockPostRequest(channel: string, _payload: unknown): Promise<void> {
    const config = CHANNEL_CONFIG[channel] ?? { failureRate: 0.2, avgLatencyMs: 100 };
    
    // Simulate realistic network latency (±50% jitter)
    const jitter = config.avgLatencyMs * (0.5 + Math.random());
    await new Promise(resolve => setTimeout(resolve, jitter));
    
    if (Math.random() < config.failureRate) {
      const errors = [
        'Connection timeout',
        'Service temporarily unavailable',
        'Rate limit exceeded',
        'Internal server error',
      ];
      throw new Error(`[${channel}] ${errors[Math.floor(Math.random() * errors.length)]}`);
    }
  }

  /**
   * Attempts delivery to a single channel with exponential backoff retries.
   */
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
        await this.mockPostRequest(channelName, payload);
        return { channel: channelName, language: lang, variant: variantName, status: 'delivered', attempts: attempt };
      } catch (e) {
        if (attempt === maxAttempts) {
          return { channel: channelName, language: lang, variant: variantName, status: 'failed', attempts: attempt };
        }
        // Exponential backoff: 200ms → 400ms → 800ms
        await new Promise(res => setTimeout(res, Math.pow(2, attempt) * 100));
      }
    }
    return { channel: channelName, language: lang, variant: variantName, status: 'failed', attempts: attempt };
  }

  /**
   * Delivers a single piece of content to a specific channel (used by deliver_to_channel tool).
   */
  public async deliverToChannel(channel: string, lang: string, variant: string, content: string): Promise<WebhookResult> {
    return this.attemptDelivery(channel, lang, variant, content);
  }

  /**
   * Distributes all 54 variants across all channels concurrently.
   */
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
