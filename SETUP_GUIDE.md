# Setup Guide — GrabOn Multi-Channel Deal Distributor

This guide walks you through setting up the MCP server from scratch and connecting it to Claude Desktop.

---

## Prerequisites

| Requirement | Version | How to check |
|---|---|---|
| **Node.js** | ≥ 18 | `node --version` |
| **npm** | ≥ 9 | `npm --version` |
| **Claude Desktop** | Latest | [Download](https://claude.ai/download) |

### API Keys Required

| Service | Purpose | Get it from |
|---|---|---|
| **OpenAI** | Generates English marketing copy (gpt-4o-mini) | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| **Sarvam AI** | Refines Hindi & Telugu localization (Sarvam-M) | [dashboard.sarvam.ai](https://dashboard.sarvam.ai) |

---

## Step 1: Clone & Install

```bash
git clone <repo-url>
cd MCP-social-media-connector
npm install
```

This installs all dependencies:
- `@modelcontextprotocol/sdk` — MCP server framework
- `openai` — OpenAI API client
- `sarvamai` — Sarvam AI client
- `zod` — Schema validation
- `tsx` — TypeScript execution (dev dependency)

---

## Step 2: Configure Environment Variables

Create a `.env` file in the project root:

```bash
touch .env
```

Add your API keys:

```env
OPENAI_API_KEY=sk-proj-your-openai-key-here
SARVAM_API_KEY=sk_your-sarvam-key-here
```

> **Note:** The `.env` file is only used when running the MCP Inspector locally. Claude Desktop uses its own env config (see Step 4).

---

## Step 3: Verify with MCP Inspector

Before connecting to Claude Desktop, test that the server works:

```bash
npx -y @modelcontextprotocol/inspector tsx src/index.ts
```

1. Open the URL printed in terminal (usually `http://localhost:6274`)
2. Click **Connect** in the Inspector UI
3. Go to the **Tools** tab — you should see `distribute_deal` and `deliver_to_channel`
4. **Important:** Set **Request Timeout** to `120000` ms (2 minutes) in the Configuration panel. The full pipeline takes 30–60 seconds.
5. Click `distribute_deal`, fill in test parameters:

```
merchant_id: Zomato
category: Food
discount_value: 50
discount_type: PERCENTAGE
expiry_timestamp: 2026-03-15T23:59:00Z
min_order_value: 200
max_redemptions: 5000
exclusive_flag: true
```

6. Click **Run Tool** and wait for the response with all 54 variants + delivery logs

---

## Step 4: Connect to Claude Desktop

### 4a. Find your config file

**macOS:**
```bash
open ~/Library/Application\ Support/Claude/
```

Look for `claude_desktop_config.json`. If it doesn't exist, create it.

### 4b. Add the MCP server config

Open `claude_desktop_config.json` and add or merge the following. **Replace the path and API keys with your actual values:**

```json
{
  "mcpServers": {
    "grabon-distributor": {
      "command": "npx",
      "args": [
        "tsx",
        "/FULL/ABSOLUTE/PATH/TO/MCP social media connector/src/index.ts"
      ],
      "env": {
        "OPENAI_API_KEY": "sk-proj-your-openai-key-here",
        "SARVAM_API_KEY": "sk_your-sarvam-key-here"
      }
    }
  }
}
```

> ⚠️ **Critical:** Use the **full absolute path** to `src/index.ts`. Relative paths will not work.

> ⚠️ **Critical:** You **must** include API keys in the `"env"` block. Claude Desktop spawns the server as a child process with a clean environment — it does **not** read your `.env` file or shell environment variables.

### 4c. Restart Claude Desktop

Fully quit Claude Desktop (`Cmd + Q` on macOS) and reopen it.

### 4d. Verify connection

1. Open a **new conversation** in Claude Desktop
2. Look for the **🔨 hammer icon** at the bottom of the input box
3. Click it — you should see `distribute_deal` and `deliver_to_channel` listed
4. If you don't see the hammer icon, check the logs:

```bash
# View MCP server logs on macOS
tail -f ~/Library/Logs/Claude/mcp-server-grabon-distributor.log
```

---

## Step 5: Run Your First Deal

Once connected, just type a natural language prompt in Claude Desktop:

### Example Prompts

**Deal 1 — Zomato (Food):**
> Hey, I have a new Zomato deal: 50% off on food orders, minimum order ₹200, 5000 redemptions available, expires March 15th, exclusive to GrabOn. Distribute this across all channels.

**Deal 2 — MakeMyTrip (Travel):**
> Distribute a MakeMyTrip travel deal: flat ₹2000 off on bookings over ₹5000, 1000 redemptions, expires April 1st, available across platforms.

**Deal 3 — Myntra (Fashion):**
> New Myntra fashion deal: 40% off, min order ₹999, 10000 redemptions, expires March 10th, exclusive. Distribute it.

Claude will automatically call `distribute_deal` and return all **54 localized strings** + **54 delivery logs**.

### Useful Follow-up Prompts

After the tool runs, ask Claude to present the data:

- *"Show me all 54 strings in a table, organized by language, variant, and channel"*
- *"Compare the urgency vs value variants for WhatsApp across all 3 languages"*
- *"Which deliveries failed and how many retries did each take?"*
- *"Re-deliver the failed items"* (uses the `deliver_to_channel` tool)

---

## Troubleshooting

### Server not appearing in Claude Desktop

| Issue | Fix |
|---|---|
| No hammer icon | Fully quit (`Cmd + Q`) and reopen Claude Desktop |
| Path error in logs | Use the absolute path to `src/index.ts`, no `~` or `$HOME` |
| `npx` not found | Ensure Node.js is in your PATH. If installed via Homebrew: `ln -sf /opt/homebrew/opt/node@20/bin/node /opt/homebrew/bin/node` |
| API key errors | Ensure keys are in the `"env"` block of `claude_desktop_config.json`, not `.env` |

### Timeout errors

| Issue | Fix |
|---|---|
| MCP Inspector timeout | Set Request Timeout to `120000` ms in Configuration panel |
| Claude Desktop timeout | The pipeline runs in 30–60s. If it times out, try again — API latency varies |

### Common runtime errors

| Error | Cause | Fix |
|---|---|---|
| `Empty OpenAI response` | OpenAI API key invalid or quota exceeded | Check your key at [platform.openai.com](https://platform.openai.com) |
| `Sarvam-M Refinement failed` | Sarvam API issue (non-fatal — falls back to OpenAI version) | Check your key at [dashboard.sarvam.ai](https://dashboard.sarvam.ai) |
| `ECONNREFUSED` | Server crashed during startup | Check logs for TypeScript errors: `npx tsc --noEmit` |

---

## Architecture Overview

```
User (Claude Desktop)
    │
    │  Natural language: "Distribute this Zomato deal..."
    ▼
┌──────────────────────────┐
│  MCP Server (index.ts)   │  ← Receives tool call via stdio
│  distribute_deal()       │
└──────────┬───────────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
┌──────────┐  ┌──────────────┐
│ OpenAI   │  │ OpenAI       │  ← 3 parallel calls
│ English  │  │ Hindi/Telugu │    (1 English + 2 regional)
│ 18 vars  │  │ 36 vars raw  │
└────┬─────┘  └──────┬───────┘
     │               │
     │               ▼
     │        ┌──────────────┐
     │        │ Sarvam-M     │  ← 36 concurrent refinement calls
     │        │ Polish each  │
     │        │ string       │
     │        └──────┬───────┘
     │               │
     └───────┬───────┘
             ▼
     ┌───────────────┐
     │ 54 total      │
     │ variants      │
     └───────┬───────┘
             │
             ▼
     ┌───────────────┐
     │ Webhook Sim   │  ← 54 concurrent deliveries
     │ Retry logic   │    with exponential backoff
     │ Delivery logs │
     └───────────────┘
```
