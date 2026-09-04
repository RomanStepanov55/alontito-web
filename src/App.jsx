import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowLeft, Search, Send, Sparkles, Check, CheckCheck,
  Reply as ReplyIcon, Smile, X, Wand2, Plus, Settings, Copy, ImagePlus,
  Shield, LogOut, Ban, ShieldCheck, Trash2, ChevronRight,
  Lock, Unlock, KeyRound,
  Pin, PinOff, Clock, Star, Info, Phone, ShieldAlert, Globe, Users, Trophy,
} from "lucide-react";

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');`;

// ============================================================
// НАСТРОЙ ОДИН РАЗ ПЕРЕД ДЕПЛОЕМ:
// вставь сюда публичный адрес своего задеплоенного бэкенда
// (например, после деплоя на Render: https://alontito-backend.onrender.com)
// ============================================================
const API_URL = "https://messenger-server-4zfc.onrender.com";

const AGENT_ID = "agent";
const REACTION_SET = ["👍", "❤️", "😂"];
const AVATAR_EMOJIS = ["🙂","😎","🦊","🐺","🐼","🐧","🦁","🐸","🌙","⚡","🔥","🌊","🍀","🎧","🚀","👾"];
const AI_CHIPS = [
  { label: "Суммаризируй", prompt: "Кратко суммаризируй нашу переписку выше." },
  { label: "Переведи", prompt: "Переведи моё последнее сообщение на английский." },
  { label: "Ответь за меня", prompt: "Предложи 2 коротких варианта ответа на последнее сообщение собеседника." },
  { label: "Объясни", prompt: "Объясни простыми словами, о чём был последний фрагмент переписки." },
];

// Титулы за время, проведённое в приложении. Каждый уровень — свои цвета
// градиента рамки аватарки и подписи в профиле.
const TITLE_TIERS = [
  { minHours: 0, name: "Новичок эфира", colors: ["#6C6C76", "#8B8B94"] },
  { minHours: 1, name: "Завсегдатай", colors: ["#4F6EFF", "#7B5CFA"] },
  { minHours: 10, name: "Полуночник чатов", colors: ["#7B5CFA", "#C084FC"] },
  { minHours: 40, name: "Хранитель переписок", colors: ["#0EA5E9", "#22D3EE"] },
  { minHours: 120, name: "Легенда эфира", colors: ["#F59E0B", "#F5C542"] },
  { minHours: 400, name: "Владыка Alontito", colors: ["#F5C542", "#FF6EC7", "#7B5CFA"] },
];

function getTitleTier(totalSeconds) {
  const hours = (totalSeconds || 0) / 3600;
  let tier = TITLE_TIERS[0];
  let idx = 0;
  for (let i = 0; i < TITLE_TIERS.length; i++) {
    if (hours >= TITLE_TIERS[i].minHours) { tier = TITLE_TIERS[i]; idx = i; }
  }
  const next = TITLE_TIERS[idx + 1];
  return {
    ...tier,
    index: idx,
    progress: next ? Math.min(1, (hours - tier.minHours) / (next.minHours - tier.minHours)) : 1,
    nextName: next?.name,
    nextHours: next?.minHours,
    hours,
  };
}

function nowTime() { return new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }); }
function fmtTime(iso) { try { return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } }

// Уникальные id без коллизий (Date.now() может повториться в пределах 1мс)
let __c = 0;
const uid = () => `${Date.now()}-${++__c}`;

// Сжимает фото перед отправкой (иначе base64 будет весить мегабайты)
function compressImageToDataUrl(file, maxDim = 900, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const seedAgentChat = {
  id: AGENT_ID, isAgent: true, name: "AI-агент", last: "Спроси меня о чём угодно.", time: "",
  messages: [{ id: uid(), role: "them", text: "Привет! Я работаю прямо в приложении и не завишу от сервера.", time: "" }],
};

const GLOBAL_STYLES = `
  @keyframes titleRingSpin { to { transform: rotate(360deg); } }
  @keyframes pinBounce { 0% { transform: scale(0.5) rotate(-20deg); opacity: 0; } 60% { transform: scale(1.2) rotate(8deg); } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }
  @keyframes pinnedSlideDown { from { opacity: 0; transform: translateY(-10px); max-height: 0; } to { opacity: 1; transform: translateY(0); max-height: 80px; } }
  .pin-in { animation: pinBounce 0.35s cubic-bezier(.34,1.56,.64,1) both; }
  .pinned-in { animation: pinnedSlideDown 0.25s ease-out both; overflow: hidden; }
  ${FONT_IMPORT}
  @keyframes float1 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(40px,60px); } }
  @keyframes float2 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-50px,-30px); } }
  @keyframes logoGlow { 0%,100% { filter: drop-shadow(0 0 12px rgba(79,110,255,0.5)); } 50% { filter: drop-shadow(0 0 28px rgba(123,92,250,0.75)); } }
  @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes shakeX { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-8px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-6px); } 80% { transform: translateX(6px); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulseDot { 0%,60%,100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-2px); } }
  @keyframes blink { 50% { opacity: 0; } }
  @keyframes listIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes modalIn { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
  @keyframes panelSlideIn { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes pulseGreen { 0%,100% { box-shadow: 0 0 0 0 rgba(74,222,128,0.5); } 50% { box-shadow: 0 0 0 5px rgba(74,222,128,0); } }
  @keyframes checkPop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
  @keyframes badgePop { 0% { transform: scale(0); } 70% { transform: scale(1.2); } 100% { transform: scale(1); } }
  @keyframes emojiPick { 0% { transform: scale(0.7) rotate(-10deg); opacity: 0; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
  .msg-in { animation: fadeSlideUp 0.28s cubic-bezier(.2,.7,.3,1) both; }
  .list-in { animation: listIn 0.35s cubic-bezier(.2,.7,.3,1) both; }
  .panel-in { animation: panelSlideIn 0.28s cubic-bezier(.2,.7,.3,1) both; }
  .check-pop { animation: checkPop 0.3s cubic-bezier(.34,1.56,.64,1) both; }
  .badge-pop { animation: badgePop 0.3s cubic-bezier(.34,1.56,.64,1) both; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-thumb { background: #232328; border-radius: 999px; }
  ::-webkit-scrollbar-track { background: transparent; }
`;

function GradientBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute w-[480px] h-[480px] rounded-full opacity-25" style={{ background: "radial-gradient(circle, #4F6EFF, transparent 70%)", top: "-10%", left: "-15%", animation: "float1 14s ease-in-out infinite" }} />
      <div className="absolute w-[420px] h-[420px] rounded-full opacity-20" style={{ background: "radial-gradient(circle, #7B5CFA, transparent 70%)", bottom: "-15%", right: "-10%", animation: "float2 18s ease-in-out infinite" }} />
    </div>
  );
}

function Avatar({ chat, size = 44 }) {
  const isAgent = chat.isAgent;
  const emoji = chat.avatarEmoji;
  const initial = (chat.name || "?").replace("@", "").slice(0, 1).toUpperCase();
  return (
    <div className="relative flex-shrink-0 rounded-full flex items-center justify-center font-semibold select-none" style={{
      width: size, height: size, fontFamily: "'Space Grotesk', sans-serif",
      background: isAgent ? "linear-gradient(135deg, #4F6EFF, #7B5CFA)" : "#2A2A31",
      color: "#F2F2F5", fontSize: size * (emoji ? 0.5 : 0.4),
    }}>
      {isAgent ? <Sparkles size={size * 0.45} strokeWidth={2} /> : emoji || initial}
      {isAgent && <span className="absolute -inset-0.5 rounded-full -z-10" style={{ background: "conic-gradient(from 0deg, #4F6EFF, #7B5CFA, #4F6EFF)", filter: "blur(6px)", opacity: 0.55, animation: "spin 4s linear infinite" }} />}
    </div>
  );
}

function TitleRing({ colors, size, children }) {
  const gradient = `conic-gradient(${[...colors, colors[0]].join(",")})`;
  return (
    <div style={{ position: "relative", width: size, height: size, borderRadius: "50%", padding: 3, background: gradient, animation: "titleRingSpin 4s linear infinite", flexShrink: 0 }}>
      <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "#0C0C0F", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2.5">
      {[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#8B8B94]" style={{ animation: `pulseDot 1.2s ease-in-out ${i * 0.15}s infinite` }} />)}
    </div>
  );
}

// ============================================================
// Вход: телефон/юзернейм -> код
// ============================================================

function LoginScreen({ onLoggedIn }) {
  const [step, setStep] = useState("id");
  const [identifier, setIdentifier] = useState("+7");
  const [phoneHint, setPhoneHint] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const codeRefs = useRef([]);

  async function requestCode() {
    setError("");
    if (!identifier.trim()) { setError("Введи номер телефона или юзернейм"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/request-code`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const text = await res.json();

      console.log("API response:", text);

      let data;
      try{
        data = JSON.parse(text);
      } catch {
        throw new Error("Сервер вернул HTML вместо JSON");
      }
      
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setPhoneHint(data.phoneHint || "");
      setStep("code");
      setTimeout(() => codeRefs.current[0]?.focus(), 300);
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }

  async function verify(fullCode) {
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-code`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), code: fullCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Неверный код");
      onLoggedIn(data.token, data.user);
    } catch (e) {
      setError(e.message); setShake(true); setCode(["", "", "", "", "", ""]);
      setTimeout(() => { setShake(false); codeRefs.current[0]?.focus(); }, 500);
    } finally { setLoading(false); }
  }

  function onCodeChange(i, val) {
    if (!/^\d?$/.test(val)) return;
    const next = [...code]; next[i] = val; setCode(next);
    if (val && i < 5) codeRefs.current[i + 1]?.focus();
    if (next.every((d) => d) && next.join("").length === 6) verify(next.join(""));
  }

  return (
    <div className="relative w-full h-screen flex items-center justify-center overflow-hidden" style={{ background: "#0C0C0F", fontFamily: "'Inter', sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>
      <GradientBackdrop />
      <div className="relative z-10 w-full max-w-sm px-6">
        <div className="flex flex-col items-center mb-8 msg-in">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "linear-gradient(135deg, #4F6EFF, #7B5CFA)", animation: "logoGlow 3s ease-in-out infinite" }}>
            <Sparkles size={28} color="#fff" />
          </div>
          <h1 className="text-[26px] font-bold" style={{ color: "#F2F2F5", fontFamily: "'Space Grotesk', sans-serif" }}>Alontito</h1>
          <p className="text-[13.5px] mt-1" style={{ color: "#6C6C76" }}>
            {step === "id" ? "Телефон или юзернейм" : `Код отправлен на ${phoneHint || "твой телефон"}`}
          </p>
        </div>

        {step === "id" ? (
          <div key="id" className="msg-in" style={{ animationDelay: "0.08s" }}>
            <input
              value={identifier} onChange={(e) => setIdentifier(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && requestCode()}
              placeholder="+79991234567 или swift_fox482"
              className="w-full px-4 py-3.5 rounded-2xl outline-none text-[16px] text-center tracking-wide mb-3"
              style={{ background: "#1C1C21", color: "#F2F2F5", border: "1px solid #232328", fontFamily: "'JetBrains Mono', monospace" }}
            />
            {error && <p className="text-[12.5px] text-center mb-3" style={{ color: "#FF6B6B" }}>{error}</p>}
            <button onClick={requestCode} disabled={loading} className="w-full py-3.5 rounded-2xl font-semibold text-[15px] active:scale-[0.98] transition-transform" style={{ background: "linear-gradient(135deg, #4F6EFF, #7B5CFA)", color: "#fff", opacity: loading ? 0.7 : 1 }}>
              {loading ? "Отправляем…" : "Получить код"}
            </button>
          </div>
        ) : (
          <div key="code" className="msg-in">
            <div className="flex justify-center gap-2 mb-3" style={{ animation: shake ? "shakeX 0.5s" : "none" }}>
              {code.map((d, i) => (
                <input key={i} ref={(el) => (codeRefs.current[i] = el)} value={d}
                  onChange={(e) => onCodeChange(i, e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Backspace" && !d && i > 0) codeRefs.current[i - 1]?.focus(); }}
                  maxLength={1} inputMode="numeric"
                  className="w-11 h-13 py-3 rounded-xl text-center text-[20px] font-semibold outline-none transition-all"
                  style={{ background: "#1C1C21", color: "#F2F2F5", border: d ? "1.5px solid #4F6EFF" : "1.5px solid #232328" }} />
              ))}
            </div>
            {error && <p className="text-[12.5px] text-center mb-2" style={{ color: "#FF6B6B" }}>{error}</p>}
            {loading && <p className="text-[12.5px] text-center" style={{ color: "#8FA0FF" }}>Проверяем…</p>}
            <button onClick={() => { setStep("id"); setError(""); setCode(["", "", "", "", "", ""]); }} className="w-full text-center mt-4 text-[13px]" style={{ color: "#6C6C76" }}>← изменить</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Пузырь сообщения (с галочками прочтения)
// ============================================================

function Ticks({ status }) {
  // status: 'sending' | 'sent' | 'read'
  if (status === "sending") return <Check size={13} color="rgba(255,255,255,0.4)" />;
  if (status === "read") return <span className="check-pop" style={{ display: "inline-flex" }}><CheckCheck size={13} color="#B8FF9F" /></span>;
  return <Check size={13} color="rgba(255,255,255,0.8)" />;
}

function MessageBubble({ msg, isAgentChat, onReply, onToggleReaction, onTogglePin, isPinned, showSender }) {
  const [showReact, setShowReact] = useState(false);
  const mine = msg.role === "me";
  const inlineAI = msg.role === "ai-inline";
  const reactionEntries = Object.entries(msg.reactions || {}).filter(([, p]) => p.length > 0);

  return (
    <div className={`group flex w-full mb-1.5 msg-in ${mine ? "justify-end" : "justify-start"}`} onMouseLeave={() => setShowReact(false)}>
      {!mine && !inlineAI && (
        <div className="flex flex-col justify-end gap-1 mr-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onReply(msg)} className="p-1.5 rounded-full active:scale-90 transition-transform" style={{ background: "#1C1C21" }}><ReplyIcon size={13} color="#8B8B94" /></button>
          {onTogglePin && (
            <button onClick={() => onTogglePin(msg)} className="p-1.5 rounded-full active:scale-90 transition-transform" style={{ background: isPinned ? "#4F6EFF22" : "#1C1C21" }}>
              {isPinned ? <PinOff size={13} color="#4F6EFF" /> : <Pin size={13} color="#8B8B94" />}
            </button>
          )}
        </div>
      )}
      <div className="relative max-w-[78%] sm:max-w-[65%]">
        {showSender && !mine && msg.senderName && (
          <div className="text-[11.5px] font-medium mb-0.5 ml-1" style={{ color: "#8FA0FF" }}>@{msg.senderName}</div>
        )}
        <div className="relative px-3.5 py-2 rounded-2xl transition-shadow" style={{
          background: mine ? "linear-gradient(135deg, #4F6EFF, #6A5CE0)" : inlineAI ? "#181A24" : "#1C1C21",
          color: mine ? "#fff" : "#F2F2F5",
          borderBottomRightRadius: mine ? 4 : 18, borderBottomLeftRadius: mine ? 18 : 4,
          boxShadow: isAgentChat && !mine ? "0 0 0 1px rgba(79,110,255,0.25), 0 0 18px rgba(79,110,255,0.08)"
            : inlineAI ? "0 0 0 1px rgba(123,92,250,0.35), 0 0 16px rgba(123,92,250,0.1)" : "none",
          opacity: msg.status === "sending" ? 0.6 : 1,
        }}>
          {inlineAI && <div className="flex items-center gap-1 mb-1" style={{ color: "#8FA0FF" }}><Sparkles size={11} /><span className="text-[10px] font-semibold tracking-wide" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>AI-ПОДСКАЗКА · ТОЛЬКО ТЕБЕ</span></div>}
          {msg.quote && <div className="mb-1.5 pl-2 border-l-2 rounded-sm text-[12.5px] opacity-80 truncate" style={{ borderColor: mine ? "rgba(255,255,255,0.5)" : "#4F6EFF" }}><span className="font-medium">{msg.quote.sender}: </span>{msg.quote.text}</div>}
          {msg.msgType === "image" ? (
            <img src={msg.text} alt="Фото" className="rounded-xl max-w-full max-h-[320px] object-cover" style={{ opacity: msg.status === "sending" ? 0.6 : 1 }} />
          ) : (
            <p className="text-[15px] leading-snug whitespace-pre-wrap break-words">
              {msg.text}
              {msg.streaming && <span className="inline-block w-[2px] h-[15px] align-middle ml-0.5" style={{ background: "#8FA0FF", animation: "blink 0.9s step-start infinite" }} />}
            </p>
          )}
          <div className={`flex items-center gap-1 mt-0.5 ${mine ? "justify-end" : "justify-start"}`}>
            <span className="text-[10.5px]" style={{ color: mine ? "rgba(255,255,255,0.7)" : "#6C6C76", fontFamily: "'JetBrains Mono', monospace" }}>{msg.time}</span>
            {mine && !inlineAI && <Ticks status={msg.status} />}
          </div>
        </div>
        {reactionEntries.length > 0 && (
          <div className={`flex gap-1 mt-1 ${mine ? "justify-end" : "justify-start"}`}>
            {reactionEntries.map(([emoji, ppl]) => (
              <button key={emoji} onClick={() => onToggleReaction(msg.id, emoji)} className="badge-pop px-1.5 py-0.5 rounded-full text-[12px] flex items-center gap-1" style={{ background: "#1C1C21", border: ppl.includes("me") ? "1px solid #4F6EFF" : "1px solid transparent" }}>
                {emoji} <span style={{ color: "#8B8B94", fontSize: 10 }}>{ppl.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="relative flex flex-col justify-end gap-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {mine && !inlineAI && onTogglePin && (
          <button onClick={() => onTogglePin(msg)} className="p-1.5 rounded-full active:scale-90 transition-transform" style={{ background: isPinned ? "#4F6EFF22" : "#1C1C21" }}>
            {isPinned ? <PinOff size={13} color="#4F6EFF" /> : <Pin size={13} color="#8B8B94" />}
          </button>
        )}
        <button onClick={() => setShowReact((s) => !s)} className="p-1.5 rounded-full active:scale-90 transition-transform" style={{ background: "#1C1C21" }}><Smile size={13} color="#8B8B94" /></button>
        {showReact && (
          <div className={`absolute bottom-8 ${mine ? "right-0" : "left-0"} flex gap-1 px-2 py-1.5 rounded-full z-10 modal-in`} style={{ background: "#1C1C21", boxShadow: "0 4px 16px rgba(0,0,0,0.4)", animation: "modalIn 0.18s cubic-bezier(.2,.7,.3,1) both" }}>
            {REACTION_SET.map((e) => <button key={e} onClick={() => { onToggleReaction(msg.id, e); setShowReact(false); }} className="text-[16px] hover:scale-125 transition-transform">{e}</button>)}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Экран профиля
// ============================================================

function ProfilePanel({ apiUrl, token, me, setMe, onClose, onLogout, onOpenAbout }) {
  const [displayName, setDisplayName] = useState(me.displayName || "");
  const [username, setUsername] = useState(me.username || "");
  const [avatarEmoji, setAvatarEmoji] = useState(me.avatarEmoji || "🙂");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState(null);
  const [tgStatus, setTgStatus] = useState(null); // null=грузим | "not-configured" | "linked" | "not-linked"

  useEffect(() => {
    fetch(`${apiUrl}/api/me/phone`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPhone(d.phone))
      .catch(() => {});
  }, [apiUrl, token]);

  const refreshTgStatus = useCallback(() => {
    fetch(`${apiUrl}/api/telegram/status`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setTgStatus(!d.configured ? "not-configured" : d.linked ? "linked" : "not-linked"))
      .catch(() => setTgStatus("not-configured"));
  }, [apiUrl, token]);

  useEffect(() => { refreshTgStatus(); }, [refreshTgStatus]);

  async function linkTelegram() {
    try {
      const res = await fetch(`${apiUrl}/api/telegram/link-init`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.open(data.deepLink, "_blank", "noopener,noreferrer");
      // после того как человек нажмёт /start у бота, статус обновится не сразу —
      // подождём немного и перепроверим пару раз
      setTimeout(refreshTgStatus, 4000);
      setTimeout(refreshTgStatus, 9000);
    } catch (e) { setError(e.message); }
  }

  async function unlinkTelegram() {
    await fetch(`${apiUrl}/api/telegram/unlink`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    setTgStatus("not-linked");
  }

  const [saved, setSaved] = useState(false);
  const tier = getTitleTier(me.totalActiveSeconds);

  async function save() {
    setError(""); setSaving(true); setSaved(false);
    try {
      const res = await fetch(`${apiUrl}/api/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ displayName, username, avatarEmoji }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось сохранить");
      setMe(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.55)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="panel-in w-full max-w-sm h-full flex flex-col" style={{ background: "#0F0F12", borderLeft: "1px solid #1B1B1F" }}>
        <div className="flex items-center gap-3 px-5 border-b" style={{ borderColor: "#1B1B1F", paddingTop: "max(16px, env(safe-area-inset-top))", paddingBottom: 16 }}>
          <button onClick={onClose} className="p-1 active:scale-90 transition-transform"><ArrowLeft size={20} color="#F2F2F5" /></button>
          <h2 className="text-[17px] font-semibold" style={{ color: "#F2F2F5", fontFamily: "'Space Grotesk', sans-serif" }}>Профиль</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6">
          <div className="flex flex-col items-center mb-6">
            <TitleRing colors={tier.colors} size={92}>
              <span className="text-[36px]">{avatarEmoji}</span>
            </TitleRing>

            <div className="text-center mt-3 mb-1">
              <span className="text-[13.5px] font-semibold px-3 py-1 rounded-full" style={{ background: `linear-gradient(135deg, ${tier.colors[0]}22, ${tier.colors[tier.colors.length - 1]}22)`, color: tier.colors[0], border: `1px solid ${tier.colors[0]}55`, fontFamily: "'Space Grotesk', sans-serif" }}>
                {tier.name}
              </span>
            </div>

            <div className="flex items-center gap-1.5 mt-1 mb-1.5" style={{ color: "#F2F2F5" }}>
              <Clock size={13} color="#8B8B94" />
              <span className="text-[13px]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {Math.floor(tier.hours)} ч {Math.round((tier.hours % 1) * 60)} мин в Alontito
              </span>
            </div>

            {tier.nextName ? (
              <div className="w-full max-w-[240px] mt-2">
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1C1C21" }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.round(tier.progress * 100)}%`, background: `linear-gradient(90deg, ${tier.colors[0]}, ${tier.colors[tier.colors.length - 1]})`, transition: "width 0.4s" }} />
                </div>
                <div className="text-[10.5px] text-center mt-1" style={{ color: "#6C6C76" }}>
                  до «{tier.nextName}»: {Math.max(0, Math.round((tier.nextHours - tier.hours) * 10) / 10)} ч
                </div>
              </div>
            ) : (
              <div className="text-[10.5px] text-center mt-1" style={{ color: "#6C6C76" }}>максимальный титул достигнут</div>
            )}

            <div className="grid grid-cols-8 gap-2 max-w-[280px] mt-5">
              {AVATAR_EMOJIS.map((e, i) => (
                <button key={e} onClick={() => setAvatarEmoji(e)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[18px] active:scale-90 transition-transform"
                  style={{ background: avatarEmoji === e ? "#4F6EFF33" : "#1C1C21", border: avatarEmoji === e ? "1.5px solid #4F6EFF" : "1.5px solid transparent", animation: `emojiPick 0.3s ${i * 0.02}s cubic-bezier(.2,.7,.3,1) both` }}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-[12px] mb-1.5" style={{ color: "#8B8B94" }}>Имя</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Как тебя зовут" className="w-full px-3.5 py-2.5 rounded-xl outline-none text-[14.5px] mb-4" style={{ background: "#1C1C21", color: "#F2F2F5", border: "1px solid #232328" }} />

          <label className="block text-[12px] mb-1.5" style={{ color: "#8B8B94" }}>Юзернейм</label>
          <div className="flex items-center px-3.5 rounded-xl mb-4" style={{ background: "#1C1C21", border: "1px solid #232328" }}>
            <span style={{ color: "#6C6C76" }}>@</span>
            <input value={username} onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))} className="flex-1 py-2.5 pl-1 outline-none bg-transparent text-[14.5px]" style={{ color: "#F2F2F5" }} />
          </div>

          <label className="block text-[12px] mb-1.5" style={{ color: "#8B8B94" }}>Номер телефона</label>
          <div className="w-full px-3.5 py-2.5 rounded-xl mb-4 text-[14.5px]" style={{ background: "#14141a", color: "#6C6C76", fontFamily: "'JetBrains Mono', monospace" }}>{phone || "••• •••-••-••"}</div>

          <label className="block text-[12px] mb-1.5" style={{ color: "#8B8B94" }}>Код входа</label>
          <div className="rounded-xl mb-4 px-3.5 py-2.5" style={{ background: "#14141a" }}>
            {tgStatus === null && <span className="text-[13px]" style={{ color: "#6C6C76" }}>Проверяю…</span>}
            {tgStatus === "not-configured" && <span className="text-[12.5px]" style={{ color: "#6C6C76" }}>Telegram-бот пока не настроен на сервере</span>}
            {tgStatus === "linked" && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] flex items-center gap-1.5" style={{ color: "#4ADE80" }}>✅ Код приходит в Telegram — бесплатно</span>
                <button onClick={unlinkTelegram} className="text-[11.5px] flex-shrink-0" style={{ color: "#FF6B6B" }}>Отвязать</button>
              </div>
            )}
            {tgStatus === "not-linked" && (
              <div>
                <p className="text-[12.5px] mb-2" style={{ color: "#8B8B94" }}>Пока код приходит только в лог сервера. Привяжи Telegram — код будет приходить туда, бесплатно навсегда.</p>
                <button onClick={linkTelegram} className="w-full py-2 rounded-lg text-[13px] font-medium active:scale-95 transition-transform" style={{ background: "linear-gradient(135deg, #229ED9, #4F6EFF)", color: "#fff" }}>Привязать Telegram</button>
              </div>
            )}
          </div>

          {me.isAdmin && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl mb-4" style={{ background: "#1a1420", border: "1px solid rgba(250,180,80,0.3)" }}>
              <Shield size={15} color="#FAB450" /><span className="text-[13px]" style={{ color: "#FAB450" }}>У тебя права администратора</span>
            </div>
          )}

          {error && <p className="text-[12.5px] mb-2" style={{ color: "#FF6B6B" }}>{error}</p>}
          <button onClick={save} disabled={saving} className="w-full py-3 rounded-xl font-semibold text-[14.5px] active:scale-[0.98] transition-transform mb-2" style={{ background: saved ? "#2E7D4F" : "linear-gradient(135deg, #4F6EFF, #7B5CFA)", color: "#fff", opacity: saving ? 0.7 : 1 }}>
            {saved ? "Сохранено ✓" : saving ? "Сохраняем…" : "Сохранить"}
          </button>
          <button onClick={onOpenAbout} className="w-full py-3 rounded-xl font-medium text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform mb-2" style={{ background: "#1C1C21", color: "#8FA0FF" }}>
            <Info size={15} /> О приложении
          </button>
          <button onClick={onLogout} className="w-full py-3 rounded-xl font-medium text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform" style={{ background: "#1C1C21", color: "#FF6B6B" }}>
            <LogOut size={15} /> Выйти
          </button>

          <p className="text-center text-[11.5px] mt-6" style={{ color: "#4A4A52" }}>Alontito · автор R_stepanov</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Админ-панель
// ============================================================

function AdminPanel({ apiUrl, token, onClose }) {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, sRes] = await Promise.all([
        fetch(`${apiUrl}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiUrl}/api/admin/stats`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setUsers(await uRes.json());
      setStats(await sRes.json());
    } catch (e) {} finally { setLoading(false); }
  }, [apiUrl, token]);

  useEffect(() => { load(); }, [load]);

  async function toggleBan(u) {
    await fetch(`${apiUrl}/api/admin/${u.is_banned ? "unban" : "ban"}`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId: u.id }),
    });
    load();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.55)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="panel-in w-full max-w-md h-full flex flex-col" style={{ background: "#0F0F12", borderLeft: "1px solid #1B1B1F" }}>
        <div className="flex items-center gap-3 px-5 border-b" style={{ borderColor: "#1B1B1F", paddingTop: "max(16px, env(safe-area-inset-top))", paddingBottom: 16 }}>
          <button onClick={onClose} className="p-1 active:scale-90 transition-transform"><ArrowLeft size={20} color="#F2F2F5" /></button>
          <Shield size={18} color="#FAB450" />
          <h2 className="text-[17px] font-semibold" style={{ color: "#F2F2F5", fontFamily: "'Space Grotesk', sans-serif" }}>Админ-панель</h2>
        </div>

        {stats && (
          <div className="grid grid-cols-3 gap-2 px-5 py-4">
            {[["Юзеров", stats.users], ["Чатов", stats.conversations], ["Сообщений", stats.messages]].map(([label, val]) => (
              <div key={label} className="rounded-xl px-3 py-3 text-center badge-pop" style={{ background: "#1C1C21" }}>
                <div className="text-[20px] font-bold" style={{ color: "#F2F2F5", fontFamily: "'Space Grotesk', sans-serif" }}>{val}</div>
                <div className="text-[11px]" style={{ color: "#6C6C76" }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {loading && <div className="text-center py-6 text-[13px]" style={{ color: "#6C6C76" }}>Загружаю…</div>}
          {users.map((u, i) => (
            <div key={u.id} className="list-in flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1" style={{ background: "#131316", animationDelay: `${i * 0.03}s` }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold flex-shrink-0" style={{ background: "#2A2A31", color: "#F2F2F5" }}>
                {(u.username || u.phone).slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] truncate" style={{ color: "#F2F2F5" }}>@{u.username || "—"} {u.is_admin && <ShieldCheck size={12} color="#FAB450" className="inline ml-1" />}</div>
                <div className="text-[11.5px]" style={{ color: "#6C6C76", fontFamily: "'JetBrains Mono', monospace" }}>{u.phone}</div>
              </div>
              {!u.is_admin && (
                <button onClick={() => toggleBan(u)} className="p-2 rounded-lg active:scale-90 transition-transform flex-shrink-0" style={{ background: u.is_banned ? "#2E7D4F22" : "#FF6B6B22" }}>
                  <Ban size={14} color={u.is_banned ? "#4ADE80" : "#FF6B6B"} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Рейтинг — по времени, проведённому в приложении
// ============================================================

function LeaderboardPanel({ apiUrl, token, myId, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${apiUrl}/api/leaderboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(() => {}).finally(() => setLoading(false));
  }, [apiUrl, token]);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.55)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="panel-in w-full max-w-md h-full flex flex-col" style={{ background: "#0F0F12", borderLeft: "1px solid #1B1B1F" }}>
        <div className="flex items-center gap-3 px-5 border-b flex-shrink-0" style={{ borderColor: "#1B1B1F", paddingTop: "max(16px, env(safe-area-inset-top))", paddingBottom: 16 }}>
          <button onClick={onClose} className="p-1 active:scale-90 transition-transform"><ArrowLeft size={20} color="#F2F2F5" /></button>
          <Trophy size={18} color="#F5C542" />
          <h2 className="text-[17px] font-semibold" style={{ color: "#F2F2F5", fontFamily: "'Space Grotesk', sans-serif" }}>Рейтинг</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loading && <div className="text-center py-6 text-[13px]" style={{ color: "#6C6C76" }}>Загружаю…</div>}
          {!loading && rows.length === 0 && <div className="text-center py-6 text-[13px]" style={{ color: "#6C6C76" }}>Пока пусто</div>}
          {rows.map((u, i) => {
            const tier = getTitleTier(u.total_active_seconds);
            const isMe = u.id === myId;
            return (
              <div key={u.id} className="list-in flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1" style={{ background: isMe ? "#181A24" : "#131316", border: isMe ? "1px solid rgba(79,110,255,0.35)" : "1px solid transparent", animationDelay: `${i * 0.03}s` }}>
                <div className="w-7 text-center text-[15px] flex-shrink-0">{medals[i] || <span style={{ color: "#6C6C76", fontSize: 13 }}>{i + 1}</span>}</div>
                <TitleRing colors={tier.colors} size={38}><span className="text-[15px]">{u.avatar_emoji || "🙂"}</span></TitleRing>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] truncate" style={{ color: "#F2F2F5" }}>@{u.username}{isMe && <span style={{ color: "#8FA0FF" }}> · ты</span>}</div>
                  <div className="text-[11.5px]" style={{ color: tier.colors[0] }}>{tier.name}</div>
                </div>
                <div className="text-[12.5px] flex-shrink-0" style={{ color: "#8B8B94", fontFamily: "'JetBrains Mono', monospace" }}>
                  {Math.floor((u.total_active_seconds || 0) / 3600)} ч
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Панель "Данные" — усиленная защита: пароль + свежий SMS-код
// ============================================================

const VAULT_DEVICE_KEY = "alontito_vault_device";

function VaultPanel({ apiUrl, token, onClose }) {
  const [stage, setStage] = useState("loading");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [vaultToken, setVaultToken] = useState(null);
  const [items, setItems] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [newValue, setNewValue] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [hasTrustedDevice, setHasTrustedDevice] = useState(Boolean(localStorage.getItem(VAULT_DEVICE_KEY)));

  useEffect(() => {
    fetch(`${apiUrl}/api/vault/status`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => setStage(d.isSetup ? "locked" : "setup")).catch(() => setStage("setup"));
  }, [apiUrl, token]);

  useEffect(() => {
    if (stage !== "unlocked" || secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [stage, secondsLeft]);

  useEffect(() => {
    if (stage === "unlocked" && secondsLeft === 0) { setStage("locked"); setVaultToken(null); setItems([]); }
  }, [secondsLeft, stage]);

  async function setupPassword() {
    setError("");
    if (password.length < 6) return setError("Минимум 6 символов");
    if (password !== password2) return setError("Пароли не совпадают");
    try {
      const res = await fetch(`${apiUrl}/api/vault/setup`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStage("locked"); setPassword(""); setPassword2("");
    } catch (e) { setError(e.message); }
  }

  async function requestCode() {
    setError("");
    if (!password) return setError("Введи пароль хранилища");
    try {
      await fetch(`${apiUrl}/api/vault/request-code`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      setStage("codeSent");
    } catch (e) { setError("Не удалось отправить код"); }
  }

  async function doUnlock(extraBody) {
    const res = await fetch(`${apiUrl}/api/vault/unlock`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ password, ...extraBody }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (data.deviceToken) { localStorage.setItem(VAULT_DEVICE_KEY, data.deviceToken); setHasTrustedDevice(true); }
    setVaultToken(data.vaultToken);
    setSecondsLeft(data.expiresInSeconds || 300);
    const itemsRes = await fetch(`${apiUrl}/api/vault/items`, { headers: { Authorization: `Bearer ${token}`, "X-Vault-Token": data.vaultToken } });
    setItems(await itemsRes.json());
    setStage("unlocked");
    setPassword(""); setCode("");
  }

  // Если устройство уже "запомнено" — пробуем открыть сразу по паролю, без SMS-кода
  async function unlockWithDeviceOrRequestCode() {
    setError("");
    if (!password) return setError("Введи пароль хранилища");
    const deviceToken = localStorage.getItem(VAULT_DEVICE_KEY);
    if (deviceToken) {
      try {
        await doUnlock({ deviceToken });
        return;
      } catch (e) {
        // токен устройства не сработал (истёк/отозван) — просим код заново, как обычно
        localStorage.removeItem(VAULT_DEVICE_KEY);
        setHasTrustedDevice(false);
      }
    }
    requestCode();
  }

  async function unlock() {
    setError("");
    try { await doUnlock({ code }); } catch (e) { setError(e.message); }
  }

  function forgetDevice() {
    localStorage.removeItem(VAULT_DEVICE_KEY);
    setHasTrustedDevice(false);
  }

  async function addItem() {
    if (!newTitle.trim() || !newValue.trim()) return;
    const res = await fetch(`${apiUrl}/api/vault/items`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Vault-Token": vaultToken },
      body: JSON.stringify({ title: newTitle.trim(), value: newValue.trim() }),
    });
    if (res.ok) { const item = await res.json(); setItems((c) => [item, ...c]); setNewTitle(""); setNewValue(""); }
  }

  async function deleteItem(id) {
    await fetch(`${apiUrl}/api/vault/items/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}`, "X-Vault-Token": vaultToken } });
    setItems((c) => c.filter((i) => i.id !== id));
  }

  async function lockNow() {
    await fetch(`${apiUrl}/api/vault/lock`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "X-Vault-Token": vaultToken } });
    setVaultToken(null); setItems([]); setStage("locked");
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.55)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="panel-in w-full max-w-md h-full flex flex-col" style={{ background: "#0F0F12", borderLeft: "1px solid #1B1B1F" }}>
        <div className="flex items-center gap-3 px-5 border-b" style={{ borderColor: "#1B1B1F", paddingTop: "max(16px, env(safe-area-inset-top))", paddingBottom: 16 }}>
          <button onClick={onClose} className="p-1 active:scale-90 transition-transform"><ArrowLeft size={20} color="#F2F2F5" /></button>
          {stage === "unlocked" ? <Unlock size={18} color="#4ADE80" /> : <Lock size={18} color="#F2F2F5" />}
          <h2 className="text-[17px] font-semibold flex-1" style={{ color: "#F2F2F5", fontFamily: "'Space Grotesk', sans-serif" }}>Данные</h2>
          {stage === "unlocked" && <span className="text-[12px]" style={{ color: "#6C6C76", fontFamily: "'JetBrains Mono', monospace" }}>{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}</span>}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6">
          {stage === "loading" && <div className="text-center text-[13px]" style={{ color: "#6C6C76" }}>Загружаю…</div>}

          {stage === "setup" && (
            <div className="msg-in">
              <p className="text-[13px] mb-4" style={{ color: "#8B8B94" }}>Здесь — самая защищённая часть приложения: свой пароль плюс SMS-код при каждом входе. Задай пароль хранилища.</p>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Новый пароль (мин. 6 символов)" className="w-full px-4 py-2.5 rounded-xl outline-none text-[14.5px] mb-2" style={{ background: "#1C1C21", color: "#F2F2F5" }} />
              <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="Повтори пароль" className="w-full px-4 py-2.5 rounded-xl outline-none text-[14.5px] mb-3" style={{ background: "#1C1C21", color: "#F2F2F5" }} />
              {error && <p className="text-[12.5px] mb-2" style={{ color: "#FF6B6B" }}>{error}</p>}
              <button onClick={setupPassword} className="w-full py-3 rounded-xl font-semibold text-[14.5px] active:scale-[0.98] transition-transform" style={{ background: "linear-gradient(135deg, #4F6EFF, #7B5CFA)", color: "#fff" }}>Создать пароль хранилища</button>
            </div>
          )}

          {stage === "locked" && (
            <div className="msg-in">
              <div className="flex items-center gap-2 mb-4 px-3.5 py-2.5 rounded-xl" style={{ background: "#181A24", border: "1px solid rgba(79,110,255,0.2)" }}>
                <KeyRound size={15} color="#8FA0FF" />
                <span className="text-[12.5px]" style={{ color: "#8FA0FF" }}>
                  {hasTrustedDevice ? "Это устройство уже подтверждено — хватит пароля" : "Введи пароль хранилища, потом придёт код в SMS"}
                </span>
              </div>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль хранилища" className="w-full px-4 py-2.5 rounded-xl outline-none text-[14.5px] mb-3" style={{ background: "#1C1C21", color: "#F2F2F5" }} />
              {error && <p className="text-[12.5px] mb-2" style={{ color: "#FF6B6B" }}>{error}</p>}
              <button onClick={unlockWithDeviceOrRequestCode} className="w-full py-3 rounded-xl font-semibold text-[14.5px] active:scale-[0.98] transition-transform" style={{ background: "linear-gradient(135deg, #4F6EFF, #7B5CFA)", color: "#fff" }}>
                {hasTrustedDevice ? "Открыть" : "Прислать код"}
              </button>
            </div>
          )}

          {stage === "codeSent" && (
            <div className="msg-in">
              <p className="text-[13px] mb-3" style={{ color: "#8B8B94" }}>Код отправлен на твой телефон (в dev-режиме — смотри консоль сервера).</p>
              <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} maxLength={6} placeholder="6-значный код" className="w-full px-4 py-2.5 rounded-xl outline-none text-[16px] text-center tracking-widest mb-3" style={{ background: "#1C1C21", color: "#F2F2F5", fontFamily: "'JetBrains Mono', monospace" }} />
              {error && <p className="text-[12.5px] mb-2" style={{ color: "#FF6B6B" }}>{error}</p>}
              <button onClick={unlock} className="w-full py-3 rounded-xl font-semibold text-[14.5px] active:scale-[0.98] transition-transform" style={{ background: "linear-gradient(135deg, #4F6EFF, #7B5CFA)", color: "#fff" }}>Открыть хранилище</button>
            </div>
          )}

          {stage === "unlocked" && (
            <div className="msg-in">
              <div className="flex gap-2 mb-4">
                <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Название (напр. Wi-Fi дома)" className="flex-1 px-3 py-2.5 rounded-xl outline-none text-[13.5px]" style={{ background: "#1C1C21", color: "#F2F2F5" }} />
              </div>
              <div className="flex gap-2 mb-3">
                <input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Значение (пароль/заметка)" className="flex-1 px-3 py-2.5 rounded-xl outline-none text-[13.5px]" style={{ background: "#1C1C21", color: "#F2F2F5" }} />
                <button onClick={addItem} className="px-4 rounded-xl text-[13px] font-medium active:scale-95 transition-transform" style={{ background: "#1C1C21", color: "#8FA0FF" }}>+</button>
              </div>
              {items.map((it) => (
                <div key={it.id} className="list-in flex items-center gap-2 px-3 py-2.5 rounded-xl mb-1.5" style={{ background: "#131316" }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate" style={{ color: "#F2F2F5" }}>{it.title}</div>
                    <div className="text-[12.5px] truncate" style={{ color: "#8B8B94", fontFamily: "'JetBrains Mono', monospace" }}>{it.value}</div>
                  </div>
                  <button onClick={() => deleteItem(it.id)} className="p-1.5 active:scale-90 transition-transform"><Trash2 size={14} color="#FF6B6B" /></button>
                </div>
              ))}
              {items.length === 0 && <div className="text-[13px] text-center py-4" style={{ color: "#6C6C76" }}>Пусто. Добавь первую запись.</div>}
              <button onClick={lockNow} className="w-full py-2.5 rounded-xl text-[13.5px] font-medium mt-4 active:scale-[0.98] transition-transform flex items-center justify-center gap-2" style={{ background: "#1C1C21", color: "#8B8B94" }}><Lock size={13} /> Закрыть хранилище сейчас</button>
              {hasTrustedDevice && (
                <button onClick={forgetDevice} className="w-full py-2.5 rounded-xl text-[12.5px] font-medium mt-2 active:scale-[0.98] transition-transform" style={{ background: "transparent", color: "#FF6B6B" }}>Забыть это устройство (снова спрашивать SMS-код)</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Экран "О приложении" — политика конфиденциальности на RU и EN
// ============================================================

const PRIVACY_RU = `Alontito собирает минимум данных, необходимый для работы мессенджера.

ЧТО СОБИРАЕТСЯ
• Номер телефона — только для входа по SMS-коду
• Юзернейм, имя, эмодзи-аватар — то, что ты сам вводишь в профиле
• Текст сообщений и фотографии, которые ты отправляешь
• Время активности в приложении — для расчёта титулов
• Записи в разделе "Данные" — если ты сам их туда добавил

ГДЕ ЭТО ХРАНИТСЯ
Проект физически разделён на два независимых сервера:

1. identity-server — единственное место, где хранится номер телефона
   (в зашифрованном виде, AES-256-GCM) и пароль от раздела "Данные"
   (в необратимо хешированном виде). Этот сервер не принимает запросы
   напрямую из интернета — только от messenger-server, и только по
   секретному внутреннему ключу.

2. messenger-server — хранит переписку (тексты сообщений зашифрованы
   в базе), фото, публичный профиль (юзернейм, аватар, титул).
   Номер телефона этот сервер не хранит вообще.

Оба сервера физически могут работать на разных площадках — сейчас это
Render.com, регион по умолчанию — США/ЕС в зависимости от настроек
хостинга на момент деплоя.

КТО ИМЕЕТ ДОСТУП
• Обычные пользователи видят только переписку с теми, с кем сами
  начали диалог, и публичные профили (юзернейм, аватар, титул)
• Администратор приложения (номер +79950023339) может видеть список
  пользователей с замаскированными номерами (например, +7999••••39),
  блокировать аккаунты и удалять отдельные сообщения — но не может
  прочитать пароль хранилища "Данные" ни при каких условиях
• Разработчик имеет доступ к серверам как оператор инфраструктуры

ЗАЩИТА
• Сообщения шифруются в базе данных (AES-256-GCM)
• Пароли хранилища хешируются необратимо (bcrypt)
• Вход защищён лимитом попыток ввода SMS-кода (5 попыток, потом код
  нужно запросить заново)
• Раздел "Данные" требует отдельный пароль + свежий SMS-код при
  каждом входе, ключ шифрования содержимого выводится из пароля и не
  хранится на диске
• Ограничение количества запросов (rate limiting) против перебора

УДАЛЕНИЕ ДАННЫХ
Написать на контактный номер ниже с просьбой удалить аккаунт — данные
будут удалены из обеих баз данных.

ЭТО НЕ ЮРИДИЧЕСКИЙ ДОКУМЕНТ
Это технически честное описание того, что реально происходит с
данными в коде приложения. Это не заменяет полноценную политику
конфиденциальности, составленную юристом, и не является гарантией
соответствия 152-ФЗ "О персональных данных" или иным законам —
для реального коммерческого запуска нужна отдельная юридическая
проверка.

КОНТАКТ
+7 995 002-33-39`;

const PRIVACY_EN = `Alontito collects the minimum data required for the messenger to work.

WHAT WE COLLECT
• Phone number — only for SMS code login
• Username, display name, emoji avatar — whatever you enter yourself
• Message text and photos you send
• Time spent active in the app — used to calculate titles
• Entries in the "Data" vault — only if you added them yourself

WHERE IT IS STORED
The project is physically split across two independent servers:

1. identity-server — the only place your phone number is stored
   (encrypted, AES-256-GCM) and your vault password (irreversibly
   hashed). This server does not accept requests directly from the
   internet — only from messenger-server, using a secret internal key.

2. messenger-server — stores chat messages (encrypted in the
   database), photos, and your public profile (username, avatar,
   title). This server never stores your phone number at all.

Both servers may run in different locations — currently Render.com,
default region US/EU depending on hosting settings at deploy time.

WHO HAS ACCESS
• Regular users only see conversations they themselves started, and
  public profile info (username, avatar, title)
• The app administrator (+79950023339) can see a user list with
  masked phone numbers (e.g. +7999••••39), can ban accounts and
  delete individual messages — but can never read a vault password
  under any circumstances
• The developer has server access as the infrastructure operator

PROTECTION
• Messages are encrypted at rest (AES-256-GCM)
• Vault passwords are hashed irreversibly (bcrypt)
• Login is protected by an SMS code attempt limit (5 tries, then a
  new code must be requested)
• The "Data" vault requires a separate password plus a fresh SMS code
  on every unlock; the content encryption key is derived from the
  password and never written to disk
• Rate limiting against brute-force attempts

DATA DELETION
Contact the number below to request account deletion — data will be
removed from both databases.

THIS IS NOT A LEGAL DOCUMENT
This is a technically honest description of what actually happens to
data in the app's code. It does not replace a full privacy policy
drafted by a lawyer, and is not a guarantee of compliance with
Russian Federal Law 152-FZ or other applicable law — a real
commercial launch needs separate legal review.

CONTACT
+7 995 002-33-39`;

function AboutPanel({ onClose }) {
  const [lang, setLang] = useState("ru");
  const text = lang === "ru" ? PRIVACY_RU : PRIVACY_EN;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.55)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="panel-in w-full max-w-md h-full flex flex-col" style={{ background: "#0F0F12", borderLeft: "1px solid #1B1B1F" }}>
        <div className="flex items-center gap-3 px-5 border-b flex-shrink-0" style={{ borderColor: "#1B1B1F", paddingTop: "max(16px, env(safe-area-inset-top))", paddingBottom: 16 }}>
          <button onClick={onClose} className="p-1 active:scale-90 transition-transform"><ArrowLeft size={20} color="#F2F2F5" /></button>
          <Info size={18} color="#8FA0FF" />
          <h2 className="text-[17px] font-semibold flex-1" style={{ color: "#F2F2F5", fontFamily: "'Space Grotesk', sans-serif" }}>О приложении</h2>
          <button onClick={() => setLang((l) => (l === "ru" ? "en" : "ru"))} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-medium active:scale-95 transition-transform" style={{ background: "#1C1C21", color: "#8FA0FF" }}>
            <Globe size={12} /> {lang === "ru" ? "EN" : "RU"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4F6EFF, #7B5CFA)" }}>
              <Sparkles size={16} color="#fff" />
            </div>
            <div>
              <div className="text-[15px] font-semibold" style={{ color: "#F2F2F5", fontFamily: "'Space Grotesk', sans-serif" }}>Alontito</div>
              <div className="text-[11.5px]" style={{ color: "#6C6C76" }}>версия 1.1 · автор R_stepanov</div>
            </div>
          </div>

          <div className="flex items-start gap-2 mb-4 px-3.5 py-2.5 rounded-xl" style={{ background: "#1a1420", border: "1px solid rgba(250,180,80,0.25)" }}>
            <ShieldAlert size={15} color="#FAB450" className="flex-shrink-0 mt-0.5" />
            <span className="text-[12px]" style={{ color: "#FAB450" }}>
              {lang === "ru" ? "Это техническое описание, не юридический документ. Подробности — ниже." : "This is a technical description, not a legal document. Details below."}
            </span>
          </div>

          <pre className="whitespace-pre-wrap text-[12.5px] leading-relaxed" style={{ color: "#B8B8C0", fontFamily: "'Inter', sans-serif" }}>{text}</pre>

          <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-[13px] font-medium mt-4" style={{ background: "#1C1C21", color: "#8FA0FF" }}>
            <Globe size={13} /> {lang === "ru" ? "Открыть на отдельной странице" : "Open as a standalone page"}
          </a>

          <div className="flex items-center justify-center gap-2 mt-4 text-[13px]" style={{ color: "#8B8B94" }}>
            <Phone size={13} /> +7 995 002-33-39
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Основное приложение
// ============================================================

function App({ apiUrl, token, me: initialMe, onLogout }) {
  const [me, setMe] = useState(initialMe);
  const [conversations, setConversations] = useState([]);
  const [cache, setCache] = useState({});
  const cacheRef = useRef({});
  useEffect(() => { cacheRef.current = cache; }, [cache]);
  const [otherRead, setOtherRead] = useState({}); // conversationId -> upToMessageId
  const [selectedId, setSelectedId] = useState(AGENT_ID);
  const [mobileView, setMobileView] = useState("list");
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [peopleResults, setPeopleResults] = useState([]);
  const [searchingPeople, setSearchingPeople] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupQuery, setGroupQuery] = useState("");
  const [groupResults, setGroupResults] = useState([]);
  const [groupSelected, setGroupSelected] = useState([]);
  const [groupError, setGroupError] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [typingMap, setTypingMap] = useState({});
  const [wsConnected, setWsConnected] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatValue, setNewChatValue] = useState("");
  const [newChatError, setNewChatError] = useState("");
  const [loadingConv, setLoadingConv] = useState(false);
  const [pinnedByChat, setPinnedByChat] = useState({}); // conversationId -> [{id, text, ...}]
  const [profileOpen, setProfileOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [activeSeconds, setActiveSeconds] = useState(initialMe.totalActiveSeconds || 0);

  const wsRef = useRef(null);
  const pendingRef = useRef({});
  const fileInputRef = useRef(null);
  const typingTimeouts = useRef({});
  const scrollRef = useRef(null);
  const unsyncedSecondsRef = useRef(0);

  const myTier = getTitleTier(activeSeconds);

  // Считаем время, пока вкладка реально видна (не в фоне) — раз в секунду локально
  // для живого счётчика в UI, и раз в 30 сек шлём накопленное на сервер.
  useEffect(() => {
    const tick = setInterval(() => {
      if (document.visibilityState === "visible") {
        setActiveSeconds((s) => s + 1);
        unsyncedSecondsRef.current += 1;
      }
    }, 1000);

    const sync = setInterval(async () => {
      const seconds = unsyncedSecondsRef.current;
      if (seconds === 0) return;
      unsyncedSecondsRef.current = 0;
      try {
        await fetch(`${apiUrl}/api/me/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ seconds }),
        });
      } catch (e) { unsyncedSecondsRef.current += seconds; }
    }, 30000);

    return () => { clearInterval(tick); clearInterval(sync); };
  }, [apiUrl, token]);

  const agentChat = { ...seedAgentChat, messages: cache[AGENT_ID] || seedAgentChat.messages };

  useEffect(() => { setCache((c) => (c[AGENT_ID] ? c : { ...c, [AGENT_ID]: seedAgentChat.messages })); }, []);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/conversations`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (Array.isArray(data)) {
        setConversations(data);
        setOtherRead((prev) => {
          const next = { ...prev };
          data.forEach((c) => { if (next[c.id] === undefined) next[c.id] = c.other_last_read || 0; });
          return next;
        });
      }
    } catch (e) {}
  }, [apiUrl, token]);

  // Живой поиск людей по юзернейму/номеру (не по уже открытым чатам)
  useEffect(() => {
    if (query.trim().length < 2) { setPeopleResults([]); return; }
    setSearchingPeople(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${apiUrl}/api/users/search?q=${encodeURIComponent(query.trim())}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setPeopleResults(Array.isArray(data) ? data : []);
      } catch (e) {} finally { setSearchingPeople(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [query, apiUrl, token]);

async function startChatWithPerson(person) {
  setQuery("");
  setPeopleResults([]);

  try {
    const res = await fetch(`${apiUrl}/api/conversations/direct`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        identifier: person.username,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || `Ошибка создания чата (${res.status})`);
      return;
    }

    await loadConversations();
    
openChat(data.conversationId);
  } catch (e) {
    alert("Не удалось связаться с сервером. Попробуйте ещё раз.");
  }
}


  async function createGroup() {
    setGroupError("");
    if (!groupName.trim()) return setGroupError("Введи название группы");
    if (groupSelected.length === 0) return setGroupError("Добавь хотя бы одного участника");
    try {
      const res = await fetch(`${apiUrl}/api/conversations/group`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: groupName.trim(), members: groupSelected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось создать группу");
      setGroupOpen(false); setGroupName(""); setGroupQuery(""); setGroupSelected([]); setGroupResults([]);
      await loadConversations();
      openChat(data.conversationId);
    } catch (e) { setGroupError(e.message); }
  }

  useEffect(() => { loadConversations(); }, [loadConversations]);

  function sendRead(conversationId, upToMessageId) {
    if (wsRef.current?.readyState === 1 && upToMessageId) {
      wsRef.current.send(JSON.stringify({ type: "read", conversationId, upToMessageId }));
    }
  }

  useEffect(() => {
    let closedByUs = false, retryTimer;
    function connect() {
      const ws = new WebSocket(apiUrl.replace(/^http/, "ws") + `/ws?token=${token}`);
      wsRef.current = ws;
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => { setWsConnected(false); if (!closedByUs) retryTimer = setTimeout(connect, 2000); };
      ws.onerror = () => {};

      ws.onmessage = (e) => {
        let data; try { data = JSON.parse(e.data); } catch { return; }

        if (data.type === "message") {
          const m = data.message, convId = m.conversationId, isMine = m.senderId === me.id;
          setCache((prev) => {
            const list = prev[convId] || [];
            if (isMine) {
              const q = pendingRef.current[convId] || [];
              const tempId = q.shift();
              if (tempId) return { ...prev, [convId]: list.map((msg) => msg.id === tempId ? { id: m.id, role: "me", msgType: m.msgType, text: m.text, time: fmtTime(m.createdAt), status: "sent" } : msg) };
            }
            return { ...prev, [convId]: [...list, { id: m.id, role: isMine ? "me" : "them", senderName: m.senderUsername, msgType: m.msgType, text: m.text, time: fmtTime(m.createdAt), status: "sent" }] };
          });
          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.id === convId);
            if (idx === -1) { loadConversations(); return prev; }
            const updated = { ...prev[idx], last_text: m.text, last_time: m.createdAt };
            return [updated, ...prev.filter((_, i) => i !== idx)];
          });
          if (!isMine) {
            setTypingMap((t) => ({ ...t, [convId]: false }));
            if (convId === selectedIdRef.current) sendRead(convId, m.id);
          }
        }

        if (data.type === "typing") {
          setTypingMap((t) => ({ ...t, [data.conversationId]: true }));
          clearTimeout(typingTimeouts.current[data.conversationId]);
          typingTimeouts.current[data.conversationId] = setTimeout(() => setTypingMap((t) => ({ ...t, [data.conversationId]: false })), 2500);
        }

        if (data.type === "read") {
          setOtherRead((prev) => ({ ...prev, [data.conversationId]: Math.max(prev[data.conversationId] || 0, data.upToMessageId) }));
          setCache((prev) => {
            const list = prev[data.conversationId];
            if (!list) return prev;
            return { ...prev, [data.conversationId]: list.map((m) => (m.role === "me" && Number(m.id) <= data.upToMessageId ? { ...m, status: "read" } : m)) };
          });
        }

        if (data.type === "pin") {
          setPinnedByChat((prev) => {
            const list = prev[data.conversationId] || [];
            if (list.some((m) => m.id === data.messageId)) return prev;
            const fromCache = (cacheRef.current[data.conversationId] || []).find((m) => m.id === data.messageId);
            return { ...prev, [data.conversationId]: [...list, fromCache || { id: data.messageId, text: "" }] };
          });
        }
        if (data.type === "unpin") {
          setPinnedByChat((prev) => ({ ...prev, [data.conversationId]: (prev[data.conversationId] || []).filter((m) => m.id !== data.messageId) }));
        }
      };
    }
    connect();
    return () => { closedByUs = true; clearTimeout(retryTimer); wsRef.current?.close(); };
  }, [apiUrl, token, me.id, loadConversations]);

  const selectedIdRef = useRef(selectedId);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  async function openChat(id) {
    setSelectedId(id);
    setMobileView("chat");
    setReplyTo(null);
    if (id === AGENT_ID) return;

    if (!pinnedByChat[id]) {
      fetch(`${apiUrl}/api/conversations/${id}/pinned`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json()).then((list) => setPinnedByChat((p) => ({ ...p, [id]: Array.isArray(list) ? list : [] })))
        .catch(() => {});
    }

    if (!cache[id]) {
      setLoadingConv(true);
      try {
        const res = await fetch(`${apiUrl}/api/conversations/${id}/messages`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        const msgs = (Array.isArray(data) ? data : []).map((m) => ({ id: m.id, role: m.sender_id === me.id ? "me" : "them", senderName: m.sender_username, msgType: m.type, text: m.text, time: fmtTime(m.created_at), status: (otherRead[id] || 0) >= m.id ? "read" : "sent" }));
        setCache((c) => ({ ...c, [id]: msgs }));
        const lastIncoming = [...msgs].reverse().find((m) => m.role === "them");
        if (lastIncoming) sendRead(id, lastIncoming.id);
      } catch (e) {} finally { setLoadingConv(false); }
    } else {
      const list = cache[id];
      const lastIncoming = [...list].reverse().find((m) => m.role === "them");
      if (lastIncoming) sendRead(id, lastIncoming.id);
    }
  }

  async function togglePinMessage(msg) {
    const isPinned = (pinnedByChat[selectedId] || []).some((p) => p.id === msg.id);
    if (isPinned) {
      setPinnedByChat((p) => ({ ...p, [selectedId]: p[selectedId].filter((m) => m.id !== msg.id) }));
      await fetch(`${apiUrl}/api/conversations/${selectedId}/pin/${msg.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    } else {
      setPinnedByChat((p) => ({ ...p, [selectedId]: [...(p[selectedId] || []), msg] }));
      await fetch(`${apiUrl}/api/conversations/${selectedId}/pin`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messageId: msg.id }),
      }).catch(() => {});
    }
  }

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [selectedId, cache[selectedId]?.length]);

  function toggleReaction(chatId, msgId, emoji) {
    setCache((prev) => ({ ...prev, [chatId]: (prev[chatId] || []).map((m) => {
      if (m.id !== msgId) return m;
      const current = m.reactions?.[emoji] || [];
      const has = current.includes("me");
      return { ...m, reactions: { ...(m.reactions || {}), [emoji]: has ? current.filter((p) => p !== "me") : [...current, "me"] } };
    }) }));
  }

  async function streamAgent(chatId, historyMessages, { asInline, insertId } = {}) {
    const agentMsgId = insertId || uid();
    if (!insertId) setCache((c) => ({ ...c, [chatId]: [...(c[chatId] || []), { id: agentMsgId, role: asInline ? "ai-inline" : "them", text: "", time: "", streaming: true }] }));
    try {
      const response = await fetch(`${apiUrl}/api/ai/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: historyMessages }),
      });
      if (!response.ok || !response.body) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "network");
      }
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "", full = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n"); buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            const parts = data?.candidates?.[0]?.content?.parts;
            const chunkText = Array.isArray(parts) ? parts.map((p) => p.text || "").join("") : "";
            if (chunkText) {
              full += chunkText;
              setCache((c) => ({ ...c, [chatId]: (c[chatId] || []).map((m) => (m.id === agentMsgId ? { ...m, text: full } : m)) }));
            }
          } catch (e) {}
        }
      }
      setCache((c) => ({ ...c, [chatId]: (c[chatId] || []).map((m) => m.id === agentMsgId ? { ...m, streaming: false, time: nowTime() } : m) }));
    } catch (e) {
      setCache((c) => ({ ...c, [chatId]: (c[chatId] || []).map((m) => m.id === agentMsgId ? { ...m, text: `Не получилось получить ответ (${e.message}). Проверь, что на сервере задан GEMINI_API_KEY.`, streaming: false, time: nowTime() } : m) }));
    }
  }

  function sendChip(prompt) {
    if (selectedId !== AGENT_ID) return;
    const myMsg = { id: uid(), role: "me", text: prompt, time: nowTime(), status: "sent" };
    setCache((c) => ({ ...c, [AGENT_ID]: [...(c[AGENT_ID] || []), myMsg] }));
    const history = [...(cache[AGENT_ID] || []), myMsg].filter((m) => m.text).map((m) => ({ role: m.role === "me" ? "user" : "assistant", content: m.text }));
    streamAgent(AGENT_ID, history);
  }

  function handleSend() {
    const raw = input.trim(); if (!raw) return;

    if (selectedId === AGENT_ID) {
      const myMsg = { id: uid(), role: "me", text: raw, time: nowTime(), status: "sent" };
      setCache((c) => ({ ...c, [AGENT_ID]: [...(c[AGENT_ID] || []), myMsg] }));
      setInput("");
      const history = [...(cache[AGENT_ID] || []), myMsg].filter((m) => m.text).map((m) => ({ role: m.role === "me" ? "user" : "assistant", content: m.text }));
      streamAgent(AGENT_ID, history);
      return;
    }

    const isInlineAsk = /^\/ask\s+/i.test(raw) || /^@ai\s+/i.test(raw);
    if (isInlineAsk) {
      const question = raw.replace(/^\/ask\s+/i, "").replace(/^@ai\s+/i, "");
      const myMsg = { id: uid(), role: "me", text: raw, time: nowTime(), status: "sent" };
      setCache((c) => ({ ...c, [selectedId]: [...(c[selectedId] || []), myMsg] }));
      setInput("");
      const contextHistory = (cache[selectedId] || []).filter((m) => m.text && m.role !== "ai-inline").slice(-10).map((m) => ({ role: m.role === "me" ? "user" : "assistant", content: m.text }));
      streamAgent(selectedId, [...contextHistory, { role: "user", content: question }], { asInline: true });
      return;
    }

    const tempId = uid();
    const myMsg = { id: tempId, role: "me", text: raw, time: nowTime(), status: "sending", quote: replyTo ? { sender: replyTo.role === "me" ? "Вы" : "Собеседник", text: replyTo.text.slice(0, 80) } : undefined };
    setCache((c) => ({ ...c, [selectedId]: [...(c[selectedId] || []), myMsg] }));
    pendingRef.current[selectedId] = [...(pendingRef.current[selectedId] || []), tempId];
    wsRef.current?.readyState === 1 && wsRef.current.send(JSON.stringify({ type: "message", conversationId: selectedId, text: raw }));
    setConversations((prev) => { const idx = prev.findIndex((c) => c.id === selectedId); if (idx === -1) return prev; const updated = { ...prev[idx], last_text: raw, last_time: new Date().toISOString() }; return [updated, ...prev.filter((_, i) => i !== idx)]; });
    setInput(""); setReplyTo(null);
  }

  function handleTyping() { if (selectedId !== AGENT_ID) wsRef.current?.readyState === 1 && wsRef.current.send(JSON.stringify({ type: "typing", conversationId: selectedId })); }

  async function handleImagePick(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // чтобы можно было выбрать тот же файл повторно
    if (!file || selectedId === AGENT_ID) return;
    try {
      const dataUrl = await compressImageToDataUrl(file);
      const tempId = uid();
      const myMsg = { id: tempId, role: "me", msgType: "image", text: dataUrl, time: nowTime(), status: "sending" };
      setCache((c) => ({ ...c, [selectedId]: [...(c[selectedId] || []), myMsg] }));
      pendingRef.current[selectedId] = [...(pendingRef.current[selectedId] || []), tempId];
      wsRef.current?.readyState === 1 && wsRef.current.send(JSON.stringify({ type: "message", conversationId: selectedId, text: dataUrl, msgType: "image" }));
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === selectedId);
        if (idx === -1) return prev;
        const updated = { ...prev[idx], last_text: "📷 Фото", last_time: new Date().toISOString() };
        return [updated, ...prev.filter((_, i) => i !== idx)];
      });
    } catch (err) {
      console.error("Не удалось обработать изображение:", err);
    }
  }

  async function togglePinChat(convId, pinned) {
    setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, pinned } : c)));
    try {
      await fetch(`${apiUrl}/api/conversations/${convId}/pin-chat`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pinned }),
      });
      loadConversations();
    } catch (e) {}
  }

  async function startNewChat() {
    setNewChatError("");
    const identifier = newChatValue.trim(); if (!identifier) return;
    try {
      const res = await fetch(`${apiUrl}/api/conversations/direct`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ identifier }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось начать чат");
      await loadConversations();
      setNewChatOpen(false); setNewChatValue("");
      openChat(data.conversationId);
    } catch (e) { setNewChatError(e.message); }
  }

  const displayChats = [
    agentChat,
    ...conversations.map((c) => ({
      id: c.id,
      name: c.is_group ? (c.group_name || "Группа") : c.other_username ? `@${c.other_username}` : c.other_phone || "Диалог",
      last: c.last_text || "начните переписку",
      time: c.last_time ? fmtTime(c.last_time) : "",
      isAgent: false,
      isGroup: c.is_group,
      memberCount: c.member_count,
      avatarEmoji: c.is_group ? "👥" : c.other_avatar,
      pinned: c.pinned,
    })),
  ];
  const filteredChats = displayChats.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
  const selected = selectedId === AGENT_ID ? agentChat : displayChats.find((c) => c.id === selectedId);
  const selectedMessages = cache[selectedId] || [];

  return (
    <div className="w-full h-screen flex overflow-hidden" style={{ background: "#0C0C0F", fontFamily: "'Inter', sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>

      <div className={`${mobileView === "list" ? "flex" : "hidden"} sm:flex relative flex-col w-full sm:w-[340px] flex-shrink-0 border-r`} style={{ borderColor: "#1B1B1F", background: "#0F0F12" }}>
        <div className="px-4 pb-3" style={{ paddingTop: "max(20px, env(safe-area-inset-top))" }}>
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-[22px] font-semibold" style={{ color: "#F2F2F5", fontFamily: "'Space Grotesk', sans-serif" }}>Чаты</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: wsConnected ? "#4ADE80" : "#6C6C76", animation: wsConnected ? "pulseGreen 2s infinite" : "none" }} />
              {me.isAdmin && <button onClick={() => setAdminOpen(true)} className="p-1.5 rounded-full active:scale-90 transition-transform" style={{ background: "#1a1420" }}><Shield size={15} color="#FAB450" /></button>}
              <button onClick={() => setVaultOpen(true)} className="p-1.5 rounded-full active:scale-90 transition-transform" style={{ background: "#1C1C21" }}><Lock size={15} color="#8B8B94" /></button>
              <button onClick={() => setLeaderboardOpen(true)} className="p-1.5 rounded-full active:scale-90 transition-transform" style={{ background: "#1C1C21" }}><Trophy size={15} color="#F5C542" /></button>
              <button onClick={() => setProfileOpen(true)} className="p-1.5 rounded-full active:scale-90 transition-transform" style={{ background: "#1C1C21" }}><Settings size={15} color="#F2F2F5" /></button>
              <button onClick={() => setNewChatOpen(true)} className="p-1.5 rounded-full active:scale-90 transition-transform" style={{ background: "#1C1C21" }}><Plus size={16} color="#F2F2F5" /></button>
            </div>
          </div>

          <button onClick={() => setProfileOpen(true)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl mb-3 active:scale-[0.98] transition-transform" style={{ background: "#181A24", border: "1px solid rgba(79,110,255,0.2)" }}>
            <TitleRing colors={myTier.colors} size={30}><span className="text-[14px]">{me.avatarEmoji || "🙂"}</span></TitleRing>
            <span className="text-[12px] flex-1 text-left min-w-0" style={{ color: "#8FA0FF" }}>
              <span className="block truncate">{me.displayName || "Без имени"} · <b>@{me.username}</b></span>
              <span className="block text-[10.5px]" style={{ color: myTier.colors[0] }}>{myTier.name}</span>
            </span>
            <ChevronRight size={14} color="#8FA0FF" />
          </button>

          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "#1C1C21" }}>
            <Search size={16} color="#6C6C76" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по чатам или @юзернейм / номер" className="bg-transparent outline-none text-[14px] w-full" style={{ color: "#F2F2F5" }} />
          </div>

          {query.trim().length >= 2 && (
            <div className="mt-2 rounded-xl overflow-hidden" style={{ background: "#131316", border: "1px solid #232328" }}>
              <div className="px-3 py-1.5 text-[10.5px] uppercase tracking-wide" style={{ color: "#6C6C76" }}>
                {searchingPeople ? "Ищем…" : `Люди (${peopleResults.length})`}
              </div>
              {peopleResults.map((p) => (
                <button key={p.id} onClick={() => startChatWithPerson(p)} className="w-full flex items-center gap-2.5 px-3 py-2 text-left active:scale-[0.98] transition-transform" style={{ borderTop: "1px solid #1B1B1F" }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold flex-shrink-0" style={{ background: "#2A2A31", color: "#F2F2F5" }}>{p.username?.slice(0, 1).toUpperCase()}</div>
                  <span className="text-[13.5px]" style={{ color: "#F2F2F5" }}>@{p.username}</span>
                </button>
              ))}
              {!searchingPeople && peopleResults.length === 0 && <div className="px-3 py-2 text-[12.5px]" style={{ color: "#6C6C76" }}>Никого не нашли</div>}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3 flex flex-col gap-0.5">
          {filteredChats.map((c, i) => (
            <div
              key={c.id}
              className="group relative list-in flex items-center gap-1 rounded-xl transition-colors duration-150"
              style={{ background: c.id === selectedId ? "#1C1C21" : "transparent", animationDelay: `${i * 0.04}s` }}
              onMouseEnter={(e) => { if (c.id !== selectedId) e.currentTarget.style.background = "#17171A"; }}
              onMouseLeave={(e) => { if (c.id !== selectedId) e.currentTarget.style.background = "transparent"; }}
            >
              <button onClick={() => openChat(c.id)} className="flex-1 flex items-center gap-3 px-3 py-2.5 text-left min-w-0">
                <div className="relative flex-shrink-0">
                  <Avatar chat={c} size={46} />
                  {c.pinned && (
                    <span className="pin-in absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "#4F6EFF" }}>
                      <Pin size={9} color="#fff" fill="#fff" />
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium text-[15px]" style={{ color: "#F2F2F5", fontFamily: "'Space Grotesk', sans-serif" }}>{c.name}</span>
                    <span className="text-[11px] flex-shrink-0" style={{ color: "#6C6C76", fontFamily: "'JetBrains Mono', monospace" }}>{c.time}</span>
                  </div>
                  <span className="block truncate text-[13px]" style={{ color: c.isAgent ? "#8FA0FF" : "#8B8B94" }}>{typingMap[c.id] ? "печатает…" : c.last}</span>
                </div>
              </button>
              {!c.isAgent && (
                <button
                  onClick={(e) => { e.stopPropagation(); togglePinChat(c.id, !c.pinned); }}
                  className="flex-shrink-0 p-2 mr-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity active:scale-90"
                  style={{ background: c.pinned ? "#4F6EFF22" : "transparent" }}
                  title={c.pinned ? "Открепить" : "Закрепить"}
                >
                  {c.pinned ? <PinOff size={14} color="#4F6EFF" /> : <Pin size={14} color="#6C6C76" />}
                </button>
              )}
            </div>
          ))}
          {conversations.length === 0 && <div className="px-3 py-6 text-center text-[13px]" style={{ color: "#6C6C76" }}>Пока нет диалогов — нажми «+» и введи юзернейм или номер собеседника.</div>}
        </div>

        <button
          onClick={() => setGroupOpen(true)}
          className="absolute right-5 w-14 h-14 rounded-full flex items-center justify-center active:scale-90 transition-transform z-10"
          style={{ background: "linear-gradient(135deg, #4F6EFF, #7B5CFA)", boxShadow: "0 6px 20px rgba(79,110,255,0.45)", bottom: "max(20px, env(safe-area-inset-bottom))" }}
          title="Создать группу"
        >
          <Users size={22} color="#fff" />
        </button>
      </div>

      <div className={`${mobileView === "chat" ? "flex" : "hidden"} sm:flex flex-col flex-1 min-w-0`}>
        {selected ? (
          <>
            <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0" style={{ borderColor: "#1B1B1F", background: "#0F0F12", paddingTop: "max(12px, env(safe-area-inset-top))" }}>
              <button onClick={() => setMobileView("list")} className="sm:hidden p-1 -ml-1 active:scale-90 transition-transform" style={{ color: "#F2F2F5" }}><ArrowLeft size={20} /></button>
              <Avatar chat={selected} size={38} />
              <div className="min-w-0">
                <div className="font-medium text-[15px] truncate" style={{ color: "#F2F2F5", fontFamily: "'Space Grotesk', sans-serif" }}>{selected.name}</div>
                <div className="text-[12px]" style={{ color: "#6C6C76" }}>
                  {selectedId === AGENT_ID ? "на связи всегда" : selected.isGroup ? `${selected.memberCount || "—"} участников` : typingMap[selectedId] ? "печатает…" : wsConnected ? "в сети" : "нет соединения"}
                </div>
              </div>
            </div>

            {(pinnedByChat[selectedId] || []).length > 0 && (
              <div className="pinned-in flex flex-col gap-1 px-4 py-2 border-b flex-shrink-0" style={{ borderColor: "#1B1B1F", background: "#12141c" }}>
                {(pinnedByChat[selectedId] || []).map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <Pin size={12} color="#4F6EFF" className="flex-shrink-0" />
                    <span className="flex-1 min-w-0 truncate text-[12.5px]" style={{ color: "#B8B8C0" }}>{p.text}</span>
                    <button onClick={() => togglePinMessage(p)} className="flex-shrink-0 active:scale-90 transition-transform"><X size={13} color="#6C6C76" /></button>
                  </div>
                ))}
              </div>
            )}

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
              {loadingConv && <div className="text-center text-[12.5px] py-4" style={{ color: "#6C6C76" }}>Загружаю историю…</div>}
              {selectedMessages.map((m) => (
                <MessageBubble
                  key={m.id}
                  msg={m}
                  isAgentChat={selectedId === AGENT_ID}
                  showSender={Boolean(selected.isGroup)}
                  onReply={(msg) => setReplyTo(msg)}
                  onToggleReaction={(msgId, emoji) => toggleReaction(selectedId, msgId, emoji)}
                  onTogglePin={selectedId !== AGENT_ID ? togglePinMessage : undefined}
                  isPinned={(pinnedByChat[selectedId] || []).some((p) => p.id === m.id)}
                />
              ))}
              {typingMap[selectedId] && selectedId !== AGENT_ID && <div className="flex justify-start"><div className="rounded-2xl" style={{ background: "#1C1C21" }}><TypingDots /></div></div>}
            </div>

            {selectedId === AGENT_ID && (
              <div className="flex gap-2 px-4 pb-2 overflow-x-auto">
                {AI_CHIPS.map((chip) => <button key={chip.label} onClick={() => sendChip(chip.prompt)} className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-medium active:scale-95 transition-transform" style={{ background: "#181A24", color: "#8FA0FF", border: "1px solid rgba(79,110,255,0.25)" }}><Wand2 size={12} />{chip.label}</button>)}
              </div>
            )}

            {replyTo && (
              <div className="flex items-center justify-between gap-2 mx-4 mb-2 px-3 py-2 rounded-xl" style={{ background: "#181A24", borderLeft: "3px solid #4F6EFF" }}>
                <div className="min-w-0"><div className="text-[11px] font-medium" style={{ color: "#8FA0FF" }}>Ответ</div><div className="text-[13px] truncate" style={{ color: "#B8B8C0" }}>{replyTo.text}</div></div>
                <button onClick={() => setReplyTo(null)} className="flex-shrink-0 p-1"><X size={15} color="#6C6C76" /></button>
              </div>
            )}

            <div className="flex items-center gap-2 px-4 py-3 border-t flex-shrink-0" style={{ borderColor: "#1B1B1F", background: "#0F0F12", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
              {selectedId !== AGENT_ID && (
                <>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImagePick} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-transform" style={{ background: "#1C1C21" }}>
                    <ImagePlus size={18} color="#8B8B94" />
                  </button>
                </>
              )}
              <input value={input} onChange={(e) => { setInput(e.target.value); handleTyping(); }} onKeyDown={(e) => e.key === "Enter" && handleSend()} placeholder={selectedId === AGENT_ID ? "Спроси что угодно…" : "Сообщение · попробуй /ask вопрос"} className="flex-1 px-4 py-2.5 rounded-full outline-none text-[14.5px]" style={{ background: "#1C1C21", color: "#F2F2F5" }} />
              <button onClick={handleSend} disabled={!input.trim()} className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-transform" style={{ background: input.trim() ? "linear-gradient(135deg, #4F6EFF, #7B5CFA)" : "#1C1C21", opacity: input.trim() ? 1 : 0.5 }}><Send size={17} color="#fff" /></button>
            </div>
          </>
        ) : <div className="flex-1 flex items-center justify-center" style={{ color: "#6C6C76" }}>Выбери чат</div>}
      </div>

      {newChatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setNewChatOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl p-5" style={{ background: "#131316", animation: "modalIn 0.22s cubic-bezier(.2,.7,.3,1) both" }}>
            <h3 className="text-[16px] font-semibold mb-1" style={{ color: "#F2F2F5", fontFamily: "'Space Grotesk', sans-serif" }}>Новый диалог</h3>
            <p className="text-[12.5px] mb-3" style={{ color: "#6C6C76" }}>Юзернейм или номер телефона собеседника</p>
            <input value={newChatValue} onChange={(e) => setNewChatValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && startNewChat()} placeholder="@username или +79991234567" autoFocus className="w-full px-4 py-2.5 rounded-xl outline-none text-[14.5px] mb-2" style={{ background: "#1C1C21", color: "#F2F2F5" }} />
            {newChatError && <p className="text-[12px] mb-2" style={{ color: "#FF6B6B" }}>{newChatError}</p>}
            <div className="flex gap-2 mt-2">
              <button onClick={() => setNewChatOpen(false)} className="flex-1 py-2.5 rounded-xl text-[13.5px] font-medium active:scale-95 transition-transform" style={{ background: "#1C1C21", color: "#8B8B94" }}>Отмена</button>
              <button onClick={startNewChat} className="flex-1 py-2.5 rounded-xl text-[13.5px] font-medium active:scale-95 transition-transform" style={{ background: "linear-gradient(135deg, #4F6EFF, #7B5CFA)", color: "#fff" }}>Начать</button>
            </div>
          </div>
        </div>
      )}

      {groupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setGroupOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl p-5 max-h-[80vh] flex flex-col" style={{ background: "#131316", animation: "modalIn 0.22s cubic-bezier(.2,.7,.3,1) both" }}>
            <div className="flex items-center gap-2 mb-1">
              <Users size={17} color="#8FA0FF" />
              <h3 className="text-[16px] font-semibold" style={{ color: "#F2F2F5", fontFamily: "'Space Grotesk', sans-serif" }}>Новая группа</h3>
            </div>
            <p className="text-[12.5px] mb-3" style={{ color: "#6C6C76" }}>Название и участники (по юзернейму)</p>

            <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Название группы" className="w-full px-4 py-2.5 rounded-xl outline-none text-[14.5px] mb-2" style={{ background: "#1C1C21", color: "#F2F2F5" }} />

            {groupSelected.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {groupSelected.map((p) => (
                  <span key={p.id} onClick={() => toggleGroupMember(p)} className="badge-pop flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] cursor-pointer" style={{ background: "#4F6EFF22", color: "#8FA0FF", border: "1px solid #4F6EFF55" }}>
                    @{p.username} <X size={11} />
                  </span>
                ))}
              </div>
            )}

            <input value={groupQuery} onChange={(e) => setGroupQuery(e.target.value)} placeholder="Найти по юзернейму или номеру" className="w-full px-4 py-2.5 rounded-xl outline-none text-[14.5px] mb-2" style={{ background: "#1C1C21", color: "#F2F2F5" }} />

            <div className="flex-1 overflow-y-auto mb-2">
              {groupResults.filter((p) => !groupSelected.some((s) => s.id === p.id)).map((p) => (
                <button key={p.id} onClick={() => toggleGroupMember(p)} className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left active:scale-[0.98] transition-transform">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold flex-shrink-0" style={{ background: "#2A2A31", color: "#F2F2F5" }}>{p.username?.slice(0, 1).toUpperCase()}</div>
                  <span className="text-[13.5px]" style={{ color: "#F2F2F5" }}>@{p.username}</span>
                </button>
              ))}
            </div>

            {groupError && <p className="text-[12px] mb-2" style={{ color: "#FF6B6B" }}>{groupError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setGroupOpen(false)} className="flex-1 py-2.5 rounded-xl text-[13.5px] font-medium active:scale-95 transition-transform" style={{ background: "#1C1C21", color: "#8B8B94" }}>Отмена</button>
              <button onClick={createGroup} className="flex-1 py-2.5 rounded-xl text-[13.5px] font-medium active:scale-95 transition-transform" style={{ background: "linear-gradient(135deg, #4F6EFF, #7B5CFA)", color: "#fff" }}>Создать</button>
            </div>
          </div>
        </div>
      )}

      {profileOpen && <ProfilePanel apiUrl={apiUrl} token={token} me={{ ...me, totalActiveSeconds: activeSeconds }} setMe={setMe} onClose={() => setProfileOpen(false)} onLogout={onLogout} onOpenAbout={() => setAboutOpen(true)} />}
      {adminOpen && <AdminPanel apiUrl={apiUrl} token={token} onClose={() => setAdminOpen(false)} />}
      {vaultOpen && <VaultPanel apiUrl={apiUrl} token={token} onClose={() => setVaultOpen(false)} />}
      {aboutOpen && <AboutPanel onClose={() => setAboutOpen(false)} />}
      {leaderboardOpen && <LeaderboardPanel apiUrl={apiUrl} token={token} myId={me.id} onClose={() => setLeaderboardOpen(false)} />}
    </div>
  );
}

// Хранение сессии между открытиями приложения. Это не артефакт Claude.ai —
// это уже реальный отдельный сайт после деплоя, так что localStorage тут
// уместен и стандартен (в отличие от превью внутри чата, где он запрещён).
const SESSION_KEY = "alontito_session";

export default function Messenger() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (!saved) { setChecking(false); return; }
    try {
      const parsed = JSON.parse(saved);
      fetch(`${API_URL}/api/me`, { headers: { Authorization: `Bearer ${parsed.token}` } })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((me) => setSession({ token: parsed.token, me }))
        .catch(() => localStorage.removeItem(SESSION_KEY))
        .finally(() => setChecking(false));
    } catch { localStorage.removeItem(SESSION_KEY); setChecking(false); }
  }, []);

  function handleLoggedIn(token, me) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token }));
    setSession({ token, me });
  }
  function handleLogout() {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  }

  if (checking) {
    return <div className="w-full h-screen flex items-center justify-center" style={{ background: "#0C0C0F" }} />;
  }
  if (!session) return <LoginScreen onLoggedIn={handleLoggedIn} />;
  return <App apiUrl={API_URL} token={session.token} me={session.me} onLogout={handleLogout} />;
}
