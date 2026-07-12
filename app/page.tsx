"use client";

import {
  ClipboardEvent,
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { ArrowUp, RotateCcw, X } from "lucide-react";
import { estimateTokens } from "../src/lib/tokenCounter";

type Role = "user" | "assistant";

type Source = {
  breadcrumb: string;
  score: number;
};

type ChatMessage = {
  id: string;
  role: Role;
  text: string;
  sources?: Source[];
  questionIndex?: number;
  streaming?: boolean;
  tone?: "normal" | "warning" | "error";
};

type QuotaInfo = {
  daily_used: number;
  minute_used: number;
  daily_limit: number;
  minute_limit: number;
};

type Notice = {
  id: string;
  text: string;
  tone?: "warning" | "info";
};

type FingerprintModule = {
  default?: {
    load?: () => Promise<{ get: () => Promise<{ visitorId?: string }> }>;
  };
  load?: () => Promise<{ get: () => Promise<{ visitorId?: string }> }>;
};

const API_BASE = "/api";
const SESSION_ID = `session_${Math.random().toString(36).slice(2)}_${Date.now()}`;
const TERMS_ACCEPTED_KEY = "bal_asistan_terms_accepted_v1";
const MAX_HISTORY_MESSAGES = 120;

const MAX_MESSAGE_TOKENS = 500;

function estimateRequestTokens(message: string) {
  return { messageTokens: estimateTokens(message) };
}

const SUGGESTION_GROUPS = [
  {
    id: "genel",
    label: "Genel",
    questions: [
      "BAL hakkında genel bilgi ver",
      "Bornova Anadolu Lisesi müdürü kim?",
      "BAL'ın tarihçesi nedir?",
      "BAL ruhu nedir?",
      "Kampüste hangi imkânlar var?",
      "Hazırlık sınıfı nasıl?",
    ],
  },
  {
    id: "kayit",
    label: "Kayıt ve tercih",
    questions: [
      "2025 LGS taban puanları nedir?",
      "Okula nasıl kayıt yapılır?",
      "BAL'a nakil şartları nelerdir?",
      "Dil bölümleri ve kontenjanları nasıl?",
      "Pansiyona nasıl başvurulur?",
      "Okulu ziyaret etmek için nasıl randevu alınır?",
    ],
  },
  {
    id: "akademik",
    label: "Akademik",
    questions: [
      "YKS başarıları nasıl?",
      "Yabancı dil eğitimi nasıl?",
      "DSD programı nedir?",
      "DELF-DALF sınav merkezi ne demek?",
      "AP dersleri nelerdir?",
      "Bilim ve matematik olimpiyatları nasıl?",
    ],
  },
  {
    id: "yasam",
    label: "Kültür ve yaşam",
    questions: [
      "Ayran Günü nedir?",
      "Hangi kulüp ve topluluklar var?",
      "BALÖDER nedir?",
      "BALEV bursu hakkında bilgi ver",
      "BALPOD nedir?",
      "Tiyatro, müzik ve spor faaliyetleri nasıl?",
    ],
  },
  {
    id: "ulasim",
    label: "Ulaşım ve saatler",
    questions: [
      "Okula nasıl giderim?",
      "Hangi otobüsler okula gidiyor?",
      "Servis güzergâhları nelerdir?",
      "Ders giriş ve çıkış saatleri nedir?",
      "Okulun adresi ve telefonu nedir?",
      "Kampüs haritasına nereden ulaşabilirim?",
    ],
  },
] as const;

const TERMS_PARAGRAPHS = [
  "BAL Asistan, Bornova Anadolu Lisesi hakkında genel bilgi sunmak amacıyla hazırlanmış bağımsız bir öğrenci projesidir; okul idaresi veya Milli Eğitim Bakanlığı adına resmi işlem yapmaz.",
  "Yanıtlar yalnızca bilgilendirme amaçlıdır. Kayıt, nakil, sınav, kontenjan, devamsızlık, burs, belge, dilekçe, disiplin, pansiyon ve benzeri resmi/idari konularda okul yönetimi, e-Okul, MEB ve okulun resmi duyuruları esas alınmalıdır.",
  "Yapay zeka yanıtları eksik, hatalı, yanlış anlaşılmış veya güncel olmayan bilgiler içerebilir. Önemli kararlar almadan önce bilgileri resmi kaynaklardan doğrulamak kullanıcının sorumluluğundadır.",
  "TC kimlik numarası, öğrenci numarası, telefon, adres, e-posta, şifre, sağlık bilgisi, aile bilgisi, not bilgisi veya başka kişisel/hassas bilgiler paylaşılmamalıdır.",
  "Başka öğrenciler, öğretmenler, personel veya okul topluluğu hakkında özel, küçük düşürücü, suçlayıcı, söylenti niteliğinde ya da kişisel veri içeren sorular sorulmamalıdır.",
  "Sisteme gönderilen sorular ve üretilen cevaplar; kaliteyi iyileştirmek, kötüye kullanımı önlemek, güvenliği sağlamak ve kullanım limitlerini uygulamak amacıyla kaydedilebilir.",
  "Bu asistan hukuki, tıbbi, psikolojik, mali veya resmi danışmanlık vermez. Acil, ciddi veya kişisel durumlarda ilgili uzmanlara, okul rehberlik servisine, okul idaresine ya da resmi kurumlara başvurulmalıdır.",
  "Devam ederek bu bilgilendirmeyi okuduğunu, BAL Asistanı yalnızca bilgilendirme amacıyla kullanacağını ve resmi konularda yetkili kaynakları esas alacağını kabul etmiş olursun.",
];

const ABOUT_PARAGRAPHS = [
  "BAL Asistan, Bornova Anadolu Lisesi ile ilgili bilgilere daha hızlı ve düzenli ulaşılabilmesi için geliştirilen yapay zeka destekli bir sohbet asistanıdır. Proje; okulun akademik yapısı, kampüsü, gelenekleri, ulaşım bilgileri, sosyal etkinlikleri ve sık sorulan konular hakkında kısa, anlaşılır ve kaynak odaklı yanıtlar vermeyi amaçlar.",
  "Asistan, hazırlanmış bilgi setinden ilgili parçaları bulur ve kullanıcının sorusuna göre yanıt üretir. Bu nedenle resmi bir okul sistemi değildir; bilgilendirme ve teknoloji geliştirme amacıyla hazırlanmış bir öğrenci çalışmasıdır.",
  "Proje kendi yapay zeka modelini eğitmez. Yanıt üretiminde öncelikli olarak Gemini modelleri kullanılır; BAL hakkında hazırlanan özel veri seti ve kaynak sistemi yanıtların okula özgü bilgilerle desteklenmesini sağlar.",
  "Web sitesi Next.js ile geliştirilmiştir. Veri seti düzenlenebilir ve kaynak metninden yeniden indekslenebilir.",
  "Proje şu anda test aşamasındadır. Yanıt kalitesi, kaynak kapsamı ve kullanıcı deneyimi zamanla geliştirilebilir.",
];

const INITIAL_QUOTA: QuotaInfo = {
  daily_used: 0,
  minute_used: 0,
  daily_limit: 30,
  minute_limit: 5,
};

export default function Home() {
  const [gateOpen, setGateOpen] = useState<boolean | null>(null);
  const [activeGateTab, setActiveGateTab] = useState<"terms" | "about">(
    "terms",
  );
  const [visitedGateTabs, setVisitedGateTabs] = useState({
    terms: true,
    about: false,
  });
  const [gateChecked, setGateChecked] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [quota, setQuota] = useState<QuotaInfo>(INITIAL_QUOTA);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [fingerprint, setFingerprint] = useState("");
  const [welcomeVisible, setWelcomeVisible] = useState(true);
  const [tokenEstimate, setTokenEstimate] = useState({ messageTokens: 0 });

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const stickToBottom = useRef(true);
  const noticeIds = useRef(new Set<string>());
  const fallbackModels = useRef(new Set<string>());

  useEffect(() => {
    try {
      const accepted = window.localStorage.getItem(TERMS_ACCEPTED_KEY) === "true";
      setGateChecked(accepted);
      setGateOpen(!accepted);
    } catch {
      setGateOpen(true);
    }
  }, []);

  const remainingDaily = Math.max(quota.daily_limit - quota.daily_used, 0);
  const remainingMinute = Math.max(quota.minute_limit - quota.minute_used, 0);

  const addNotice = useCallback((notice: Notice) => {
    if (noticeIds.current.has(notice.id)) return;
    noticeIds.current.add(notice.id);
    setNotices((current) => [...current, notice]);
  }, []);

  const dismissNotice = useCallback((id: string) => {
    noticeIds.current.delete(id);
    setNotices((current) => current.filter((notice) => notice.id !== id));
  }, []);

  const headersForApi = useCallback(
    (extra?: HeadersInit) => ({
      "Content-Type": "application/json",
      ...(fingerprint ? { "X-Client-Fingerprint": fingerprint } : {}),
      ...(extra || {}),
    }),
    [fingerprint],
  );

  const loadAuthStatus = useCallback(async () => {
    if (!fingerprint) return;
    try {
      const response = await fetch(`${API_BASE}/auth/status`, {
        credentials: "same-origin",
        headers: headersForApi(),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) return;
      setQuota({
        daily_used: numberOr(data.daily_used, 0),
        minute_used: numberOr(data.minute_used, 0),
        daily_limit: numberOr(data.daily_limit, 30),
        minute_limit: numberOr(data.minute_limit, 5),
      });
    } catch {
      // Quota display is helpful, not required for chat.
    }
  }, [fingerprint, headersForApi]);

  useEffect(() => {
    let cancelled = false;
    resolveFingerprint().then((value) => {
      if (!cancelled) setFingerprint(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    loadAuthStatus();
  }, [loadAuthStatus]);

  function handleMessagesScroll() {
    const element = messagesRef.current;
    if (!element) return;
    stickToBottom.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < 120;
  }

  useEffect(() => {
    const element = messagesRef.current;
    if (!element || !stickToBottom.current) return;
    element.scrollTo({
      top: element.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    if (remainingDaily <= 10) {
      addNotice({
        id: "quota-low-daily",
        tone: "warning",
        text:
          remainingDaily === 0
            ? "Günlük soru hakkın doldu."
            : `Hakkın az kaldı. Bugün ${remainingDaily} soru hakkın var.`,
      });
    }
    if (remainingMinute <= 1) {
      addNotice({
        id: "quota-low-minute",
        tone: "warning",
        text: "Dakikalık soru limitine yaklaştın. Birazdan tekrar deneyebilirsin.",
      });
    }
  }, [addNotice, remainingDaily, remainingMinute]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  }, [input]);

  const welcome = useMemo(
    () => ({
      title: messages.length ? "" : "BAL hakkında ne öğrenmek istersin?",
      description:
        "Bornova Anadolu Lisesi'nin akademik yapısı, kampüsü, gelenekleri, kayıt süreci ve başarıları hakkında kısa ve kaynaklı yanıtlar al.",
    }),
    [messages.length],
  );

  async function sendMessage(value = input) {
    const message = value.trim();
    if (
      !message ||
      isStreaming ||
      !fingerprint ||
      estimateTokens(message) > MAX_MESSAGE_TOKENS
    ) {
      return;
    }

    const assistantId = createId();
    stickToBottom.current = true;
    setIsStreaming(true);
    setInput("");
    setTokenEstimate({ messageTokens: 0 });
    setMessages((current) => [
      ...current,
      { id: createId(), role: "user", text: message },
      { id: assistantId, role: "assistant", text: "", streaming: true },
    ]);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        credentials: "same-origin",
        headers: headersForApi(),
        body: JSON.stringify({
          message,
          session_id: SESSION_ID,
          history: messages
            .filter(
              (item) =>
                item.text.trim() &&
                !item.streaming &&
                item.tone !== "error",
            )
            .slice(-MAX_HISTORY_MESSAGES)
            .map((item) => ({ role: item.role, content: item.text })),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const userMessage =
          data?.error_type === "quota"
            ? data?.error || "Limit aşıldı."
            : "Teknik bir sorun oluştu. Lütfen daha sonra tekrar deneyin.";
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantId
              ? {
                  ...item,
                  text: userMessage,
                  streaming: false,
                  tone: "warning",
                }
              : item,
          ),
        );
        return;
      }

      if (!response.body) {
        throw new Error("Boş yanıt alındı.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let rawText = "";
      let displayedText = "";
      let buffer = "";
      let renderTimer: number | null = null;
      let pendingDone: {
        sources: Source[];
        questionIndex?: number;
      } | null = null;
      const renderCharsPerTick = 3;
      const renderIntervalMs = 32;

      const renderStep = () => {
        if (displayedText.length >= rawText.length) return;
        displayedText = rawText.slice(
          0,
          Math.min(
            displayedText.length + renderCharsPerTick,
            rawText.length,
          ),
        );
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantId
              ? {
                  ...item,
                  text: stripReasoningText(displayedText, false),
                  streaming: true,
                }
              : item,
          ),
        );
      };

      const requestRender = () => {
        if (renderTimer !== null) return;
        renderTimer = window.setTimeout(() => {
          renderTimer = null;
          renderStep();
          if (displayedText.length < rawText.length) requestRender();
        }, renderIntervalMs);
      };

      const drainRenderedText = () =>
        new Promise<void>((resolve) => {
          if (renderTimer !== null) {
            window.clearTimeout(renderTimer);
            renderTimer = null;
          }

          const drain = () => {
            renderStep();
            if (displayedText.length >= rawText.length) {
              resolve();
            } else {
              window.setTimeout(drain, renderIntervalMs);
            }
          };
          drain();
        });

      const processLine = (line: string) => {
        if (!line.startsWith("data: ")) return;
        const data = JSON.parse(line.slice(6));

        if (data.token) {
          rawText += data.token;
          requestRender();
        }

        if (data.error) {
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantId
                ? {
                    ...item,
                    text:
                      data.error_type === "quota"
                        ? data.error
                        : "Teknik bir sorun oluştu. Lütfen daha sonra tekrar deneyin.",
                    streaming: false,
                    tone: data.error_type === "quota" ? "warning" : "error",
                  }
                : item,
            ),
          );
        }

        if (data.congestion) {
          addNotice({
            id: "congestion",
            tone: "warning",
            text: "Şu anda yoğunluk var, yanıtlar normalden geç gelebilir.",
          });
        }

        if (data.model_fallback) {
          const targetModel = data.model_fallback.to_model || "unknown";
          if (!fallbackModels.current.has(targetModel)) {
            fallbackModels.current.add(targetModel);
            addNotice({
              id: `fallback-${targetModel}`,
              tone: "info",
              text: "Yoğunluk nedeniyle farklı bir model kullanılıyor.",
            });
          }
        }

        if (data.search_grounding) {
          addNotice({
            id: "search-grounding",
            tone: "info",
            text: "Bu yanıt güncel Google Search sonuçlarıyla desteklendi.",
          });
        }

        if (data.done) {
          pendingDone = {
            sources: Array.isArray(data.sources) ? data.sources : [],
            questionIndex:
              typeof data.question_index === "number"
                ? data.question_index
                : undefined,
          };
        }
      };

      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          break;
        }

        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.trim()) processLine(line.trim());
        }
      }

      if (buffer.trim()) processLine(buffer.trim());
      await drainRenderedText();
      if (pendingDone) {
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantId
              ? {
                  ...item,
                  text: stripReasoningText(rawText),
                  streaming: false,
                  sources: pendingDone?.sources || [],
                  questionIndex: pendingDone?.questionIndex,
                }
              : item,
          ),
        );
      }
      await loadAuthStatus();
    } catch {
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                text: "Teknik bir sorun oluştu. Lütfen daha sonra tekrar deneyin.",
                streaming: false,
                tone: "error",
              }
            : item,
        ),
      );
    } finally {
      setIsStreaming(false);
    }
  }

  async function clearChat() {
    try {
      await fetch(`${API_BASE}/clear`, {
        method: "POST",
        credentials: "same-origin",
        headers: headersForApi(),
        body: JSON.stringify({ session_id: SESSION_ID }),
      });
    } catch {
      // Local UI can still be cleared.
    }
    setMessages([]);
    setInput("");
    setTokenEstimate({ messageTokens: 0 });
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage();
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function handleInputPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = event.clipboardData.getData("text");
    if (!pasted) return;

    event.preventDefault();
    const textarea = event.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextValue = `${input.slice(0, start)}${pasted}${input.slice(end)}`;
    setInput(nextValue);
    setTokenEstimate(estimateRequestTokens(nextValue));
    window.requestAnimationFrame(() => {
      const nextCursor = start + pasted.length;
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  }

  if (gateOpen === null) {
    return (
      <main className="app-shell">
        <div className="app-loading">BAL Asistan yükleniyor...</div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      {gateOpen ? (
        <EntryGate
          activeTab={activeGateTab}
          checked={gateChecked}
          onChangeChecked={setGateChecked}
          visitedTabs={visitedGateTabs}
          onChangeTab={(tab) => {
            setActiveGateTab(tab);
            setVisitedGateTabs((current) => ({ ...current, [tab]: true }));
          }}
          onContinue={() => {
            if (!gateChecked) return;
            window.localStorage.setItem(TERMS_ACCEPTED_KEY, "true");
            setGateOpen(false);
            window.setTimeout(() => inputRef.current?.focus(), 0);
          }}
        />
      ) : (
        <>
          <header className="topbar">
            <div className="brand-lockup">
              <img src="/BAL_Logo.png" alt="Bornova Anadolu Lisesi logosu" />
              <div>
                <p>BAL Asistan</p>
                <span>Bornova Anadolu Lisesi bilgi asistanı</span>
              </div>
            </div>
            <nav className="topbar-actions" aria-label="Sayfa bağlantıları">
              <Link className="about-link" href="/hakkinda">
                Hakkında
              </Link>
              <Link className="suggestion-link" href="/oneriler">
                <span aria-hidden="true">+</span>
                Bilgi / Öneri Ekle
              </Link>
            </nav>
          </header>

          <section className="chat-layout">
            <div className="messages" ref={messagesRef} onScroll={handleMessagesScroll}>
              {!messages.length ? (
                <Welcome
                  title={welcome.title}
                  description={welcome.description}
                  onSuggestion={sendMessage}
                  introVisible={welcomeVisible}
                  onDismiss={() => setWelcomeVisible(false)}
                />
              ) : null}

              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  fingerprintReady={Boolean(fingerprint)}
                  headersForApi={headersForApi}
                />
              ))}
            </div>

            <div className="composer-zone">
              {notices.length ? (
                <div className="notice-stack" aria-live="polite">
                  {notices.map((notice) => (
                    <div
                      className={`notice ${notice.tone || "info"}`}
                      key={notice.id}
                    >
                      <span>{notice.text}</span>
                      <button
                        type="button"
                        onClick={() => dismissNotice(notice.id)}
                        aria-label="Bildirimi kapat"
                      >
                        <X aria-hidden="true" size={14} strokeWidth={2.2} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <form className="composer" onSubmit={submitForm}>
                <textarea
                  ref={inputRef}
                  value={input}
                  rows={1}
                  placeholder={
                    fingerprint
                      ? "BAL hakkında bir soru sor..."
                      : "Kimlik hazırlanıyor..."
                  }
                  onChange={(event) => {
                    const value = event.target.value;
                    setInput(value);
                    setTokenEstimate(estimateRequestTokens(value));
                  }}
                  onKeyDown={handleInputKeyDown}
                  onPaste={handleInputPaste}
                  disabled={isStreaming || !fingerprint}
                />
                <div className="composer-actions">
                  {tokenEstimate.messageTokens > 100 ? (
                    <span className="token-meter">
                      {tokenEstimate.messageTokens} / {MAX_MESSAGE_TOKENS} token
                      {tokenEstimate.messageTokens > MAX_MESSAGE_TOKENS
                        ? " · Çok uzun"
                        : ""}
                    </span>
                  ) : null}
                  <button
                    className="icon-button"
                    type="button"
                    onClick={clearChat}
                    title="Sohbeti temizle"
                  >
                    <RotateCcw aria-hidden="true" size={17} strokeWidth={2.2} />
                  </button>
                  <button
                    className="send-button"
                    type="submit"
                    disabled={
                      !input.trim() ||
                      isStreaming ||
                      !fingerprint ||
                      tokenEstimate.messageTokens > MAX_MESSAGE_TOKENS
                    }
                    aria-label="Mesaj gönder"
                    title={
                      tokenEstimate.messageTokens > MAX_MESSAGE_TOKENS
                        ? "Mesaj çok uzun. Lütfen kısaltın."
                        : ""
                    }
                  >
                    <ArrowUp aria-hidden="true" size={19} strokeWidth={2.25} />
                  </button>
                </div>
              </form>

              <footer className="site-footer">
                Bu website <a className="credit-link" href="https://www.instagram.com/emre.bozqurt" target="_blank" rel="noreferrer">Emre Bozkurt&apos;28</a> tarafından yapılmıştır.
              </footer>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function EntryGate({
  activeTab,
  checked,
  visitedTabs,
  onChangeTab,
  onChangeChecked,
  onContinue,
}: {
  activeTab: "terms" | "about";
  checked: boolean;
  visitedTabs: { terms: boolean; about: boolean };
  onChangeTab: (tab: "terms" | "about") => void;
  onChangeChecked: (checked: boolean) => void;
  onContinue: () => void;
}) {
  const gateStatus = checked
    ? "Hazır. Devam ederek BAL Asistanı açabilirsin."
    : "Devam etmek için onay kutusunu işaretle.";

  return (
    <section className="gate">
      <div className="gate-hero">
        <img src="/BAL_Logo.png" alt="Bornova Anadolu Lisesi logosu" />
        <p className="eyebrow">Bornova Anadolu Lisesi</p>
        <h1>BAL Asistan</h1>
        <p className="gate-copy">
          Bornova Anadolu Lisesi hakkında hızlı, sade ve kaynaklı bilgi almak
          için geliştirilen yapay zeka destekli öğrenci projesi.
        </p>
        <div className="gate-meta">
          <span>Bilgilendirme amaçlıdır.</span>
          <span>
            Resmi işlemlerde okul idaresi ve MEB kaynakları esas alınır.
          </span>
        </div>
      </div>

      <div className="gate-panel">
        <div className="gate-dev-warning">
          Bu asistan geliştirme aşamasındadır; vereceği yanıtlar eksik veya
          hatalı olabilir. Kullanıcı geri bildirimleriyle sürekli
          iyileştirilmektedir.
        </div>

        <div className="gate-tabs" role="tablist" aria-label="Giriş bilgileri">
          <button
            type="button"
            className={`${activeTab === "terms" ? "active" : ""} ${visitedTabs.terms ? "visited" : ""}`}
            onClick={() => onChangeTab("terms")}
            role="tab"
            aria-selected={activeTab === "terms"}
          >
            Kullanım Şartları
          </button>
          <button
            type="button"
            className={`${activeTab === "about" ? "active" : ""} ${visitedTabs.about ? "visited" : ""}`}
            onClick={() => onChangeTab("about")}
            role="tab"
            aria-selected={activeTab === "about"}
          >
            Proje Hakkında
          </button>
        </div>

        <div className="gate-content">
          {activeTab === "terms" ? (
            <div>
              <h2>Kullanım Şartları</h2>
              {TERMS_PARAGRAPHS.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          ) : (
            <div>
              <h2>Proje Hakkında</h2>
              <div className="gate-author">
                Bu Websiteyi Hazırlayan: <a className="credit-link" href="https://www.instagram.com/emre.bozqurt" target="_blank" rel="noreferrer">Emre Bozkurt&apos;28</a> - 10/C
                <br />
                Veri Hazırlamada Yardımcı: Burak Güldilek'29 - 9/K
              </div>
              {ABOUT_PARAGRAPHS.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              <p className="gate-dev-note">
                Bu asistan geliştirme aşamasındadır; vereceği yanıtlar eksik
                veya hatalı olabilir. Kullanıcı geri bildirimleriyle sürekli
                iyileştirilmektedir.
              </p>
            </div>
          )}
        </div>

        <label className="gate-check">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onChangeChecked(event.target.checked)}
          />
          <span>
            Kullanım şartlarını ve proje bilgilendirmesini okudum, anladım ve
            kabul ediyorum.
          </span>
        </label>

        <div className="gate-status">{gateStatus}</div>
        <button
          className="gate-continue"
          type="button"
          disabled={!checked}
          onClick={onContinue}
        >
          Devam Et
        </button>
      </div>
    </section>
  );
}

function Welcome({
  title,
  description,
  onSuggestion,
  introVisible,
  onDismiss,
}: {
  title: string;
  description: string;
  onSuggestion: (value: string) => void;
  introVisible: boolean;
  onDismiss: () => void;
}) {
  const [activeGroupId, setActiveGroupId] = useState<string>(
    SUGGESTION_GROUPS[0].id,
  );
  const activeGroup =
    SUGGESTION_GROUPS.find((group) => group.id === activeGroupId) ||
    SUGGESTION_GROUPS[0];

  return (
    <section className="welcome">
      {introVisible ? (
        <div className="welcome-intro">
          <button
            className="welcome-close"
            type="button"
            onClick={onDismiss}
            aria-label="BAL hakkında bilgi panelini kapat"
            title="Kapat"
          >
            <X aria-hidden="true" size={22} strokeWidth={1.8} />
          </button>
          <img src="/BAL_Logo.png" alt="BAL" />
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      ) : null}
      <div className="suggestion-tabs" role="tablist" aria-label="Hazır soru kategorileri">
        {SUGGESTION_GROUPS.map((group) => (
          <button
            aria-selected={group.id === activeGroup.id}
            className={group.id === activeGroup.id ? "active" : ""}
            key={group.id}
            onClick={() => setActiveGroupId(group.id)}
            role="tab"
            type="button"
          >
            {group.label}
          </button>
        ))}
      </div>
      <div className="suggestions">
        {activeGroup.questions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onSuggestion(suggestion)}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </section>
  );
}

function MessageBubble({
  message,
  fingerprintReady,
  headersForApi,
}: {
  message: ChatMessage;
  fingerprintReady: boolean;
  headersForApi: (extra?: HeadersInit) => HeadersInit;
}) {
  return (
    <article className={`message-row ${message.role}`}>
      {message.role === "assistant" ? (
        <img
          className="message-avatar"
          src="/BAL_Logo.png"
          alt="BAL Asistan"
        />
      ) : null}
      <div className="message-content">
        {message.role === "assistant" ? (
          <span className="message-identity">BAL Asistan</span>
        ) : null}
        <div className={`bubble ${message.tone || "normal"}`}>
          {message.streaming && !message.text ? (
            <span className="typing" aria-label="Yanıt hazırlanıyor">
              <i />
              <i />
              <i />
            </span>
          ) : (
            <div
              dangerouslySetInnerHTML={{ __html: formatMessage(message.text) }}
            />
          )}
        </div>

      {/*{message.sources?.length ? (
        <div className="sources" aria-label="Kaynaklar">
          {message.sources.slice(0, 3).map((source) => (
            <span key={`${source.breadcrumb}-${source.score}`}>
              {source.breadcrumb || "Kaynak"} · {source.score}
            </span>
          ))}
        </div>
      ) : null} */}

        {message.questionIndex && fingerprintReady ? (
          <FeedbackBar
            questionIndex={message.questionIndex}
            headersForApi={headersForApi}
          />
        ) : null}
      </div>
    </article>
  );
}

function FeedbackBar({
  questionIndex,
  headersForApi,
}: {
  questionIndex: number;
  headersForApi: (extra?: HeadersInit) => HeadersInit;
}) {
  const [active, setActive] = useState<"like" | "dislike" | null>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [thanks, setThanks] = useState(false);

  async function sendFeedback(type: "like" | "dislike") {
    setActive(type);
    fetch(`${API_BASE}/chat/feedback`, {
      method: "POST",
      credentials: "same-origin",
      headers: headersForApi(),
      body: JSON.stringify({ question_index: questionIndex, feedback: type }),
    }).catch(() => undefined);
  }

  async function sendTextFeedback() {
    const value = text.trim();
    if (!value) {
      setOpen(false);
      return;
    }
    setOpen(false);
    setText("");
    setThanks(true);
    window.setTimeout(() => setThanks(false), 2400);
    fetch(`${API_BASE}/chat/feedback`, {
      method: "POST",
      credentials: "same-origin",
      headers: headersForApi(),
      body: JSON.stringify({
        question_index: questionIndex,
        feedback_text: value,
      }),
    }).catch(() => undefined);
  }

  return (
    <div className="feedback">
      <div className="feedback-buttons">
        <button
          type="button"
          className={active === "like" ? "active" : ""}
          onClick={() => sendFeedback("like")}
          title="Yararlı"
        >
          ↑
        </button>
        <button
          type="button"
          className={active === "dislike" ? "active" : ""}
          onClick={() => sendFeedback("dislike")}
          title="Yanlış veya yetersiz"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          title="Geri bildirim yaz"
        >
          ✎
        </button>
      </div>

      {open ? (
        <div className="feedback-box">
          <textarea
            value={text}
            maxLength={500}
            rows={2}
            placeholder="Geri bildiriminizi yazın..."
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendTextFeedback();
              }
            }}
          />
          <div>
            <button type="button" onClick={() => setOpen(false)}>
              İptal
            </button>
            <button type="button" onClick={sendTextFeedback}>
              Gönder
            </button>
          </div>
        </div>
      ) : null}

      {thanks ? (
        <span className="thanks">Geri bildiriminiz için teşekkür ederiz.</span>
      ) : null}
    </div>
  );
}

async function resolveFingerprint() {
  try {
    const modulePath = "/vendor/fingerprintjs/fp.esm.js";
    const mod = (await import(
      /* webpackIgnore: true */ modulePath
    )) as FingerprintModule;
    const load = mod.load || mod.default?.load;
    const agent = load ? await load() : null;
    const result = agent ? await agent.get() : null;
    if (result?.visitorId) return result.visitorId;
  } catch {
    // Fall back to a stable local anonymous id.
  }

  const key = "bal_local_fingerprint";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const generated = `bal_${createId().replace(/-/g, "")}`;
  window.localStorage.setItem(key, generated);
  return generated;
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stripReasoningText(text: string, trim = true) {
  const cleaned = text
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi, "")
    .replace(/<think\b[^>]*>[\s\S]*$/gi, "")
    .replace(/<thinking\b[^>]*>[\s\S]*$/gi, "")
  return trim ? cleaned.trim() : cleaned;
}

function formatMessage(text: string) {
  if (!text.trim()) return "";

  const escaped = escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
    )
    .replace(/^(#{1,3})\s+(.+)$/gm, "<strong>$2</strong>");

  const blocks = escaped
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      if (lines.every((line) => /^[-*]\s+/.test(line))) {
        return `<ul>${lines.map((line) => `<li>${line.replace(/^[-*]\s+/, "")}</li>`).join("")}</ul>`;
      }
      return `<p>${block.replace(/\n/g, "<br />")}</p>`;
    });

  return blocks.join("");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
