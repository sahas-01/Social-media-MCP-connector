import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { LLMGenerator } from './llm-generator.js';
import { TranslatorService } from './translator.js';
import { WebhookSimulator } from './webhook-simulator.js';
import { EmailService } from './email-service.js';
import { DealPayload } from './types.js';

// ─── Service Initialization ───────────────────────────────────────────────────
// Each service is a standalone class handling one part of the pipeline:
//   LLMGenerator      → generates 18 English copy variants via OpenAI
//   TranslatorService → generates Hindi & Telugu copy + refines via Sarvam-M
//   WebhookSimulator  → dispatches all 54 strings to mock endpoints with retry
//   EmailService      → sends real emails via Resend API (optional, needs RESEND_API_KEY)
const llmGen = new LLMGenerator();
const translator = new TranslatorService();
const webhookSim = new WebhookSimulator();

// EmailService is lazily initialized — only created when send_real_email is called.
// This way the server doesn't crash if RESEND_API_KEY isn't set (it's optional).
let emailService: EmailService | null = null;

/**
 * Safely extracts an error message from an unknown thrown value.
 * TypeScript requires `catch (e: unknown)` — this helper avoids verbose checks.
 */
function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

// ─── MCP Server Setup ─────────────────────────────────────────────────────────
// The server is initialized with the stdio transport, meaning Claude Desktop
// launches this process and communicates over stdin/stdout (not HTTP).
const server = new Server({
  name: 'grabon-deal-distributor',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},  // Tool capabilities are registered via the ListTools handler below
  },
});

// ─── Tool Definitions ─────────────────────────────────────────────────────────
// Defines the 3 tools this MCP server exposes to Claude:
//   1. distribute_deal     → the main pipeline (generate + localize + simulate delivery)
//   2. deliver_to_channel  → retry/send a single string to one mock channel
//   3. send_real_email     → actually send an email via Resend API
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'distribute_deal',
        description: 'Takes a merchant deal payload and generates 54 localized marketing copy variants (3 languages × 3 A/B variants × 6 channels), then simulates webhook delivery to all channels with retry logic. Returns all generated content plus delivery logs.',
        inputSchema: {
          type: 'object',
          properties: {
            merchant_id: { type: 'string', description: 'Merchant name or ID (e.g., Zomato, MakeMyTrip)' },
            category: { type: 'string', description: 'Deal category (e.g., Food, Travel, Fashion)' },
            discount_value: { type: 'string', description: 'Discount amount (e.g., 50%, ₹200)' },
            discount_type: { type: 'string', description: 'Type of discount: PERCENTAGE or FLAT' },
            expiry_timestamp: { type: 'string', description: 'ISO 8601 expiry date (e.g., 2026-03-15T23:59:00Z)' },
            min_order_value: { type: 'number', description: 'Minimum order value in ₹ to avail the deal' },
            max_redemptions: { type: 'number', description: 'Total number of times this deal can be redeemed' },
            exclusive_flag: { type: 'boolean', description: 'Whether the deal is exclusive to GrabOn' },
          },
          required: ['merchant_id', 'category', 'discount_value', 'discount_type', 'expiry_timestamp', 'min_order_value', 'max_redemptions', 'exclusive_flag'],
        },
      },
      {
        name: 'deliver_to_channel',
        description: 'Delivers a specific piece of content to a single mock channel webhook. Useful for retrying failed deliveries or testing individual channel endpoints.',
        inputSchema: {
          type: 'object',
          properties: {
            channel: { type: 'string', enum: ['email', 'whatsApp', 'push', 'glance', 'payU', 'instagram'], description: 'Target channel' },
            language: { type: 'string', enum: ['en', 'hi', 'te'], description: 'Language of the content' },
            variant: { type: 'string', enum: ['urgency', 'value', 'socialProof'], description: 'A/B variant type' },
            content: { type: 'string', description: 'The formatted content string to deliver' },
          },
          required: ['channel', 'language', 'variant', 'content'],
        },
      },
      {
        name: 'send_real_email',
        description: 'Sends a REAL email via Resend API to an actual email address. Use this after distribute_deal to deliver the generated email copy to a real inbox. Requires RESEND_API_KEY to be configured.',
        inputSchema: {
          type: 'object',
          properties: {
            to_email: { type: 'string', description: 'Recipient email address' },
            subject: { type: 'string', description: 'Email subject line (from generated copy)' },
            body: { type: 'string', description: 'Email body content — headline and CTA from the generated copy' },
          },
          required: ['to_email', 'subject', 'body'],
        },
      },
    ],
  };
});

// ─── Tool Handlers ────────────────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {

  // ── Tool 1: distribute_deal ─────────────────────────────────────────────────
  // The main pipeline: deal → 18 English (OpenAI) → 36 regional (OpenAI + Sarvam-M) → 54 webhook dispatches
  if (request.params.name === 'distribute_deal') {
    try {
      const deal = request.params.arguments as unknown as DealPayload;
      
      // Step 1: Generate 18 English A/B variants via OpenAI Structured Outputs
      console.error(`[MCP] -> Initiating distribution pipeline for: ${deal.merchant_id}`);
      console.error(`[MCP] -> Generating 18 base English permutations via OpenAI...`);
      const englishVariants = await llmGen.generateEnglishVariants(deal);
      
      // Step 2: Generate 36 regional variants (Hindi + Telugu) via OpenAI, refined by Sarvam-M
      console.error(`[MCP] -> Localizing into Hindi & Telugu via OpenAI (culturally idiomatic)...`);
      const fullVariants = await translator.generateFullPayload(englishVariants, deal);
      
      // Step 3: Dispatch all 54 strings to mock webhook endpoints concurrently
      console.error(`[MCP] -> Beginning Webhook simulation and queueing dispatch...`);
      const deliveryStatus = await webhookSim.distributeAll(fullVariants);
      
      const successCount = deliveryStatus.filter(s => s.status === 'delivered').length;
      console.error(`[MCP] -> Webhook sync complete! Delivered ${successCount} out of ${deliveryStatus.length} nodes successfully.`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: "success",
              message: "Deal pipeline executed flawlessly across all 54 endpoints.",
              total_variants_generated: 54,
              successful_webhook_deliveries: successCount,
              failed_webhook_deliveries: deliveryStatus.length - successCount,
              deal_payload: deal,
              generated_content: fullVariants,
              delivery_logs: deliveryStatus,
            }, null, 2)
          }
        ],
      };
    } catch (e: unknown) {
      console.error('[MCP] -> Fatal error while processing distribution:', e);
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error processing deal: ${getErrorMessage(e)}`
          }
        ]
      }
    }
  }

  // ── Tool 2: deliver_to_channel ──────────────────────────────────────────────
  // Sends a single string to one mock webhook. Used for retrying failed deliveries.
  if (request.params.name === 'deliver_to_channel') {
    try {
      const args = request.params.arguments as { channel: string; language: string; variant: string; content: string };
      
      console.error(`[MCP] -> Delivering to ${args.channel} (${args.language}/${args.variant})...`);
      const result = await webhookSim.deliverToChannel(args.channel, args.language, args.variant, args.content);
      console.error(`[MCP] -> ${result.status === 'delivered' ? '✅ Delivered' : '❌ Failed'} after ${result.attempts} attempt(s)`);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }],
      };
    } catch (e: unknown) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Delivery error: ${getErrorMessage(e)}` }]
      };
    }
  }

  // ── Tool 3: send_real_email ─────────────────────────────────────────────────
  // Sends a REAL email via Resend API. Lazily initializes the EmailService
  // so the server doesn't crash on startup if RESEND_API_KEY isn't configured.
  if (request.params.name === 'send_real_email') {
    try {
      // Lazy initialization — only create EmailService when first needed
      if (!emailService) {
        emailService = new EmailService();
      }

      const args = request.params.arguments as { to_email: string; subject: string; body: string };

      console.error(`[MCP] -> Sending real email to ${args.to_email} via Resend...`);
      const result = await emailService.sendEmail(args.to_email, args.subject, args.body);

      if (result.success) {
        console.error(`[MCP] -> ✅ Email sent successfully! ID: ${result.emailId}`);
      } else {
        console.error(`[MCP] -> ❌ Email failed: ${result.error}`);
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: result.success ? 'sent' : 'failed',
            to: args.to_email,
            subject: args.subject,
            email_id: result.emailId ?? null,
            error: result.error ?? null,
          }, null, 2)
        }],
      };
    } catch (e: unknown) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Email error: ${getErrorMessage(e)}` }]
      };
    }
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

// ─── Server Startup ───────────────────────────────────────────────────────────
// Connects the MCP server to stdio transport. Claude Desktop launches this
// process and communicates via stdin/stdout pipes.
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[GrabOn Multi-Channel Pipeline] MCP Server running on stdio');
}

main().catch((error) => {
  console.error("Fatal exception in main():", error);
  process.exit(1);
});
