import { z } from 'zod';

// ─── Input Type ───────────────────────────────────────────────────────────────
// The raw deal payload that comes in from Claude via the distribute_deal tool.
// All fields map 1:1 to the tool's inputSchema defined in index.ts.
export type DealPayload = {
  merchant_id: string;        // e.g., "Zomato", "MakeMyTrip"
  category: string;           // e.g., "Food", "Travel", "Fashion"
  discount_value: string;     // e.g., "50%", "₹200"
  discount_type: string;      // "PERCENTAGE" or "FLAT"
  expiry_timestamp: string;   // ISO 8601 date string
  min_order_value: number;    // minimum order in ₹ to avail the deal
  max_redemptions: number;    // how many people can use this deal
  exclusive_flag: boolean;    // true = GrabOn exclusive, false = available everywhere
};

// ─── Zod Schemas for LLM Output Validation ────────────────────────────────────
// These schemas validate the structured JSON that OpenAI returns.
// Using Zod + OpenAI Structured Outputs guarantees type-safe LLM responses.

/** Email has 3 components: subject line, headline, and call-to-action */
export const EmailVariantSchema = z.object({
  subjectLine: z.string(),
  headline: z.string(),
  cta: z.string()
});

/** Push notification has a title and a body */
export const PushVariantSchema = z.object({
  title: z.string(),
  body: z.string()
});

/**
 * A single channel variant — one complete set of copy across all 6 channels.
 * This is the atomic unit of generated content.
 */
export const ChannelVariantSchema = z.object({
  email: EmailVariantSchema,
  whatsApp: z.string(),       // ≤160 chars
  push: PushVariantSchema,
  glance: z.string(),         // ≤160 chars, must work without context
  payU: z.string(),           // ≤40 chars, checkout banner
  instagram: z.string()       // ≤400 chars, caption with hashtags
});

/**
 * The full English generation output — 3 psychologically distinct variants.
 * Each variant contains all 6 channel formats.
 * Total: 3 variants × 6 channels = 18 strings.
 */
export const EnglishGenerationSchema = z.object({
  urgency: ChannelVariantSchema,     // FOMO, scarcity, time pressure
  value: ChannelVariantSchema,       // savings focus, rational ROI
  socialProof: ChannelVariantSchema  // popularity, crowd validation
});

export type EnglishGeneration = z.infer<typeof EnglishGenerationSchema>;

// ─── Internal Types ───────────────────────────────────────────────────────────
// These types are used internally between services (not validated by Zod
// since they're produced by our own code, not by an LLM).

/** Same structure as ChannelVariantSchema but as a plain TypeScript type */
export type LocalizedVariant = {
  email: { subjectLine: string; headline: string; cta: string };
  whatsApp: string;
  push: { title: string; body: string };
  glance: string;
  payU: string;
  instagram: string;
};

/**
 * The complete output of the pipeline: 3 languages × 3 variants = 9 variant sets.
 * Each variant set contains all 6 channel formats.
 * Total strings: 9 × 6 = 54 (plus sub-fields in email and push = 54 "logical" strings).
 */
export type FullGeneration = {
  en: {
    urgency: LocalizedVariant;
    value: LocalizedVariant;
    socialProof: LocalizedVariant;
  };
  hi: {
    urgency: LocalizedVariant;
    value: LocalizedVariant;
    socialProof: LocalizedVariant;
  };
  te: {
    urgency: LocalizedVariant;
    value: LocalizedVariant;
    socialProof: LocalizedVariant;
  };
};

/** Result of a single webhook delivery attempt */
export type WebhookResult = {
  channel: string;
  language: string;
  variant: string;
  status: 'delivered' | 'failed';
  attempts: number;  // how many attempts were made (1-3, with exponential backoff)
};
