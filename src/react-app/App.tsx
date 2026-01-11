import { useState, useEffect } from "react";
import "./App.css";

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

const SOURCE_ICONS: Record<string, string> = {
  email: "✉️",
  twitter: "𝕏",
  reddit: "💬",
};

const URGENCY_ICONS: Record<string, string> = {
  high: "🔴",
  medium: "🟡",
  low: "🟢",
};

function App() {
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [sentToDiscord, setSentToDiscord] = useState(false);

  // Filters
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterUrgency, setFilterUrgency] = useState<string>("all");
  const [filterSentiment, setFilterSentiment] = useState<string>("all");

  // Load and auto-analyze feedback
  useEffect(() => {
    const loadAndAnalyze = async () => {
      const res = await fetch("/api/feedback");
      const data: Feedback[] = await res.json();
      setFeedbackList(data);
      setLoading(false);

      // Auto-analyze any unanalyzed feedback
      const unanalyzed = data.filter((f) => !f.theme);
      for (const item of unanalyzed) {
        const analyzeRes = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id }),
        });
        const updated = await analyzeRes.json();
        setFeedbackList((prev) =>
          prev.map((f) => (f.id === item.id ? updated : f))
        );
      }
    };
    loadAndAnalyze();
  }, []);

  // Get Insights = Generate summary + Send to Discord
  const handleGetInsights = async () => {
    setLoadingInsights(true);
    setSentToDiscord(false);

    // Generate summary
    const summaryRes = await fetch("/api/summary", { method: "POST" });
    const summaryData = await summaryRes.json();
    setInsights(summaryData.summary || summaryData.error);

    // Send to Discord automatically
    await fetch("/api/send-digest", { method: "POST" });
    setSentToDiscord(true);

    setLoadingInsights(false);
  };

  // Apply filters
  const filteredFeedback = feedbackList.filter((f) => {
    if (filterSource !== "all" && f.source !== filterSource) return false;
    if (filterUrgency !== "all" && f.urgency !== filterUrgency) return false;
    if (filterSentiment !== "all" && f.sentiment !== filterSentiment) return false;
    return true;
  });

  const analyzedCount = feedbackList.filter((f) => f.theme).length;
  const sources = [...new Set(feedbackList.map((f) => f.source))];

  // Stats
  const stats = {
    total: feedbackList.length,
    negative: feedbackList.filter((f) => f.sentiment === "negative").length,
    positive: feedbackList.filter((f) => f.sentiment === "positive").length,
    highUrgency: feedbackList.filter((f) => f.urgency === "high").length,
  };

  return (
    <div className="app">
      <header>
        <h1>📊 Feedback Analyzer</h1>
        <p>AI-powered feedback aggregation for Product Managers</p>
      </header>

      <div className="layout">
        {/* Left: Feedback List */}
        <div className="feedback-panel">
          <div className="panel-header">
            <h2>📥 Incoming Feedback</h2>
            <span className="count">{feedbackList.length} items</span>
          </div>

          <div className="filters">
            <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
              <option value="all">All Sources</option>
              {sources.map((s) => (
                <option key={s} value={s}>{SOURCE_ICONS[s]} {s}</option>
              ))}
            </select>
            <select value={filterUrgency} onChange={(e) => setFilterUrgency(e.target.value)}>
              <option value="all">All Urgency</option>
              <option value="high">🔴 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">🟢 Low</option>
            </select>
            <select value={filterSentiment} onChange={(e) => setFilterSentiment(e.target.value)}>
              <option value="all">All Sentiment</option>
              <option value="negative">😞 Negative</option>
              <option value="positive">😊 Positive</option>
              <option value="neutral">😐 Neutral</option>
            </select>
          </div>

          <div className="feedback-list">
            {loading ? (
              <div className="loading">Loading feedback...</div>
            ) : (
              filteredFeedback.map((f) => (
                <div key={f.id} className={`feedback-card ${f.theme ? "" : "analyzing"}`}>
                  <div className="card-meta">
                    <span className="source">{SOURCE_ICONS[f.source]} {f.source}</span>
                    {f.urgency && (
                      <span className={`urgency urgency-${f.urgency}`}>
                        {URGENCY_ICONS[f.urgency]} {f.urgency}
                      </span>
                    )}
                  </div>
                  <p className="message">{f.message}</p>
                  {f.theme ? (
                    <div className="tags">
                      <span className={`tag sentiment-${f.sentiment}`}>{f.sentiment}</span>
                      <span className="tag theme">{f.theme}</span>
                    </div>
                  ) : (
                    <div className="analyzing-text">⏳ Analyzing...</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Insights Panel */}
        <div className="insights-panel">
          <div className="panel-header">
            <h2>💡 Insights</h2>
          </div>

          <div className="stats-grid">
            <div className="stat">
              <span className="stat-value">{stats.total}</span>
              <span className="stat-label">Total</span>
            </div>
            <div className="stat negative">
              <span className="stat-value">{stats.negative}</span>
              <span className="stat-label">Negative</span>
            </div>
            <div className="stat positive">
              <span className="stat-value">{stats.positive}</span>
              <span className="stat-label">Positive</span>
            </div>
            <div className="stat urgent">
              <span className="stat-value">{stats.highUrgency}</span>
              <span className="stat-label">High Urgency</span>
            </div>
          </div>

          <button
            className="insights-btn"
            onClick={handleGetInsights}
            disabled={loadingInsights || analyzedCount === 0}
          >
            {loadingInsights ? "⏳ Generating..." : "✨ Get Insights"}
          </button>

          {insights && (
            <div className="insights-content">
              <p>{insights}</p>
              {sentToDiscord && (
                <div className="discord-sent">
                  ✅ Sent to Discord
                </div>
              )}
            </div>
          )}

          {!insights && !loadingInsights && (
            <div className="insights-placeholder">
              Click "Get Insights" to generate an AI summary and automatically send it to your team's Discord.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
