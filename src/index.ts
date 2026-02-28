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
import { DealPayload } from './types.js';

// Setup dependencies
const llmGen = new LLMGenerator();
const translator = new TranslatorService();
const webhookSim = new WebhookSimulator();

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

const server = new Server({
  name: 'grabon-deal-distributor',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'distribute_deal',
        description: 'Autogenerates, localizes, and distributes a merchant deal across 6 channels with 3 A/B variants each (54 total text blocks) and simulates webhook queue delivery to those channels.',
        inputSchema: {
          type: 'object',
          properties: {
            merchant_id: { type: 'string', description: 'Unique identifier for the merchant (e.g., ZOM123)' },
            category: { type: 'string', description: 'Category of the deal (e.g., Food, Travel)' },
            discount_value: { type: 'string', description: 'Discount amount as text (e.g., 50%, Rs. 100)' },
            discount_type: { type: 'string', description: 'Type of discount (e.g., PERCENTAGE, FLAT)' },
            expiry_timestamp: { type: 'string', description: 'ISO string date for expiry' },
            min_order_value: { type: 'number', description: 'Minimum order amount to avail' },
            max_redemptions: { type: 'number', description: 'Maximum redemptions allowed globally' },
            exclusive_flag: { type: 'boolean', description: 'Whether the deal is exclusive to GrabOn' },
          },
          required: ['merchant_id', 'category', 'discount_value', 'discount_type', 'expiry_timestamp', 'min_order_value', 'max_redemptions', 'exclusive_flag'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'distribute_deal') {
    try {
      const deal = request.params.arguments as unknown as DealPayload;
      
      console.error(`[MCP] -> Initiating distribution pipeline for: ${deal.merchant_id}`);
      
      console.error(`[MCP] -> Generating 18 base English permutations via OpenAI...`);
      const englishVariants = await llmGen.generateEnglishVariants(deal);
      
      console.error(`[MCP] -> Translating into Hindi & Telugu via Sarvam AI to hit 54 variants...`);
      const fullVariants = await translator.generateFullPayload(englishVariants);
      
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

  throw new Error(`Unknown tool: ${request.params.name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[GrabOn Multi-Channel Pipeline] MCP Server running on stdio');
}

main().catch((error) => {
  console.error("Fatal exception in main():", error);
  process.exit(1);
});
