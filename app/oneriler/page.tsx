"use client";

import { FormEvent, useState, useEffect } from "react";
import Link from "next/link";

export default function SuggestionsPage() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [fingerprint, setFingerprint] = useState("");

  useEffect(() => {
    const key = "bal_local_fingerprint";
    let fp = window.localStorage.getItem(key);
    if (!fp) {
      fp = `bal_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(key, fp);
    }
    setFingerprint(fp);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanContent = content.trim();
    if (!cleanContent) return;

    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const response = await fetch("/api/suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(fingerprint ? { "X-Client-Fingerprint": fingerprint } : {}),
        },
        body: JSON.stringify({ content: cleanContent }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Öneri gönderilemedi.");
      }

      setSuccess(true);
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell" style={{ overflowY: "auto" }}>
      <header className="topbar">
        <Link href="/" style={{ textDecoration: "none" }} className="brand-lockup">
          <img src="/BAL_Logo.png" alt="Bornova Anadolu Lisesi logosu" />
          <div>
            <p>BAL Asistan</p>
            <span>Ana Sayfa</span>
          </div>
        </Link>
      </header>

      <section style={{ maxWidth: "600px", width: "100%", margin: "40px auto", padding: "0 20px" }}>
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "30px",
          boxShadow: "var(--shadow-md)"
        }}>
          <h1 style={{ fontSize: "1.8rem", fontWeight: "780", margin: "0 0 10px 0", color: "var(--text)" }}>Bilgi / Öneri Ekle</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.95rem", lineHeight: "1.5", margin: "0 0 24px 0" }}>
            BAL Asistan yapay zekasının Bornova Anadolu Lisesi hakkında bilmesi veya yanıtlaması gerektiğini düşündüğünüz bilgileri, kuralları veya düzeltmeleri buradan iletebilirsiniz. Admin paneli üzerinden incelenip asistanın bilgi setine eklenecektir.
          </p>

          {error && (
            <div style={{
              background: "#fee2e2",
              border: "1px solid #fca5a5",
              color: "#b91c1c",
              borderRadius: "10px",
              padding: "12px",
              fontSize: "0.9rem",
              marginBottom: "16px"
            }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              color: "#047857",
              borderRadius: "10px",
              padding: "12px",
              fontSize: "0.9rem",
              marginBottom: "16px"
            }}>
              Öneriniz başarıyla kaydedildi. Katkınız için teşekkür ederiz!
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "20px" }}>
              <label htmlFor="content" style={{ display: "block", fontSize: "0.9rem", fontWeight: "700", marginBottom: "8px", color: "var(--text)" }}>
                Öneriniz veya Eklemek İstediğiniz Bilgi
              </label>
              <textarea
                id="content"
                rows={6}
                value={content}
                maxLength={2000}
                placeholder="Örn: Bornova Anadolu Lisesi'nde her yıl düzenlenen Ayran Günü etkinliği Haziran ayının ilk pazar günü yapılır..."
                onChange={(e) => setContent(e.target.value)}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  background: "var(--surface-muted)",
                  color: "var(--text)",
                  resize: "vertical",
                  minHeight: "120px",
                  outline: "none"
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--muted)", marginTop: "6px" }}>
                <span>Katkıda bulunarak asistanı iyileştirin.</span>
                <span>{content.length} / 2000</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={!content.trim() || loading}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                border: "none",
                background: "var(--brand)",
                color: "#fff",
                fontWeight: "700",
                fontSize: "0.95rem",
                cursor: "pointer",
                boxShadow: "var(--shadow-sm)",
                transition: "background 0.15s ease"
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "var(--brand-strong)")}
              onMouseOut={(e) => (e.currentTarget.style.background = "var(--brand)")}
            >
              {loading ? "Gönderiliyor..." : "Öneriyi Gönder"}
            </button>
          </form>
        </div>
        <div style={{ textAlign: "center", marginTop: "24px" }}>
          <Link href="/" style={{ color: "var(--muted)", fontSize: "0.9rem", textDecoration: "none" }}>
            ← Ana Sayfaya Dön
          </Link>
        </div>
      </section>
    </main>
  );
}
