import { z } from 'zod';

export type DealPayload = {
  merchant_id: string;
  category: string;
  discount_value: string;
  discount_type: string;
  expiry_timestamp: string;
  min_order_value: number;
  max_redemptions: number;
  exclusive_flag: boolean;
};

export const EmailVariantSchema = z.object({
  subjectLine: z.string(),
  headline: z.string(),
  cta: z.string()
});

export const PushVariantSchema = z.object({
  title: z.string(),
  body: z.string()
});

export const ChannelVariantSchema = z.object({
  email: EmailVariantSchema,
  whatsApp: z.string(),
  push: PushVariantSchema,
  glance: z.string(),
  payU: z.string(),
  instagram: z.string()
});

export const EnglishGenerationSchema = z.object({
  urgency: ChannelVariantSchema,
  value: ChannelVariantSchema,
  socialProof: ChannelVariantSchema
});

export type EnglishGeneration = z.infer<typeof EnglishGenerationSchema>;

export type LocalizedVariant = {
  email: { subjectLine: string; headline: string; cta: string };
  whatsApp: string;
  push: { title: string; body: string };
  glance: string;
  payU: string;
  instagram: string;
};

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

export type WebhookResult = {
  channel: string;
  language: string;
  variant: string;
  status: 'delivered' | 'failed';
  attempts: number;
};
