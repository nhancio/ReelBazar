"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../lib/config";

interface CreatorStats {
  username: string;
  name?: string;
  profilePictureUrl?: string;
  followers: number;
  following?: number;
  mediaCount?: number;
  avgViews: number;
  avgLikes: number;
  avgComments: number;
  engagementRate: number;
  sampleSize: number;
  viewsEstimated: boolean;
  source: "instagram_login" | "business_discovery" | "public_profile";
}
interface Valuation {
  currency: "INR";
  perReel: number;
  perPost: number;
  perStory: number;
  packageTotal: number;
  monthlyPotential: number;
  monthlyAssumption: string;
  annualPotential: number;
  saleMultiplier: number;
  accountWorth: number;
  engagementModifier: number;
  estimated: boolean;
  formula: string;
}
interface CardData { stats: CreatorStats; valuation: Valuation; sample?: boolean }

const inr = (v: number) => "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(v);
const compactInr = (v: number) =>
  v >= 1e7 ? `₹${(v / 1e7).toFixed(2).replace(/\.?0+$/, "")} Cr` : v >= 1e5 ? `₹${(v / 1e5).toFixed(1).replace(/\.0$/, "")}L` : inr(v);
const compact = (v: number) => new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(v);
const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

/** Clearly-labelled demo data so the card can be previewed before Meta keys land. Never a real user. */
const SAMPLE: CardData = {
  sample: true,
  stats: {
    username: "sample.fashion.creator",
    name: "Sample Fashion Creator",
    followers: 248000, following: 412, mediaCount: 386,
    avgViews: 18500, avgLikes: 7200, avgComments: 480,
    engagementRate: 0.031, sampleSize: 25, viewsEstimated: false, source: "instagram_login",
  },
  valuation: {
    currency: "INR", perReel: 22500, perPost: 13500, perStory: 7500, packageTotal: 43500,
    monthlyPotential: 204000, monthlyAssumption: "4 reels · 4 posts · 8 stories a month",
    annualPotential: 2448000, saleMultiplier: 1.5, accountWorth: 3672000,
    engagementModifier: 0.94, estimated: false,
    formula: "Account worth ≈ (monthly brand-deal potential × 12) × 1.5",
  },
};

function downloadPng(card: CardData) {
  const { stats: s, valuation: v } = card;
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7a1f4d"/><stop offset=".55" stop-color="#431833"/><stop offset="1" stop-color="#db2777"/></linearGradient></defs>
<rect width="1080" height="1350" rx="48" fill="url(#g)"/>
<text x="72" y="110" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="#f9a8d4">RAVA · MY ACCOUNT WORTH</text>
<circle cx="140" cy="240" r="64" fill="#db2777"/><text x="140" y="258" text-anchor="middle" font-family="Arial" font-size="52" font-weight="700" fill="#fff">${esc((s.username[0] || "R").toUpperCase())}</text>
<text x="228" y="228" font-family="Arial" font-size="44" font-weight="700" fill="#fff">@${esc(s.username)}</text>
<text x="228" y="278" font-family="Arial" font-size="30" fill="#fbcfe8">${compact(s.followers)} followers · ${pct(s.engagementRate)} engagement</text>
<text x="72" y="430" font-family="Arial" font-size="32" fill="#f9a8d4">ESTIMATED ACCOUNT WORTH</text>
<text x="72" y="540" font-family="Arial" font-size="118" font-weight="800" fill="#fff">${compactInr(v.accountWorth)}</text>
<text x="72" y="600" font-family="Arial" font-size="28" fill="#fbcfe8">${esc(v.formula)}</text>
<g font-family="Arial"><rect x="72" y="680" width="288" height="180" rx="28" fill="rgba(255,255,255,.12)"/><rect x="396" y="680" width="288" height="180" rx="28" fill="rgba(255,255,255,.12)"/><rect x="720" y="680" width="288" height="180" rx="28" fill="rgba(255,255,255,.12)"/>
<text x="100" y="750" font-size="28" fill="#f9a8d4">AVG VIEWS</text><text x="100" y="820" font-size="52" font-weight="700" fill="#fff">${compact(s.avgViews)}</text>
<text x="424" y="750" font-size="28" fill="#f9a8d4">1 REEL</text><text x="424" y="820" font-size="52" font-weight="700" fill="#fff">${compactInr(v.perReel)}</text>
<text x="748" y="750" font-size="28" fill="#f9a8d4">1 POST</text><text x="748" y="820" font-size="52" font-weight="700" fill="#fff">${compactInr(v.perPost)}</text>
<rect x="72" y="900" width="288" height="180" rx="28" fill="rgba(255,255,255,.12)"/><rect x="396" y="900" width="624" height="180" rx="28" fill="rgba(255,255,255,.12)"/>
<text x="100" y="970" font-size="28" fill="#f9a8d4">1 STORY</text><text x="100" y="1040" font-size="52" font-weight="700" fill="#fff">${compactInr(v.perStory)}</text>
<text x="424" y="970" font-size="28" fill="#f9a8d4">MONTHLY POTENTIAL</text><text x="424" y="1040" font-size="52" font-weight="700" fill="#fff">${compactInr(v.monthlyPotential)}</text></g>
<text x="72" y="1220" font-family="Arial" font-size="30" font-weight="700" fill="#fff">rava.one/myacc</text>
<text x="72" y="1270" font-family="Arial" font-size="24" fill="#fbcfe8">Estimate only — based on India creator rate benchmarks.</text></svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas"); c.width = 1080; c.height = 1350;
    c.getContext("2d")?.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    c.toBlob((b) => {
      if (!b) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b); a.download = `rava-${s.username}-worth.png`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, "image/png");
  };
  img.src = url;
}

export default function MyAcc() {
  const [handle, setHandle] = useState("");
  const [card, setCard] = useState<CardData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loginConfigured, setLoginConfigured] = useState<boolean | null>(null);
  const [discoveryConfigured, setDiscoveryConfigured] = useState<boolean | null>(null);
  const exchanging = useRef(false);

  const showError = (e: unknown) => setNotice(e instanceof Error ? e.message : "Something went wrong. Try again.");

  const fetchCard = useCallback(async (path: string, init?: RequestInit) => {
    const res = await fetch(`${API_BASE_URL}${path}`, init);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if ((data as { code?: string }).code === "META_NOT_CONFIGURED") {
        const serverMsg = (data as { error?: string }).error;
        throw new Error(
          path.startsWith("/instagram/lookup")
            ? (serverMsg || "Couldn’t read that @handle. It may be private, or Instagram blocked the lookup — try again shortly.")
            : (serverMsg || "Live Instagram login isn't switched on yet (Meta app keys pending on the server). Preview the sample card below — your real numbers will never be guessed."),
        );
      }
      throw new Error((data as { error?: string }).error || "Instagram didn't return that account. It may be private or not a Creator/Business account.");
    }
    return data as CardData;
  }, []);

  useEffect(() => {
    fetch(`${API_BASE_URL}/instagram/config`)
      .then((r) => r.json())
      .then((d) => {
        setLoginConfigured(Boolean(d.loginConfigured));
        setDiscoveryConfigured(Boolean(d.discoveryConfigured));
      })
      .catch(() => {
        setLoginConfigured(false);
        setDiscoveryConfigured(false);
      });
    const q = new URLSearchParams(window.location.search);
    const code = q.get("code");
    if (q.get("error")) { setNotice("Instagram login was cancelled. You can still try a @handle lookup."); return; }
    if (!code || exchanging.current) return;
    exchanging.current = true;
    window.history.replaceState({}, "", window.location.pathname);
    setBusy("Connecting your Instagram…");
    fetchCard("/instagram/auth/exchange", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) })
      .then(setCard).catch(showError).finally(() => setBusy(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = handle.trim().replace(/^@/, "");
    if (!username) return;
    setBusy("Reading @handle…"); setNotice(null);
    try { setCard(await fetchCard(`/instagram/lookup?username=${encodeURIComponent(username)}`)); }
    catch (err) { showError(err); } finally { setBusy(null); }
  };

  const connect = async () => {
    setBusy("Opening Instagram…"); setNotice(null);
    try {
      const res = await fetch(`${API_BASE_URL}/instagram/auth/url`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || "Instagram login is not configured yet (Meta app keys pending on the server). Preview the sample card below.");
      window.location.href = data.url as string;
    } catch (err) { showError(err); setBusy(null); }
  };

  const track = (type: "share" | "download") => {
    if (!card || card.sample) return;
    fetch(`${API_BASE_URL}/instagram/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, username: card.stats.username }),
    }).catch(() => {});
  };

  const share = async () => {
    if (!card) return;
    track("share");
    const text = `My Instagram is worth an estimated ${compactInr(card.valuation.accountWorth)} 💅 1 reel ≈ ${inr(card.valuation.perReel)} · 1 post ≈ ${inr(card.valuation.perPost)} · 1 story ≈ ${inr(card.valuation.perStory)}. Check yours:`;
    const url = "https://rava.one/myacc";
    try {
      if (navigator.share) { await navigator.share({ title: "My Rava account worth", text, url }); return; }
      throw new Error("no-share");
    } catch { try { await navigator.clipboard.writeText(`${text} ${url}`); setNotice("Share text copied — paste it anywhere."); } catch { setNotice("Copy this link: https://rava.one/myacc"); } }
  };

  const s = card?.stats, v = card?.valuation;

  return (
    <main className="myacc">
      <header className="myacc-top">
        <span className="myacc-logo">Rava</span>
        <span className="myacc-badge">Free · No signup</span>
      </header>

      <section className="myacc-hero">
        <p className="myacc-eyebrow">✦ Instagram worth calculator</p>
        <h1>What is your Instagram <em>worth?</em></h1>
        <p className="myacc-sub">Drop your @handle for an instant estimate from your public profile — no Facebook Page needed. Connect Instagram later for private insights (views, engagement) when you want the accurate card.</p>

        <form className="myacc-form" onSubmit={lookup}>
          <span aria-hidden="true">@</span>
          <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="yourhandle" aria-label="Instagram handle" autoCapitalize="none" autoCorrect="off" />
          <button type="submit" disabled={!!busy}>{busy === "Reading @handle…" ? "Reading…" : "Get my card"}</button>
        </form>

        <div className="myacc-or"><span />or<span /></div>
        <button className="myacc-connect" onClick={connect} disabled={!!busy}>
          {busy && busy !== "Reading @handle…" ? busy : "Connect Instagram for accurate numbers"}
        </button>
        <p className="myacc-fine">
          @handle uses public Instagram profile stats (followers &amp; posts; views estimated). Connect is optional for accurate insights — we never see your password
          {loginConfigured === false ? " · Connect pending server keys" : ""}
          {discoveryConfigured === true ? " · Meta Discovery also available" : ""}
        </p>

        {notice && <p className="myacc-notice" role="status">{notice} <button onClick={() => { setCard(SAMPLE); setNotice(null); }}>Preview a sample card →</button></p>}
        {!card && !notice && <button className="myacc-sample" onClick={() => setCard(SAMPLE)}>Just curious? Preview a sample card →</button>}
      </section>

      {s && v && (
        <section className="myacc-card" aria-live="polite">
          {card.sample && <p className="myacc-sampletag">Sample card — demo numbers, not a real account</p>}
          <div className="myacc-cardhead">
            {s.profilePictureUrl ? <img src={s.profilePictureUrl} alt="" width={64} height={64} /> : <span className="myacc-avatar">{(s.username[0] || "R").toUpperCase()}</span>}
            <div>
              <strong>@{s.username}</strong>
              <span>
                {s.source === "instagram_login"
                  ? "Verified via Instagram login"
                  : s.source === "public_profile"
                    ? "Public profile · limited estimate"
                    : "Public data · limited estimate"}
                {s.viewsEstimated ? " · views estimated" : ""}
              </span>
            </div>
          </div>

          <p className="myacc-worthlabel">Estimated account worth</p>
          <p className="myacc-worth">{compactInr(v.accountWorth)}</p>
          <p className="myacc-formula">{v.formula} · Monthly potential {inr(v.monthlyPotential)} ({v.monthlyAssumption})</p>

          <div className="myacc-stats">
            <div><span>Followers</span><strong>{compact(s.followers)}</strong></div>
            <div><span>Engagement rate</span><strong>{pct(s.engagementRate)}</strong></div>
            <div><span>Avg views</span><strong>{compact(s.avgViews)}</strong></div>
            <div><span>Avg likes</span><strong>{compact(s.avgLikes)}</strong></div>
            <div><span>Avg comments</span><strong>{compact(s.avgComments)}</strong></div>
            <div><span>Posts</span><strong>{s.mediaCount ? compact(s.mediaCount) : "—"}</strong></div>
          </div>

          <div className="myacc-rates">
            <div><span>1 Reel</span><strong>{inr(v.perReel)}</strong></div>
            <div><span>1 Post</span><strong>{inr(v.perPost)}</strong></div>
            <div><span>1 Story</span><strong>{inr(v.perStory)}</strong></div>
          </div>

          <div className="myacc-actions">
            <button onClick={share}>Share my card</button>
            <button onClick={() => { if (card) { track("download"); downloadPng(card); } }}>Download PNG</button>
            {(s.source === "business_discovery" || s.source === "public_profile") && (
              <button onClick={connect}>Connect for accurate numbers</button>
            )}
          </div>
          <p className="myacc-disclaimer">Estimate only, from India creator-rate benchmarks (per-view reel slabs, engagement vs similar-sized accounts). Not a guarantee of earnings or sale price.</p>
        </section>
      )}

      <footer className="myacc-foot">
        <a href="/privacy">Privacy</a><a href="/terms">Terms</a><span>Estimates by Rava · rava.one/myacc</span>
      </footer>
    </main>
  );
}
