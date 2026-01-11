import { Hono } from "hono";
import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from "cloudflare:workers";

type Bindings = {
  DB: D1Database;
  AI: Ai;
  DISCORD_WEBHOOK_URL: string;
  DIGEST_WORKFLOW: Workflow;
};

type Feedback = {
  id: number;
  message: string;
  theme: string | null;
  sentiment: string | null;
  urgency: string | null;
  summary: string | null;
  source: string;
  created_at: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// List all feedback
app.get("/api/feedback", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM feedback ORDER BY created_at DESC"
  ).all<Feedback>();
  return c.json(results);
});

// Analyze a single feedback item
app.post("/api/analyze", async (c) => {
  const { id } = await c.req.json<{ id: number }>();

  const feedback = await c.env.DB.prepare(
    "SELECT * FROM feedback WHERE id = ?"
  ).bind(id).first<Feedback>();

  if (!feedback) {
    return c.json({ error: "Feedback not found" }, 404);
  }

  const prompt = `Analyze this user feedback and respond with ONLY a JSON object (no markdown, no explanation):
{
  "theme": "<main topic in 2-3 words>",
  "sentiment": "<positive|negative|neutral>",
  "urgency": "<high|medium|low>",
  "summary": "<one sentence summary>"
}

Feedback: "${feedback.message}"`;

  const response = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct" as keyof AiModels, {
    prompt,
    max_tokens: 150,
  });

  let analysis: { theme: string; sentiment: string; urgency: string; summary: string };
  try {
    const text = (response as { response: string }).response;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    analysis = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch {
    return c.json({ error: "Failed to parse AI response" }, 500);
  }

  await c.env.DB.prepare(
    "UPDATE feedback SET theme = ?, sentiment = ?, urgency = ?, summary = ? WHERE id = ?"
  ).bind(analysis.theme, analysis.sentiment, analysis.urgency, analysis.summary, id).run();

  const updated = await c.env.DB.prepare(
    "SELECT * FROM feedback WHERE id = ?"
  ).bind(id).first<Feedback>();

  return c.json(updated);
});

// Generate aggregate summary for PM
app.post("/api/summary", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM feedback WHERE theme IS NOT NULL"
  ).all<Feedback>();

  if (results.length === 0) {
    return c.json({ error: "No analyzed feedback yet" }, 400);
  }

  const feedbackList = results.map(
    (f) => `- [${f.sentiment}, ${f.urgency} urgency, ${f.source}] ${f.theme}: ${f.summary}`
  ).join("\n");

  const prompt = `You are a PM assistant. Given this analyzed user feedback, provide a brief executive summary with:
1. Key themes (top 2-3 issues)
2. Overall sentiment breakdown
3. Recommended priorities

Respond in plain text, be concise (max 150 words).

Feedback:
${feedbackList}`;

  const response = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct" as keyof AiModels, {
    prompt,
    max_tokens: 300,
  });

  const text = (response as { response: string }).response;
  return c.json({ summary: text });
});

// Trigger digest workflow manually
app.post("/api/send-digest", async (c) => {
  const instance = await c.env.DIGEST_WORKFLOW.create();
  return c.json({ message: "Digest workflow started", id: instance.id });
});

export default app;

// Workflow for daily Discord digest
export class DigestWorkflow extends WorkflowEntrypoint<Bindings> {
  async run(_event: WorkflowEvent<unknown>, step: WorkflowStep) {
    // Step 1: Get analyzed feedback
    const feedback = await step.do("fetch-feedback", async () => {
      const { results } = await this.env.DB.prepare(
        "SELECT * FROM feedback WHERE theme IS NOT NULL ORDER BY created_at DESC LIMIT 20"
      ).all<Feedback>();
      return results;
    });

    if (feedback.length === 0) {
      return { status: "skipped", reason: "No analyzed feedback" };
    }

    // Step 2: Generate AI summary
    const summary = await step.do("generate-summary", async () => {
      const feedbackList = feedback.map(
        (f) => `- [${f.sentiment}, ${f.urgency}] ${f.theme}: ${f.summary}`
      ).join("\n");

      const prompt = `You are a PM assistant. Summarize this feedback for a daily digest:
1. Top issues requiring attention
2. Sentiment overview
3. Quick wins

Be concise (100 words max).

${feedbackList}`;

      const response = await this.env.AI.run("@cf/meta/llama-3.1-8b-instruct" as keyof AiModels, {
        prompt,
        max_tokens: 200,
      });
      return (response as { response: string }).response;
    });

    // Step 3: Send to Discord
    const discordResult = await step.do("send-discord", async () => {
      const webhookUrl = this.env.DISCORD_WEBHOOK_URL;
      if (!webhookUrl) {
        return { sent: false, reason: "No webhook URL configured" };
      }

      const stats = {
        total: feedback.length,
        negative: feedback.filter((f) => f.sentiment === "negative").length,
        highUrgency: feedback.filter((f) => f.urgency === "high").length,
      };

      const embed = {
        title: "📊 Daily Feedback Digest",
        description: summary,
        color: 0x5865f2,
        fields: [
          { name: "📝 Total Feedback", value: String(stats.total), inline: true },
          { name: "😞 Negative", value: String(stats.negative), inline: true },
          { name: "🔴 High Urgency", value: String(stats.highUrgency), inline: true },
        ],
        footer: { text: "Feedback Analyzer • Auto-generated digest" },
        timestamp: new Date().toISOString(),
      };

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [embed] }),
      });

      return { sent: res.ok, status: res.status };
    });

    return { status: "completed", discord: discordResult };
  }
}
