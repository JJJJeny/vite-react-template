# Feedback Analyzer

AI-powered feedback aggregation and analysis tool for Product Managers.

## What It Does

Feedback Analyzer helps PMs make sense of noisy user feedback by:

1. **Aggregating feedback** from multiple sources (email, Twitter, Reddit)
2. **AI analysis** using Workers AI (Llama 3.1) to extract:
   - Theme (what the feedback is about)
   - Sentiment (positive/negative/neutral)
   - Urgency (high/medium/low)
   - Summary (one-line description)
3. **Generating insights** with AI-powered executive summaries
4. **Automated notifications** via Discord webhook

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   D1 (DB)    │────▶│  Workers AI (AI) │────▶│    Workflows     │
│              │     │                  │     │                  │
│ feedback     │     │ Llama 3.1 8B     │     │ Step 1: Fetch    │
│ table        │     │ - sentiment      │     │ Step 2: Summarize│
│              │     │ - theme          │     │ Step 3: Discord  │
└──────────────┘     │ - urgency        │     └──────────────────┘
                     └──────────────────┘
```

## Cloudflare Services Used

| Service | Purpose |
|---------|---------|
| **Workers** | API endpoints and static asset serving |
| **D1** | SQL database for feedback storage |
| **Workers AI** | Llama 3.1 for sentiment analysis and summarization |
| **Workflows** | Multi-step digest pipeline to Discord |

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Run database migrations

```bash
npx wrangler d1 execute feedback_db --local --file=migrations/0001_init.sql
npx wrangler d1 execute feedback_db --local --file=migrations/0002_add_source.sql
```

### 3. Start development server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Configuration

### Discord Webhook (Optional)

To enable automated Discord notifications:

1. Create a webhook in your Discord server (Server Settings → Integrations → Webhooks)
2. Add to `wrangler.json`:

```json
"vars": {
  "DISCORD_WEBHOOK_URL": "https://discord.com/api/webhooks/..."
}
```

Or use secrets for production:

```bash
npx wrangler secret put DISCORD_WEBHOOK_URL
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/feedback` | GET | List all feedback items |
| `/api/analyze` | POST | Analyze a single feedback item with AI |
| `/api/summary` | POST | Generate executive summary |
| `/api/send-digest` | POST | Trigger Discord workflow |

## Deployment

```bash
npm run build
npx wrangler deploy
```

## Tech Stack

- **Frontend**: React + Vite + TypeScript
- **Backend**: Cloudflare Workers + Hono
- **Database**: Cloudflare D1
- **AI**: Cloudflare Workers AI (Llama 3.1 8B)
- **Automation**: Cloudflare Workflows
