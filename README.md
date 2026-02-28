# GrabOn Multi-Channel Deal Distributor — MCP Server

A fully spec-compliant [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that turns a single merchant deal payload into **54 fully formatted, localized deal placements** across 6 channels — simultaneously. Built for GrabOn's multi-channel distribution infrastructure.

## What It Does

One API call → 54 production-ready marketing strings.

```
Merchant Deal Payload
        │
        ▼
┌───────────────────────────┐
│   OpenAI (gpt-4o)         │  → 18 English variants
│   Structured JSON output  │    (6 channels × 3 A/B variants)
└───────────┬───────────────┘
            │
            ▼
┌───────────────────────────┐
│   Sarvam AI (Sarvam-M)    │  → 36 localized variants
│   Idiomatic Hindi/Telugu  │    (18 × 2 languages)
└───────────┬───────────────┘
            │
            ▼
┌───────────────────────────┐
│   Webhook Simulator       │  → 54 delivery attempts
│   Exponential backoff     │    with retry logic
└───────────────────────────┘
```

**Total output: 54 strings + delivery logs**

---

## Technical Architecture

### Tech Stack

| Component | Technology | Purpose |
|---|---|---|
| MCP Server | `@modelcontextprotocol/sdk` | Spec-compliant stdio server connectable to Claude Desktop |
| Copy Generation | OpenAI `gpt-4o` | Generates 18 structured English A/B variants |
| Localization | Sarvam AI `Sarvam-M` | Culturally idiomatic Hindi & Telugu rewriting (not literal translation) |
| Schema Validation | `Zod` | Strict character limits enforced per channel |
| Runtime | `tsx` + TypeScript | Zero-build execution with full type safety |

### Project Structure

```
src/
├── index.ts              # MCP server entry point — tool registration & orchestration
├── types.ts              # Zod schemas & TypeScript types for all data structures
├── llm-generator.ts      # OpenAI wrapper — generates 18 English variants
├── translator.ts         # Sarvam-M wrapper — idiomatic Hindi/Telugu localization
└── webhook-simulator.ts  # Mock delivery engine with exponential backoff retry
```

### The 6 Channels

| Channel | Format | Constraint |
|---|---|---|
| **Email** | HTML snippet (subject + headline + CTA) | Subject ≤60, Headline ≤80, CTA ≤30 chars |
| **WhatsApp** | Plain text message | ≤160 characters |
| **Push Notification** | Title + Body | Title ≤50, Body ≤100 chars |
| **Glance Lock Screen** | Standalone card | ≤160 chars, must work without context |
| **PayU Checkout Banner** | Action-oriented text | ≤40 characters |
| **Instagram** | Caption with hashtags | ≤400 characters |

### The 3 A/B Variants

Each channel gets 3 psychologically distinct variants:

- **Urgency** — Time pressure, scarcity, FOMO-driven messaging
- **Value** — Savings-focused, rational ROI, benefit-driven messaging
- **Social Proof** — Popularity signals, crowd validation, trust-driven messaging

These are **not** synonym swaps — they use entirely different psychological framing.

### Localization Strategy

We use **Sarvam-M** (Sarvam AI's 24B-parameter multilingual chat model) instead of a translation API. The key difference:

- ❌ Literal translation: *"Last chance! 50% off"* → *"आखिरी मौका! 50% छूट"*
- ✅ Idiomatic localization: *"Last chance! 50% off"* → *"अरे भाई, आधी कीमत में खाना! आज नहीं तो कभी नहीं! 🔥"*

Each language has its own cultural guidance prompt:
- **Hindi**: Colloquial North Indian urban expressions, conversational tone
- **Telugu**: Telangana/Andhra pop culture references, expressive local phrases

### Webhook Simulation

Every one of the 54 formatted strings is dispatched to a mock webhook endpoint that simulates real-world delivery:

- **20% random failure rate** to simulate network issues
- **Exponential backoff retry** (up to 3 attempts per delivery)
- **Delivery report** with per-channel success/failure status and attempt counts

---

## Setup

### Prerequisites

- Node.js ≥18
- An OpenAI API key
- A Sarvam AI API key ([dashboard.sarvam.ai](https://dashboard.sarvam.ai))

### Installation

```bash
git clone <repo-url>
cd mcp-social-media-connector
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=sk-...
SARVAM_API_KEY=...
```

---

## Testing with MCP Inspector

The fastest way to test without Claude Desktop:

```bash
npx -y @modelcontextprotocol/inspector tsx src/index.ts
```

Open the URL printed in your terminal (usually `http://localhost:6274`), connect, go to **Tools → distribute_deal**, fill in the deal parameters, and click **Run Tool**.

---

## Connecting to Claude Desktop

Add this to your `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "grabon-distributor": {
      "command": "npx",
      "args": [
        "tsx",
        "/absolute/path/to/MCP social media connector/src/index.ts"
      ],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "SARVAM_API_KEY": "..."
      }
    }
  }
}
```

Restart Claude Desktop (`Cmd + R`). The hammer 🔨 icon should appear indicating the tool is connected.

### Sample Prompts for Demo

**Deal 1 — Zomato (Food)**
> Distribute this deal: merchant_id='ZOM123', category='Food', discount_value='50%', discount_type='PERCENTAGE', expiry_timestamp='2026-03-15T23:59:00Z', min_order_value=200, max_redemptions=5000, exclusive_flag=true

**Deal 2 — MakeMyTrip (Travel)**
> Distribute this deal: merchant_id='MMT456', category='Travel', discount_value='Rs. 2000', discount_type='FLAT', expiry_timestamp='2026-04-01T23:59:00Z', min_order_value=5000, max_redemptions=1000, exclusive_flag=false

**Deal 3 — Myntra (Fashion)**
> Distribute this deal: merchant_id='MYN789', category='Fashion', discount_value='40%', discount_type='PERCENTAGE', expiry_timestamp='2026-03-10T23:59:00Z', min_order_value=999, max_redemptions=10000, exclusive_flag=true

---

## Output Structure

The tool returns a JSON object containing:

```json
{
  "status": "success",
  "total_variants_generated": 54,
  "successful_webhook_deliveries": 48,
  "failed_webhook_deliveries": 6,
  "deal_payload": { ... },
  "generated_content": {
    "en": { "urgency": { ... }, "value": { ... }, "socialProof": { ... } },
    "hi": { "urgency": { ... }, "value": { ... }, "socialProof": { ... } },
    "te": { "urgency": { ... }, "value": { ... }, "socialProof": { ... } }
  },
  "delivery_logs": [
    { "channel": "email", "language": "en", "variant": "urgency", "status": "delivered", "attempts": 1 },
    { "channel": "whatsApp", "language": "hi", "variant": "value", "status": "failed", "attempts": 3 },
    ...
  ]
}
```

---

## License

ISC
