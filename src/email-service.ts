import { Resend } from 'resend';

/**
 * EmailService wraps the Resend API for sending real emails.
 * 
 * Used by the `send_real_email` MCP tool to deliver actual marketing copy
 * to a recipient's inbox — proving the pipeline works end-to-end beyond
 * just simulated webhooks.
 * 
 * Free tier: 3,000 emails/month, send only to your own verified email.
 * Default "from" address uses Resend's sandbox domain (onboarding@resend.dev).
 */
export class EmailService {
  private resend: Resend;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error(
        'RESEND_API_KEY is not set. Get a free key at https://resend.com/api-keys'
      );
    }
    this.resend = new Resend(apiKey);
  }

  /**
   * Sends a real email via the Resend API.
   *
   * @param to      - Recipient email address
   * @param subject - Email subject line (typically from the generated copy)
   * @param body    - Email body content (headline + CTA from the generated copy)
   * @returns       - Resend API response with email ID on success
   */
  public async sendEmail(
    to: string,
    subject: string,
    body: string
  ): Promise<{ success: boolean; emailId?: string; error?: string }> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: 'GrabOn Deals <onboarding@resend.dev>', // Resend sandbox sender
        to: [to],
        subject: subject,
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 24px; border-radius: 12px;">
              <h1 style="margin: 0 0 8px 0; font-size: 22px;">${subject}</h1>
            </div>
            <div style="padding: 24px; background: #f9fafb; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; line-height: 1.6; color: #374151;">${body}</p>
            </div>
            <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
              Sent via GrabOn Multi-Channel Deal Distributor
            </p>
          </div>
        `,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, emailId: data?.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }
}
