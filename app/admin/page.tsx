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

export default function AdminFeedbackPage() {
  const [password, setPassword] = useState("");
  const [records, setRecords] = useState<FeedbackRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function loadFeedback(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/feedback", {
        headers: { "X-Admin-Password": password },
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Geri bildirimler alınamadı.");
      setRecords(Array.isArray(data.feedback) ? data.feedback : []);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-shell">
      <section className="admin-header">
        <div>
          <p className="admin-kicker">BAL Asistan</p>
          <h1>Geri Bildirimler</h1>
        </div>
        <form className="admin-auth" onSubmit={loadFeedback}>
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

      <section className="feedback-list">
        {!loaded ? (
          <div className="admin-empty">Geri bildirimleri görmek için admin şifresini gir.</div>
        ) : records.length ? (
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
