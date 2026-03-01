# GrabOn Multi-Channel Deal Distributor — MCP Server

A fully spec-compliant [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that turns a single merchant deal payload into **54 fully formatted, localized deal placements** across 6 channels — simultaneously. Built for GrabOn's multi-channel distribution infrastructure.

## What It Does

One tool call → 54 production-ready marketing strings.

```
Merchant Deal Payload
        │
        ▼
┌─────────────────────────────────┐
│   OpenAI (gpt-4o-mini)          │  → 18 English variants
│   Structured Outputs (strict)   │    (6 channels × 3 A/B variants)
└───────────┬─────────────────────┘
            │
            ▼
┌─────────────────────────────────┐
│   Sarvam AI (Sarvam-M chat)     │  → 36 localized variants
│   Idiomatic Hindi & Telugu      │    (18 × 2 languages)
└───────────┬─────────────────────┘
            │
            ▼
┌─────────────────────────────────┐
│   Webhook Simulator             │  → 54 delivery attempts
│   Exponential backoff retries   │    with success/failure logs
└─────────────────────────────────┘
```

**Total output: 54 strings + 54 delivery logs**

---

## Technical Architecture

### Tech Stack

| Component | Technology | Purpose |
|---|---|---|
| MCP Server | `@modelcontextprotocol/sdk` | Spec-compliant stdio server connectable to Claude Desktop |
| Copy Generation | OpenAI `gpt-4o-mini` | Generates 18 structured English A/B variants via Structured Outputs |
| Localization | Sarvam AI `Sarvam-M` (chat completions) | Culturally idiomatic Hindi & Telugu localization (not literal translation) |
| Schema Validation | `Zod` | Runtime type validation for all generated content |
| Runtime | `tsx` + TypeScript | Zero-build execution with full type safety |

### Project Structure

```
src/
├── index.ts              # MCP server entry point — tool registration & orchestration
├── types.ts              # Zod schemas & TypeScript types for all data structures
├── llm-generator.ts      # OpenAI wrapper — generates 18 English variants via Structured Outputs
├── translator.ts         # Sarvam-M chat wrapper — culturally idiomatic Hindi/Telugu localization
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

These are **not** synonym swaps — they use entirely different psychological framing. The prompt explicitly instructs the model to write each variant as if a different copywriter authored it.

### Structured Outputs

We use OpenAI's **Structured Outputs** (`response_format: { type: 'json_schema', strict: true }`) to guarantee the LLM response matches our exact Zod schema every time. This eliminates:

- Key casing mismatches (e.g., `Instagram` vs `instagram`)
- Missing fields causing runtime validation failures
- The need for any post-processing or normalization on the LLM output

The JSON schema is defined inline in the API call with `additionalProperties: false` on every object, so the output is deterministically structured.

### Localization Strategy

We use **Sarvam-M** (Sarvam AI's multilingual chat model) via `client.chat.completions()` instead of a formal translation API. The key difference:

- ❌ Literal translation: *"Only 2 redemptions available! Minimum order ₹5000"* → *"केवल 2 रिडेम्पशन उपलब्ध हैं! न्यूनतम ₹5000 का ऑर्डर"*
- ✅ Idiomatic localization: → *"बस 2 बार मिलेगा ये offer! ₹5000 का order करो और मस्ती करो 🔥"*

Each language has its own detailed cultural guidance prompt with few-shot examples:
- **Hindi**: Hinglish with Mumbai ad agency energy, casual "तुम/तू" tone, WhatsApp-style slang
- **Telugu**: Hyderabadi spoken style, casual expressions like "ఒరేయ్", "మిస్ అయితే నీ ఖర్మ", natural English mixing

The formal `sarvam-translate:v1` API is kept as a fallback if Sarvam-M chat fails for any individual string.

All 54 localization calls (6 variants × 9 fields each) run concurrently via `Promise.all` for optimal performance.

### Webhook Simulation

Every one of the 54 formatted strings is dispatched to a mock webhook endpoint that simulates real-world delivery:

- **20% random failure rate** to simulate network issues
- **Exponential backoff retry** (up to 3 attempts per delivery, with 2^n × 100ms delays)
- **Delivery report** with per-channel success/failure status and attempt counts
- All 54 dispatches run concurrently via `Promise.all`

---

## Setup

### Prerequisites

- Node.js ≥ 18
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

> **Note:** Set the Request Timeout to at least `60000` ms in the Inspector's Configuration panel, as the full pipeline (LLM generation + translations + webhook simulation) takes 20–40 seconds.

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

> **Important:** Claude Desktop spawns the MCP server as a child process with a clean environment. You **must** include your API keys in the `"env"` block — it will not read your `.env` file or shell environment.

> **Note:** If `node` is installed via Homebrew with a versioned path (e.g., `/opt/homebrew/opt/node@20/bin/node`), you may need to symlink it: `ln -sf /opt/homebrew/opt/node@20/bin/node /opt/homebrew/bin/node`

After saving the config, restart Claude Desktop (`Cmd + Q` → reopen). The 🔨 hammer icon should appear in new conversations — click it to verify `distribute_deal` is registered.

### Sample Prompts for Demo

You can use natural language — Claude will map it to the tool parameters automatically.

**Deal 1 — Zomato (Food)**
> Hey, I have a new Zomato deal: 50% off on food orders, min order ₹200, 5000 redemptions available, expires March 15th, exclusive to GrabOn. Distribute this across all channels.

**Deal 2 — MakeMyTrip (Travel)**
> Distribute a MakeMyTrip travel deal: flat ₹2000 off on bookings over ₹5000, 1000 redemptions, expires April 1st, available across platforms.

**Deal 3 — Myntra (Fashion)**
> New Myntra fashion deal: 40% off, min order ₹999, 10000 redemptions, expires March 10th, exclusive. Distribute it.

Or with explicit parameters:

```
Distribute this deal: merchant_id='ZOM123', category='Food', discount_value='50%', 
discount_type='PERCENTAGE', expiry_timestamp='2026-03-15T23:59:00Z', 
min_order_value=200, max_redemptions=5000, exclusive_flag=true
```

### Suggested Follow-up Prompts

After the tool runs, ask Claude to present the output:

- *"Show me all 54 strings in a table, organized by language, variant, and channel"*
- *"Compare the urgency vs value variants for WhatsApp across all 3 languages"*
- *"Which deliveries failed and how many retries did each take?"*

---

## Output Structure

The tool returns a JSON object containing:

```json
{
  "status": "success",
  "total_variants_generated": 54,
  "successful_webhook_deliveries": 51,
  "failed_webhook_deliveries": 3,
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

Each variant contains all 6 channel fields:

```json
{
  "email": { "subjectLine": "...", "headline": "...", "cta": "..." },
  "whatsApp": "...",
  "push": { "title": "...", "body": "..." },
  "glance": "...",
  "payU": "...",
  "instagram": "..."
}
```

---

## License

ISC
