"use client";

import { FormEvent, useState } from "react";

type FeedbackRecord = {
  id: number | null;
  user_id: number;
  question_index: number;
  question: string;
  answer: string;
  created_at: string;
  feedback: string | null;
  feedback_text: string | null;
};

type SuggestionRecord = {
  id: number | null;
  user_id: number;
  content: string;
  created_at: string;
};

export default function AdminFeedbackPage() {
  const [password, setPassword] = useState("");
  const [records, setRecords] = useState<FeedbackRecord[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"feedback" | "suggestions">("feedback");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function loadData(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Fetch Feedback
      const fbResponse = await fetch("/api/admin/feedback", {
        headers: { "X-Admin-Password": password },
        cache: "no-store",
      });
      const fbData = await fbResponse.json().catch(() => ({}));
      if (!fbResponse.ok) throw new Error(fbData.error || "Geri bildirimler alınamadı.");

      // Fetch Suggestions
      const sugResponse = await fetch("/api/admin/suggestions", {
        headers: { "X-Admin-Password": password },
        cache: "no-store",
      });
      const sugData = await sugResponse.json().catch(() => ({}));
      if (!sugResponse.ok) throw new Error(sugData.error || "Öneriler alınamadı.");

      setRecords(Array.isArray(fbData.feedback) ? fbData.feedback : []);
      setSuggestions(Array.isArray(sugData.suggestions) ? sugData.suggestions : []);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-shell" style={{ overflowY: "auto" }}>
      <section className="admin-header">
        <div>
          <p className="admin-kicker">BAL Asistan</p>
          <h1>Yönetici Paneli</h1>
        </div>
        <form className="admin-auth" onSubmit={loadData}>
          <input
            type="password"
            value={password}
            placeholder="Admin şifresi"
            onChange={(event) => setPassword(event.target.value)}
          />
          <button type="submit" disabled={!password || loading}>
            {loading ? "Yükleniyor" : loaded ? "Yenile" : "Giriş"}
          </button>
        </form>
      </section>

      {error ? <div className="admin-error">{error}</div> : null}

      {loaded && (
        <div style={{ display: "flex", gap: "10px", margin: "20px 0", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
          <button
            type="button"
            onClick={() => setActiveTab("feedback")}
            style={{
              padding: "10px 20px",
              background: activeTab === "feedback" ? "var(--brand)" : "transparent",
              color: activeTab === "feedback" ? "#fff" : "var(--muted)",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold",
              transition: "background 0.15s ease, color 0.15s ease"
            }}
          >
            Geri Bildirimler ({records.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("suggestions")}
            style={{
              padding: "10px 20px",
              background: activeTab === "suggestions" ? "var(--brand)" : "transparent",
              color: activeTab === "suggestions" ? "#fff" : "var(--muted)",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold",
              transition: "background 0.15s ease, color 0.15s ease"
            }}
          >
            Öneriler ({suggestions.length})
          </button>
        </div>
      )}

      <section className="feedback-list">
        {!loaded ? (
          <div className="admin-empty">Verileri görmek için admin şifresini gir.</div>
        ) : activeTab === "feedback" ? (
          records.length ? (
            records.map((record) => (
              <article className="feedback-card" key={`${record.user_id}-${record.question_index}-${record.id || ""}`}>
                <div className="feedback-card-meta">
                  <span>Kullanıcı #{record.user_id}</span>
                  <span>Soru #{record.question_index}</span>
                  <span>{formatDate(record.created_at)}</span>
                  {record.feedback ? <strong>{record.feedback}</strong> : null}
                </div>
                <h2>{record.question}</h2>
                <p className="feedback-answer">{record.answer}</p>
                {record.feedback_text ? <p className="feedback-text">{record.feedback_text}</p> : null}
              </article>
            ))
          ) : (
            <div className="admin-empty">Henüz geri bildirim yok.</div>
          )
        ) : (
          suggestions.length ? (
            suggestions.map((suggestion, idx) => (
              <article className="feedback-card" key={suggestion.id || idx}>
                <div className="feedback-card-meta">
                  <span>Kullanıcı #{suggestion.user_id}</span>
                  <span>{formatDate(suggestion.created_at)}</span>
                </div>
                <p style={{ whiteSpace: "pre-wrap", margin: "15px 0 0 0", color: "var(--text)", lineHeight: "1.6" }}>{suggestion.content}</p>
              </article>
            ))
          ) : (
            <div className="admin-empty">Henüz öneri yok.</div>
          )
        )}
      </section>
    </main>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
