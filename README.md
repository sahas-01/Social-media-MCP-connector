# MCP Multi-Channel Deal Distributor

A fully spec-compliant [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that turns a single merchant deal payload into **54 fully formatted, localized deal placements** across 6 channels — simultaneously. Built for solving the problem of multi-channel deal distribution.

> **📖 New here?** Follow the **[Setup Guide](./SETUP&RUN.md)** for step-by-step instructions to get the server running and connected to Claude Desktop.

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
  └───────────┬─────────────────────┘
              │
              ▼
  ┌─────────────────────────────────┐
  │   Resend API (Optional Tool)    │  → Actually emails the generated
  │   send_real_email               │    copy to a real inbox
  └─────────────────────────────────┘
```

**Total output: 54 strings + 54 delivery logs**

### Transport: Local stdio

This MCP server uses the **stdio transport** — Claude Desktop launches it as a local child process and communicates via stdin/stdout. Everything runs on your machine, no remote server needed.

> **Future scaling:** To deploy this for team-wide use (e.g., 50 GrabOn marketers using one shared server), the transport can be swapped from stdio to **SSE/HTTP** ([MCP Streamable HTTP spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http)).

---

## Technical Architecture

### Tech Stack

| Component | Technology | Purpose |
|---|---|---|
| MCP Server | `@modelcontextprotocol/sdk` | Spec-compliant stdio server connectable to Claude Desktop |
| Copy Generation | OpenAI `gpt-4o-mini` | Generates 18 structured English A/B variants via Structured Outputs |
| Localization | Sarvam AI `Sarvam-M` (chat completions) | Culturally idiomatic Hindi & Telugu localization (not literal translation) |
| Email Delivery | Resend API | Real email delivery for the generated copy |
| Schema Validation | `Zod` | Runtime type validation for all generated content |
| Runtime | `tsx` + TypeScript | Zero-build execution with full type safety |

### Project Structure

```
src/
├── index.ts              # MCP server entry point — tool registration & orchestration
├── types.ts              # Zod schemas & TypeScript types for all data structures
├── llm-generator.ts      # OpenAI wrapper — generates 18 English variants via Structured Outputs
├── translator.ts         # Sarvam-M chat wrapper — culturally idiomatic Hindi/Telugu localization
├── webhook-simulator.ts  # Mock delivery engine with exponential backoff retry
└── email-service.ts      # Resend API wrapper for actual email delivery
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

We use **Sarvam-M** (Sarvam AI's multilingual chat model) via `client.chat.completions()` for the local tone and feel of an Indian language

- ❌ Literal translation: *"Only 2 redemptions available! Minimum order ₹5000"* → *"केवल 2 रिडेम्पशन उपलब्ध हैं! न्यूनतम ₹5000 का ऑर्डर"*
- ✅ Idiomatic localization: → *"बस 2 बार मिलेगा ये offer! ₹5000 का order करो और मस्ती करो 🔥"*

Each language has its own detailed cultural guidance prompt with few-shot examples:
- **Hindi**: Hinglish with Mumbai ad agency energy, casual "तुम/तू" tone, WhatsApp-style slang
- **Telugu**: Hyderabadi spoken style, casual expressions like "ఒరేయ్", "మిస్ అయితే నీ ఖర్మ", natural English mixing

All 54 localization calls (6 variants × 9 fields each) run concurrently via `Promise.all` for optimal performance.

### Webhook Simulation

Every one of the 54 formatted strings is dispatched to a mock webhook endpoint that simulates real-world delivery:

- **20% random failure rate** to simulate network issues
- **Exponential backoff retry** (up to 3 attempts per delivery, with 2^n × 100ms delays)
- **Delivery report** with per-channel success/failure status and attempt counts
- All 54 dispatches run concurrently via `Promise.all`

---

## Setup

> For a detailed, step-by-step walkthrough (including troubleshooting), see **[SETUP_GUIDE.md](./SETUP&RUN.md)**.


