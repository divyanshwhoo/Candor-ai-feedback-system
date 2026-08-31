import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Star, QrCode, TrendingUp, TrendingDown, MessageSquare, Users,
  ArrowRight, Check, ChevronLeft, Smile, Meh, Frown, BarChart3,
  Inbox, Settings, LayoutDashboard, Sparkles, Filter, Search,
  Building2, MapPin, Clock, AlertCircle, RefreshCw
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip, LineChart, Line, PieChart, Pie, Cell
} from "recharts";

/* ---------------------------------------------------------------
   CANDOR — feedback & rating platform for service businesses
   Design: ink-green + warm brass on a cool paper ground.
   Serif display (headline voice) / system sans (working voice).
--------------------------------------------------------------- */

const INK = "#122A22";
const INK_SOFT = "#1E3A30";
const PAPER = "#F4F6F3";
const PAPER_DIM = "#E9ECE6";
const BRASS = "#C89A4A";
const BRASS_DIM = "#E4CFA0";
const SAGE = "#7C9A87";
const CORAL = "#C1583F";
const LINE = "#D9DDD3";

const FONT_SERIF = "'Iowan Old Style','Palatino Linotype',Georgia,ui-serif,serif";
const FONT_SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif";

const STORAGE_KEY = "candor:responses:demo-cafe";

// ---------- mock sentiment engine (stands in for a real AI call) ----------
const POS_WORDS = ["great","amazing","love","excellent","friendly","fast","clean","delicious","helpful","perfect","wonderful","fresh","cozy","best"];
const NEG_WORDS = ["slow","rude","cold","dirty","late","bad","terrible","waited","wait","overpriced","disappointed","noisy","broken","never"];

function analyzeSentiment(rating, text) {
  const t = (text || "").toLowerCase();
  let score = (rating - 3) / 2; // -1..1 from rating
  let posHits = [], negHits = [];
  POS_WORDS.forEach(w => { if (t.includes(w)) posHits.push(w); });
  NEG_WORDS.forEach(w => { if (t.includes(w)) negHits.push(w); });
  score += posHits.length * 0.15 - negHits.length * 0.2;
  score = Math.max(-1, Math.min(1, score));
  let label = "Neutral";
  if (score > 0.2) label = "Positive";
  if (score < -0.2) label = "Negative";
  if (posHits.length && negHits.length) label = "Mixed";
  return {
    label,
    score: Math.round(score * 100) / 100,
    topics: [...new Set([...posHits, ...negHits])].slice(0, 3),
  };
}

// ---------- real AI sentiment analysis (Claude), with heuristic fallback ----------
async function callClaudeJSON(prompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  const data = await response.json();
  const text = data.content.map(b => (b.type === "text" ? b.text : "")).join("").trim();
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

async function analyzeSentimentAI(rating, comment) {
  if (!comment || !comment.trim()) {
    return { ...analyzeSentiment(rating, comment), source: "heuristic" };
  }
  try {
    const prompt = `You are a sentiment analysis engine for customer feedback at a small service business. Given a 1-5 star rating and a comment, classify sentiment and extract topics.

Rating: ${rating}/5
Comment: "${comment.replace(/"/g, "'")}"

Respond ONLY with JSON, no preamble, no markdown fences, exactly this shape:
{"label": "Positive" | "Neutral" | "Mixed" | "Negative", "score": <number from -1 to 1>, "topics": [<1-3 short lowercase phrases naming what the comment is about, e.g. "service speed", "food quality">]}`;
    const parsed = await callClaudeJSON(prompt);
    return {
      label: parsed.label || "Neutral",
      score: typeof parsed.score === "number" ? parsed.score : 0,
      topics: Array.isArray(parsed.topics) ? parsed.topics.slice(0, 3) : [],
      source: "ai",
    };
  } catch (err) {
    return { ...analyzeSentiment(rating, comment), source: "heuristic" };
  }
}

async function generateAIInsights(entries, businessName) {
  const withComments = entries.filter(e => e.comment && e.comment.trim());
  if (withComments.length < 3) {
    throw new Error("Not enough written feedback yet");
  }
  const sample = withComments.slice(0, 30)
    .map(e => `Rating ${e.rating}/5: "${e.comment}"`)
    .join("\n");
  const prompt = `You are analyzing recent customer feedback for ${businessName}. Here are recent responses:

${sample}

Write exactly 3 short, concrete insights a business owner could act on — a recurring complaint, a genuine strength, or a notable pattern. Each under 20 words, plain language, no preamble. Respond ONLY with JSON: {"insights": ["...", "...", "..."]}`;
  const parsed = await callClaudeJSON(prompt);
  if (!Array.isArray(parsed.insights) || parsed.insights.length === 0) {
    throw new Error("No insights returned");
  }
  return parsed.insights;
}

const QUESTION_FOR_RATING = (r) => {
  if (r <= 2) return "What went wrong?";
  if (r === 3) return "What could we improve?";
  return "What did you like most?";
};

// ---------- demo seed so the dashboard isn't empty on first load ----------
function seedEntries() {
  const names = ["", "", "Priya", "", "Armaan", "", "", "Neha", ""];
  const comments = [
    { r: 5, c: "The staff were incredibly friendly and the coffee was fresh." },
    { r: 2, c: "Waited almost 25 minutes and the order was still wrong." },
    { r: 4, c: "Great atmosphere, a bit noisy in the evening." },
    { r: 5, c: "Best breakfast in the neighborhood, love this place." },
    { r: 1, c: "Rude staff at the counter, won't be back." },
    { r: 3, c: "Food was fine but the tables were dirty." },
    { r: 5, c: "Perfect every time, the pastries are excellent." },
    { r: 4, c: "Clean space, fast service, slightly overpriced." },
    { r: 2, c: "Cold food and a long wait, disappointed." },
    { r: 5, c: "Cozy spot, amazing staff, will come back." },
    { r: 3, c: "Average experience, nothing stood out." },
    { r: 4, c: "Really helpful staff, fresh pastries." },
  ];
  const sources = ["Table 4", "Table 9", "QR — Counter", "Takeaway Link", "Table 2"];
  const now = Date.now();
  return comments.map((entry, i) => {
    const sentiment = { ...analyzeSentiment(entry.r, entry.c), source: "heuristic" };
    return {
      id: `seed-${i}`,
      rating: entry.r,
      comment: entry.c,
      name: names[i] || null,
      source: sources[i % sources.length],
      status: entry.r <= 2 ? "New" : "Resolved",
      createdAt: now - (i + 1) * 1000 * 60 * 60 * (7 + i),
      sentiment,
    };
  });
}

async function loadEntries() {
  try {
    const res = await window.storage.get(STORAGE_KEY, true);
    return res ? JSON.parse(res.value) : null;
  } catch {
    return null;
  }
}
async function saveEntries(entries) {
  try {
    await window.storage.set(STORAGE_KEY, JSON.stringify(entries), true);
  } catch {
    // best-effort; app still works in-memory this session
  }
}

// =================================================================
// APP SHELL
// =================================================================
export default function App() {
  const [view, setView] = useState("landing"); // landing | feedback | dashboard
  const [entries, setEntries] = useState(null); // null = loading
  const [justSubmitted, setJustSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      let data = await loadEntries();
      if (!data || data.length === 0) {
        data = seedEntries();
        await saveEntries(data);
      }
      setEntries(data);
    })();
  }, []);

  const addEntry = useCallback(async (entry) => {
    setEntries(prev => {
      const next = [entry, ...(prev || [])];
      saveEntries(next);
      return next;
    });
    setJustSubmitted(true);
  }, []);

  return (
    <div style={{ fontFamily: FONT_SANS, background: PAPER, minHeight: "100%", color: INK }}>
      <TopNav view={view} setView={(v) => { setView(v); setJustSubmitted(false); }} />
      {view === "landing" && <Landing goFeedback={() => setView("feedback")} goDashboard={() => setView("dashboard")} />}
      {view === "feedback" && (
        <FeedbackFlow
          onSubmit={addEntry}
          justSubmitted={justSubmitted}
          resetSubmitted={() => setJustSubmitted(false)}
        />
      )}
      {view === "dashboard" && <Dashboard entries={entries} />}
    </div>
  );
}

function TopNav({ view, setView }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "18px 28px", borderBottom: `1px solid ${LINE}`,
      background: PAPER, position: "sticky", top: 0, zIndex: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
           onClick={() => setView("landing")}>
        <div style={{
          width: 30, height: 30, borderRadius: 7, background: INK,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: BRASS }} />
        </div>
        <span style={{ fontFamily: FONT_SERIF, fontSize: 20, letterSpacing: "0.01em" }}>Candor</span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <NavBtn active={view === "feedback"} onClick={() => setView("feedback")} icon={<MessageSquare size={15} />} label="Try the feedback form" />
        <NavBtn active={view === "dashboard"} onClick={() => setView("dashboard")} icon={<LayoutDashboard size={15} />} label="Business dashboard" />
      </div>
    </div>
  );
}

function NavBtn({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 7,
      padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer",
      background: active ? INK : "transparent",
      color: active ? PAPER : INK,
      fontSize: 13.5, fontWeight: 500, fontFamily: FONT_SANS,
      transition: "background 0.15s",
    }}>
      {icon}{label}
    </button>
  );
}

// =================================================================
// LANDING
// =================================================================
function Landing({ goFeedback, goDashboard }) {
  return (
    <div>
      {/* HERO */}
      <div style={{
        display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 48,
        padding: "72px 28px 64px", maxWidth: 1180, margin: "0 auto",
        alignItems: "center",
      }}>
        <div>
          <h1 style={{
            fontFamily: FONT_SERIF, fontSize: 52, lineHeight: 1.08,
            margin: 0, fontWeight: 500, maxWidth: 560,
          }}>
            Know what your customers actually think, one table at a time.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.6, color: "#3C4A43", maxWidth: 480, marginTop: 20 }}>
            Candor turns a scanned QR code into a plain-language read on how
            the visit went — and turns a week of those into the three things
            worth fixing.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 30 }}>
            <button onClick={goFeedback} style={btnPrimary}>
              See the feedback form <ArrowRight size={15} />
            </button>
            <button onClick={goDashboard} style={btnGhost}>
              View a live dashboard
            </button>
          </div>
          <div style={{ display: "flex", gap: 26, marginTop: 40 }}>
            {[["30 sec", "to leave feedback"], ["3 taps", "from QR to submit"], ["1 page", "no app, no login"]].map(([n, l]) => (
              <div key={l}>
                <div style={{ fontFamily: FONT_SERIF, fontSize: 22 }}>{n}</div>
                <div style={{ fontSize: 12.5, color: "#5B6960" }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* signature element: a live mini feedback card, not a generic stat block */}
        <div style={{
          background: INK, borderRadius: 16, padding: 28, color: PAPER,
          boxShadow: "0 24px 60px -20px rgba(18,42,34,0.45)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: BRASS_DIM }}>Riverside Café — Table 4</span>
            <QrCode size={16} color={BRASS_DIM} />
          </div>
          <p style={{ fontFamily: FONT_SERIF, fontSize: 22, margin: "22px 0 16px" }}>How was your visit today?</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
            {[1,2,3,4,5].map(i => (
              <Star key={i} size={26} fill={i <= 4 ? BRASS : "none"} color={BRASS} />
            ))}
          </div>
          <div style={{ background: "rgba(244,246,243,0.08)", borderRadius: 10, padding: "12px 14px", fontSize: 13.5, color: "#CBD6CE" }}>
            "Loved the flat white, service was a little slow around noon."
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}>
            <Sparkles size={14} color={BRASS} />
            <span style={{ fontSize: 12.5, color: "#A9BBAE" }}>Read as: Mixed — flags "service speed"</span>
          </div>
        </div>
      </div>

      {/* FEATURES */}
      <Section title="What it does" subtitle="Everything a business needs to collect, read, and act on feedback.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18 }}>
          {[
            [QrCode, "QR & link collection", "Generate a code per table, branch, or campaign and track where each response came from."],
            [Sparkles, "Plain-language sentiment", "Every comment is read for tone and topic, no manual tagging required."],
            [BarChart3, "Live analytics", "Rating trends, sentiment mix, and location comparisons update as responses come in."],
            [AlertCircle, "Alerts on what matters", "A rating at or below your threshold notifies the right person immediately."],
          ].map(([Icon, t, d]) => (
            <div key={t} style={cardStyle}>
              <Icon size={20} color={BRASS} />
              <div style={{ fontWeight: 600, fontSize: 15, marginTop: 14 }}>{t}</div>
              <div style={{ fontSize: 13.5, color: "#5B6960", marginTop: 6, lineHeight: 1.5 }}>{d}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* HOW IT WORKS */}
      <Section title="How a response becomes an answer" subtitle="Five steps from a scanned code to a resolved issue.">
        <div style={{ display: "flex", gap: 0, alignItems: "stretch" }}>
          {["Build the form", "Print the QR code", "Guest leaves feedback", "Candor reads it", "You act on it"].map((t, i, arr) => (
            <React.Fragment key={t}>
              <div style={{ flex: 1, textAlign: "left" }}>
                <div style={{ fontFamily: FONT_SERIF, fontSize: 15, color: "#3C4A43" }}>{t}</div>
              </div>
              {i < arr.length - 1 && <div style={{ width: 28, borderTop: `1px solid ${LINE}`, margin: "9px 6px 0" }} />}
            </React.Fragment>
          ))}
        </div>
      </Section>

      {/* INDUSTRIES */}
      <Section title="Built for walk-in businesses" subtitle="Anywhere a visit ends and a memory of it begins.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {["Restaurants", "Cafés", "Hotels", "Salons", "Clinics", "Gyms", "Retail stores", "Education"].map(t => (
            <span key={t} style={{
              padding: "8px 16px", borderRadius: 20, border: `1px solid ${LINE}`,
              fontSize: 13.5, color: "#3C4A43", background: "#FFFFFF",
            }}>{t}</span>
          ))}
        </div>
      </Section>

      {/* PRICING */}
      <Section title="Plans" subtitle="Start free, grow into what your business needs.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18 }}>
          {[
            ["Free", "₹0", ["1 location", "Limited responses", "Basic analytics"]],
            ["Professional", "₹1,499/mo", ["Multiple forms", "Higher response limit", "QR codes & reports"]],
            ["Business", "₹3,999/mo", ["Multiple locations", "Team management", "Alerts & branding"]],
            ["Enterprise", "Custom", ["Custom limits", "API access", "Dedicated support"]],
          ].map(([name, price, feats]) => (
            <div key={name} style={{ ...cardStyle, display: "flex", flexDirection: "column" }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{name}</div>
              <div style={{ fontFamily: FONT_SERIF, fontSize: 24, marginTop: 8 }}>{price}</div>
              <div style={{ height: 1, background: LINE, margin: "16px 0" }} />
              {feats.map(f => (
                <div key={f} style={{ display: "flex", gap: 8, fontSize: 13, color: "#3C4A43", marginBottom: 8 }}>
                  <Check size={14} color={SAGE} style={{ flexShrink: 0, marginTop: 2 }} /> {f}
                </div>
              ))}
            </div>
          ))}
        </div>
      </Section>

      <div style={{ padding: "40px 28px 60px", textAlign: "center", color: "#5B6960", fontSize: 12.5 }}>
        Candor — a product prototype. Pricing and testimonials shown are illustrative, not live offers.
        <div style={{ marginTop: 6 }}>Built by Divyanshu Kumar · divyanshukumar6305@gmail.com</div>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div style={{ padding: "8px 28px 56px", maxWidth: 1180, margin: "0 auto" }}>
      <h2 style={{ fontFamily: FONT_SERIF, fontSize: 28, fontWeight: 500, margin: "0 0 6px" }}>{title}</h2>
      <p style={{ color: "#5B6960", fontSize: 14.5, margin: "0 0 26px" }}>{subtitle}</p>
      {children}
    </div>
  );
}

const cardStyle = {
  background: "#FFFFFF", border: `1px solid ${LINE}`, borderRadius: 12, padding: 20,
};
const btnPrimary = {
  display: "flex", alignItems: "center", gap: 8, background: INK, color: PAPER,
  border: "none", borderRadius: 9, padding: "12px 20px", fontSize: 14.5,
  fontWeight: 500, cursor: "pointer", fontFamily: FONT_SANS,
};
const btnGhost = {
  background: "transparent", color: INK, border: `1px solid ${INK}`, borderRadius: 9,
  padding: "12px 20px", fontSize: 14.5, fontWeight: 500, cursor: "pointer", fontFamily: FONT_SANS,
};

// =================================================================
// CUSTOMER FEEDBACK FLOW
// =================================================================
function FeedbackFlow({ onSubmit, justSubmitted, resetSubmitted }) {
  const [step, setStep] = useState(0); // 0 rating, 1 detail, 2 contact
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [shareOptIn, setShareOptIn] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const restart = () => {
    setStep(0); setRating(0); setComment(""); setName(""); setShareOptIn(false);
    resetSubmitted();
  };

  const submit = async () => {
    setAnalyzing(true);
    const sentiment = await analyzeSentimentAI(rating, comment);
    setAnalyzing(false);
    onSubmit({
      id: `live-${Date.now()}`,
      rating, comment: comment.trim() || null,
      name: name.trim() || null,
      source: "QR — Table 4",
      status: rating <= 2 ? "New" : "Resolved",
      createdAt: Date.now(),
      sentiment,
    });
  };

  if (justSubmitted) {
    return (
      <div style={{ maxWidth: 460, margin: "70px auto", padding: "0 20px", textAlign: "center" }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%", background: INK, margin: "0 auto 20px",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Check size={24} color={BRASS} />
        </div>
        <h2 style={{ fontFamily: FONT_SERIF, fontSize: 26, margin: "0 0 8px" }}>Thank you for your feedback.</h2>
        <p style={{ color: "#5B6960", fontSize: 14.5, lineHeight: 1.6 }}>
          Riverside Café read this within seconds — it's already on their dashboard.
        </p>
        {rating >= 4 && (
          <div style={{ ...cardStyle, marginTop: 24, textAlign: "left" }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Glad you enjoyed it — mind sharing it publicly?</div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {["Google", "Zomato", "Instagram"].map(p => (
                <button key={p} style={{ ...btnGhost, padding: "8px 14px", fontSize: 13 }}>{p}</button>
              ))}
            </div>
          </div>
        )}
        <button onClick={restart} style={{ ...btnPrimary, margin: "28px auto 0" }}>
          Submit another response
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "48px 20px 80px" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            height: 3, flex: 1, borderRadius: 2,
            background: i <= step ? INK : LINE,
          }} />
        ))}
      </div>

      {step === 0 && (
        <div>
          <div style={{ fontSize: 12.5, color: "#5B6960", marginBottom: 4 }}>Riverside Café · Table 4</div>
          <h2 style={{ fontFamily: FONT_SERIF, fontSize: 27, margin: "0 0 26px" }}>How was your visit today?</h2>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", padding: "20px 0" }}>
            {[1,2,3,4,5].map(i => (
              <button key={i} onClick={() => { setRating(i); setStep(1); }}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                aria-label={`${i} stars`}>
                <Star size={38} fill={i <= rating ? BRASS : "none"} color={BRASS} strokeWidth={1.5} />
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <button onClick={() => setStep(0)} style={backBtn}><ChevronLeft size={15} /> Back</button>
          <div style={{ display: "flex", gap: 4, margin: "18px 0 8px" }}>
            {[1,2,3,4,5].map(i => <Star key={i} size={18} fill={i <= rating ? BRASS : "none"} color={BRASS} />)}
          </div>
          <h2 style={{ fontFamily: FONT_SERIF, fontSize: 24, margin: "0 0 16px" }}>{QUESTION_FOR_RATING(rating)}</h2>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Optional — a sentence or two helps a lot"
            rows={4}
            style={{
              width: "100%", border: `1px solid ${LINE}`, borderRadius: 10, padding: 14,
              fontSize: 14.5, fontFamily: FONT_SANS, resize: "vertical", boxSizing: "border-box",
              background: "#FFFFFF", color: INK,
            }}
          />
          <button onClick={() => setStep(2)} style={{ ...btnPrimary, width: "100%", justifyContent: "center", marginTop: 18 }}>
            Continue <ArrowRight size={15} />
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <button onClick={() => setStep(1)} style={backBtn}><ChevronLeft size={15} /> Back</button>
          <h2 style={{ fontFamily: FONT_SERIF, fontSize: 24, margin: "18px 0 6px" }}>Almost done.</h2>
          <p style={{ fontSize: 13.5, color: "#5B6960", margin: "0 0 18px" }}>Your name is optional — feedback can stay anonymous.</p>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Name (optional)"
            style={{
              width: "100%", border: `1px solid ${LINE}`, borderRadius: 10, padding: "12px 14px",
              fontSize: 14.5, fontFamily: FONT_SANS, boxSizing: "border-box", marginBottom: 14,
              background: "#FFFFFF", color: INK,
            }}
          />
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#3C4A43", cursor: "pointer" }}>
            <input type="checkbox" checked={shareOptIn} onChange={e => setShareOptIn(e.target.checked)} />
            I'm open to being contacted about this feedback
          </label>
          <button onClick={submit} disabled={analyzing} style={{
            ...btnPrimary, width: "100%", justifyContent: "center", marginTop: 20,
            opacity: analyzing ? 0.7 : 1, cursor: analyzing ? "default" : "pointer",
          }}>
            {analyzing ? (
              <>
                <RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} />
                Reading your feedback…
              </>
            ) : "Submit feedback"}
          </button>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  );
}

const backBtn = {
  display: "flex", alignItems: "center", gap: 4, background: "none", border: "none",
  color: "#5B6960", fontSize: 13, cursor: "pointer", padding: 0, fontFamily: FONT_SANS,
};

// =================================================================
// BUSINESS DASHBOARD
// =================================================================
function Dashboard({ entries }) {
  const [range, setRange] = useState(30);
  const [statusFilter, setStatusFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [aiInsights, setAiInsights] = useState(null); // null | array
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  if (!entries) {
    return <div style={{ padding: 60, textAlign: "center", color: "#5B6960" }}>Loading dashboard…</div>;
  }

  const cutoff = Date.now() - range * 24 * 60 * 60 * 1000;
  const inRange = entries.filter(e => e.createdAt >= cutoff);

  const avgRating = inRange.length ? (inRange.reduce((s, e) => s + e.rating, 0) / inRange.length) : 0;
  const posPct = inRange.length ? Math.round(100 * inRange.filter(e => e.sentiment.label === "Positive").length / inRange.length) : 0;
  const negPct = inRange.length ? Math.round(100 * inRange.filter(e => e.sentiment.label === "Negative").length / inRange.length) : 0;
  const nps = inRange.length
    ? Math.round(100 * (
        inRange.filter(e => e.rating === 5).length - inRange.filter(e => e.rating <= 3).length
      ) / inRange.length)
    : 0;

  const distribution = [1,2,3,4,5].map(r => ({
    rating: `${r}★`, count: inRange.filter(e => e.rating === r).length,
  }));

  const sentimentPie = ["Positive", "Neutral", "Mixed", "Negative"].map(label => ({
    name: label, value: inRange.filter(e => e.sentiment.label === label).length,
  })).filter(d => d.value > 0);
  const PIE_COLORS = { Positive: SAGE, Neutral: "#B8BDA8", Mixed: BRASS, Negative: CORAL };

  const trendMap = {};
  inRange.forEach(e => {
    const d = new Date(e.createdAt);
    const key = `${d.getMonth()+1}/${d.getDate()}`;
    if (!trendMap[key]) trendMap[key] = { day: key, total: 0, count: 0 };
    trendMap[key].total += e.rating;
    trendMap[key].count += 1;
  });
  const trend = Object.values(trendMap)
    .sort((a,b) => a.day.localeCompare(b.day))
    .map(d => ({ day: d.day, avg: Math.round((d.total / d.count) * 10) / 10 }));

  const filtered = inRange
    .filter(e => statusFilter === "All" || e.status === statusFilter)
    .filter(e => !query || (e.comment || "").toLowerCase().includes(query.toLowerCase()))
    .sort((a,b) => b.createdAt - a.createdAt);

  const topNegativeTopics = countTopics(inRange.filter(e => e.sentiment.label === "Negative" || e.sentiment.label === "Mixed"));
  const topPositiveTopics = countTopics(inRange.filter(e => e.sentiment.label === "Positive" || e.sentiment.label === "Mixed"));

  const runAIInsights = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await generateAIInsights(inRange, "Riverside Café");
      setAiInsights(result);
    } catch (err) {
      setAiError(err.message || "Couldn't generate insights right now");
      setAiInsights(null);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 28px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#5B6960", fontSize: 13 }}>
            <Building2 size={14} /> Riverside Café <span style={{ color: LINE }}>·</span> <MapPin size={13} /> Ludhiana
          </div>
          <h1 style={{ fontFamily: FONT_SERIF, fontSize: 28, margin: "4px 0 0" }}>Feedback overview</h1>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setRange(d)} style={{
              padding: "7px 13px", borderRadius: 8, fontSize: 13, cursor: "pointer",
              border: `1px solid ${LINE}`, background: range === d ? INK : "#FFFFFF",
              color: range === d ? PAPER : INK, fontFamily: FONT_SANS,
            }}>{d} days</button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 22 }}>
        <Kpi label="Average rating" value={avgRating.toFixed(1)} icon={<Star size={16} color={BRASS} fill={BRASS} />} />
        <Kpi label="Responses" value={inRange.length} icon={<Inbox size={16} color={INK} />} />
        <Kpi label="Positive feedback" value={`${posPct}%`} icon={<TrendingUp size={16} color={SAGE} />} tone={SAGE} />
        <Kpi label="Net Promoter Score" value={nps} icon={negPct > posPct ? <TrendingDown size={16} color={CORAL} /> : <TrendingUp size={16} color={SAGE} />} />
      </div>

      {/* charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14, marginBottom: 22 }}>
        <div style={cardStyle}>
          <ChartTitle title="Average rating over time" />
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trend}>
              <CartesianGrid stroke={LINE} vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#5B6960" }} axisLine={{ stroke: LINE }} tickLine={false} />
              <YAxis domain={[0,5]} tick={{ fontSize: 11, fill: "#5B6960" }} axisLine={false} tickLine={false} width={22} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${LINE}` }} />
              <Line type="monotone" dataKey="avg" stroke={INK} strokeWidth={2} dot={{ r: 3, fill: BRASS }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={cardStyle}>
          <ChartTitle title="Sentiment mix" />
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={sentimentPie} dataKey="value" nameKey="name" innerRadius={45} outerRadius={72} paddingAngle={2}>
                {sentimentPie.map((d, i) => <Cell key={i} fill={PIE_COLORS[d.name]} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${LINE}` }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginTop: -6 }}>
            {sentimentPie.map(d => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#5B6960" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: PIE_COLORS[d.name] }} /> {d.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 22 }}>
        <div style={cardStyle}>
          <ChartTitle title="Rating distribution" />
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={distribution}>
              <CartesianGrid stroke={LINE} vertical={false} />
              <XAxis dataKey="rating" tick={{ fontSize: 11, fill: "#5B6960" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#5B6960" }} axisLine={false} tickLine={false} width={22} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${LINE}` }} />
              <Bar dataKey="count" fill={BRASS} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* smart insights */}
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <ChartTitle title="Smart insights" badge={aiInsights ? "AI-generated" : "Heuristic"} />
            <button onClick={runAIInsights} disabled={aiLoading} style={{
              display: "flex", alignItems: "center", gap: 5, background: "none",
              border: `1px solid ${LINE}`, borderRadius: 7, padding: "5px 10px",
              fontSize: 11.5, color: INK, cursor: aiLoading ? "default" : "pointer",
              fontFamily: FONT_SANS, opacity: aiLoading ? 0.6 : 1,
            }}>
              <RefreshCw size={11} style={aiLoading ? { animation: "spin 1s linear infinite" } : undefined} />
              {aiInsights ? "Regenerate" : "Ask AI"}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
            {aiLoading && (
              <Insight icon={<Sparkles size={14} color={BRASS} />} text="Reading recent comments…" />
            )}

            {!aiLoading && aiInsights && aiInsights.map((text, i) => (
              <Insight key={i} icon={<Sparkles size={14} color={BRASS} />} text={text} />
            ))}

            {!aiLoading && !aiInsights && (
              <>
                {aiError && (
                  <Insight icon={<AlertCircle size={14} color={CORAL} />} text={`${aiError} — showing a simpler read below.`} />
                )}
                {topNegativeTopics[0] && (
                  <Insight icon={<AlertCircle size={14} color={CORAL} />}
                    text={`"${topNegativeTopics[0][0]}" comes up in ${topNegativeTopics[0][1]} recent complaint${topNegativeTopics[0][1]>1?'s':''}.`} />
                )}
                {topPositiveTopics[0] && (
                  <Insight icon={<Smile size={14} color={SAGE} />}
                    text={`Customers most often praise "${topPositiveTopics[0][0]}."`} />
                )}
                {negPct > 25 && (
                  <Insight icon={<TrendingDown size={14} color={CORAL} />}
                    text={`Negative feedback is ${negPct}% of responses in this window — above a healthy 15–20%.`} />
                )}
                {!topNegativeTopics[0] && !topPositiveTopics[0] && !aiError && (
                  <Insight icon={<Sparkles size={14} color={BRASS} />} text="Not enough responses yet to surface a pattern." />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* inbox */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <ChartTitle title="Feedback inbox" />
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${LINE}`, borderRadius: 8, padding: "6px 10px" }}>
              <Search size={13} color="#5B6960" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search comments"
                style={{ border: "none", outline: "none", fontSize: 12.5, fontFamily: FONT_SANS, width: 130, background: "transparent" }} />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{ border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 12.5, padding: "6px 8px", fontFamily: FONT_SANS, background: "#FFFFFF" }}>
              {["All", "New", "Reviewing", "Resolved", "Archived"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "36px 0", color: "#5B6960" }}>
            <MessageSquare size={22} style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 13.5 }}>No feedback matches these filters yet.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {filtered.slice(0, 12).map(e => <FeedbackRow key={e.id} entry={e} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function countTopics(list) {
  const map = {};
  list.forEach(e => e.sentiment.topics.forEach(t => { map[t] = (map[t] || 0) + 1; }));
  return Object.entries(map).sort((a,b) => b[1]-a[1]);
}

function Kpi({ label, value, icon }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12.5, color: "#5B6960" }}>{label}</span>
        {icon}
      </div>
      <div style={{ fontFamily: FONT_SERIF, fontSize: 28, marginTop: 8 }}>{value}</div>
    </div>
  );
}

function ChartTitle({ title, badge }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{title}</span>
      {badge && (
        <span style={{ fontSize: 10.5, color: "#5B6960", border: `1px solid ${LINE}`, borderRadius: 5, padding: "1px 6px" }}>{badge}</span>
      )}
    </div>
  );
}

function Insight({ icon, text }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: "#3C4A43", lineHeight: 1.5 }}>
      <div style={{ marginTop: 2 }}>{icon}</div>
      {text}
    </div>
  );
}

function FeedbackRow({ entry }) {
  const sentColor = { Positive: SAGE, Neutral: "#8A9186", Mixed: BRASS, Negative: CORAL }[entry.sentiment.label] || "#8A9186";
  const timeAgo = formatAgo(entry.createdAt);
  return (
    <div style={{ display: "flex", gap: 14, padding: "13px 0", borderTop: `1px solid ${LINE}` }}>
      <div style={{ display: "flex", gap: 2, minWidth: 76 }}>
        {[1,2,3,4,5].map(i => <Star key={i} size={12} fill={i <= entry.rating ? BRASS : "none"} color={BRASS} />)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: INK }}>{entry.comment || <span style={{ color: "#8A9186" }}>No written comment</span>}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 5, fontSize: 11.5, color: "#5B6960", alignItems: "center" }}>
          <span>{entry.name || "Anonymous"}</span>
          <span>·</span>
          <span>{entry.source}</span>
          <span>·</span>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Clock size={11} /> {timeAgo}</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
        <span style={{ fontSize: 11, color: sentColor, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
          {entry.sentiment.label}
          {entry.sentiment.source === "ai" && <Sparkles size={10} color={BRASS} />}
        </span>
        <span style={{
          fontSize: 10.5, padding: "2px 8px", borderRadius: 5,
          background: entry.status === "New" ? "#FBEAE5" : PAPER_DIM,
          color: entry.status === "New" ? CORAL : "#5B6960",
        }}>{entry.status}</span>
      </div>
    </div>
  );
}

function formatAgo(ts) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
