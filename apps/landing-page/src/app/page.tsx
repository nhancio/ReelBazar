"use client";
import React, { useEffect } from "react";
import { MEDIA } from "../lib/media";

/** Process steps. Art is a CSS gradient rather than a hotlinked stock photo — see globals.css. */
const STEPS = [
  {
    num: "01",
    title: "Creators post real outfits",
    body: "Fashion creators film the pieces they actually wear and tag every product in the reel.",
    art: "linear-gradient(150deg, #f472b6 0%, #db2777 55%, #6d2b4f 100%)",
  },
  {
    num: "02",
    title: "We match brand to audience",
    body: "Our matching model reads category, age and style signals to pair each brand with creators whose followers already buy in that lane.",
    art: "linear-gradient(150deg, #c084fc 0%, #9333ea 55%, #4c1d95 100%)",
  },
  {
    num: "03",
    title: "Shoppers discover by scrolling",
    body: "A fashion-only feed. No noise, no unrelated content — every reel is something you can own.",
    art: "linear-gradient(150deg, #fb923c 0%, #db2777 60%, #831843 100%)",
  },
  {
    num: "04",
    title: "One tap to checkout",
    body: "Tap the product in the reel and buy. No new tab, no hunting for the item, no drop-off.",
    art: "linear-gradient(150deg, #34d399 0%, #0d9488 55%, #134e4a 100%)",
  },
];

/** Decorative reel thumbnails in the closing CTA, served from our own /public. */
const CTA_REELS = [
  { img: MEDIA.insight1, label: "Streetwear" },
  { img: MEDIA.insight2, label: "Occasion" },
  { img: MEDIA.insight3, label: "Everyday" },
];

export default function Home() {
  useEffect(() => {
    // Drawer
    const drawer = document.getElementById("mobileDrawer");
    const drawerOverlay = document.getElementById("drawerOverlay");
    const btnMenu = document.getElementById("btnMenu");

    function openDrawer(open: boolean) {
      if (!drawer || !drawerOverlay || !btnMenu) return;
      drawer.classList.toggle("is-open", open);
      drawerOverlay.classList.toggle("is-open", open);
      drawer.setAttribute("aria-hidden", open ? "false" : "true");
      btnMenu.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.classList.toggle("modal-open", open);
    }

    const closeDrawer = () => openDrawer(false);
    const btnMenuClick = () => openDrawer(!drawer?.classList.contains("is-open"));

    btnMenu?.addEventListener("click", btnMenuClick);
    drawerOverlay?.addEventListener("click", closeDrawer);

    const aTags = drawer?.querySelectorAll("a");
    aTags?.forEach((a) => a.addEventListener("click", closeDrawer));

    const keydownHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    document.addEventListener("keydown", keydownHandler);

    return () => {
      btnMenu?.removeEventListener("click", btnMenuClick);
      drawerOverlay?.removeEventListener("click", closeDrawer);
      aTags?.forEach((a) => a.removeEventListener("click", closeDrawer));
      document.removeEventListener("keydown", keydownHandler);
    };
  }, []);

  // Scroll reveals. `js-motion` on <html> is what arms the hidden initial state, so the page
  // is fully readable if this effect never runs (JS off, hydration error, old browser).
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!targets.length) return;

    const reveal = (el: HTMLElement) => el.setAttribute("data-reveal", "in");

    // Honour the OS setting here too, not just in CSS: no observer, nothing hidden.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || typeof IntersectionObserver === "undefined") {
      targets.forEach(reveal);
      return;
    }

    document.documentElement.classList.add("js-motion");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          reveal(entry.target as HTMLElement);
          // One-shot: elements do not re-hide on the way back up.
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );

    targets.forEach((el) => observer.observe(el));

    // Belt and braces: if the observer never fires (a headless renderer, an aggressive
    // extension, a browser quirk), reveal everything anyway. A section arriving without its
    // animation is fine; a section that stays invisible forever is not.
    const failsafe = window.setTimeout(() => targets.forEach(reveal), 2500);

    return () => {
      window.clearTimeout(failsafe);
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="site-header">
        <nav className="site-nav site-nav--on-light" aria-label="Primary">
          <button
            type="button"
            className="nav-menu-btn"
            id="btnMenu"
            aria-label="Open menu"
            aria-expanded="false"
          >
            <span></span>
          </button>
          <a href="#top" className="nav-brand logo-link">
            <img src={MEDIA.logo} alt="" className="nav-logo" width={28} height={28} />
            Rava
          </a>
          <a href="mailto:shopatrava@gmail.com" className="nav-cta" style={{ textDecoration: "none" }}>
            Contact us
          </a>
        </nav>
      </header>

      <div className="drawer-overlay" id="drawerOverlay"></div>
      <aside className="mobile-drawer" id="mobileDrawer" aria-hidden="true">
        <div className="drawer-brand">
          <img src={MEDIA.logo} alt="" width={32} height={32} className="nav-logo" />
          <span>Rava</span>
        </div>
        <nav aria-label="Mobile">
          <a href="#why-rava">Why Rava</a>
          <a href="#about">About</a>
          <a href="#process">Process</a>
          <a href="https://app.rava.one/" target="_blank" rel="noopener noreferrer">Web App</a>
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms &amp; Conditions</a>
          <a href="/delete-account">Delete Account</a>
          <a href="mailto:shopatrava@gmail.com">Contact</a>
        </nav>
      </aside>

      <main id="main-content" tabIndex={-1}>
        <section className="hero-panel hero-panel--minimal" id="top">
          <div className="wrap">
            <header className="hero">
              <span className="hero-eyebrow">
                <i aria-hidden="true"></i> Shopping, rebuilt around the scroll
              </span>
              <h1>Scroll. Tap. Buy.</h1>
              <p>
                Every fashion reel on Rava is shoppable. See the outfit, tap the piece, own it —
                without ever leaving the feed.
              </p>
              <div className="hero-actions">
                <a
                  href="https://app.rava.one/"
                  className="btn-solid"
                  style={{ textDecoration: "none", display: "inline-block" }}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Open Web App
                </a>
                <a href="mailto:shopatrava@gmail.com" className="btn-ghost" style={{ textDecoration: "none" }}>
                  Talk to us
                </a>
              </div>
              <div className="hero-proof">
                <span>✦ Fashion-only feed</span>
                <span>✦ Creator-led discovery</span>
                <span>✦ Checkout without redirects</span>
              </div>
            </header>

            <div className="showcase showcase--phone-only">
              <div className="showcase-visual">
                <div className="phone-hand">
                  <div className="phone-stage">
                    <div className="phone-frame">
                      <div className="phone-frame-inner">
                        <div className="reels-viewport">
                          <video
                            className="hero-phone-video"
                            src={MEDIA.heroVideo}
                            autoPlay
                            muted
                            loop
                            playsInline
                            preload="metadata"
                            aria-label="Rava app preview — shop from fashion reels"
                          />
                        </div>

                        <div className="phone-ui">
                          <div className="phone-top-bar">
                            <div className="phone-avatar phone-avatar--initial" id="phoneAvatarUi">
                              A
                            </div>
                            <svg className="phone-dots" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                              <circle cx="12" cy="5" r="2" />
                              <circle cx="12" cy="12" r="2" />
                              <circle cx="12" cy="19" r="2" />
                            </svg>
                          </div>
                          <div className="follow-pills">
                            <div className="follow-pill">
                              <i aria-hidden="true">M</i>
                              <span id="pillLeft">Marcus started following</span>
                            </div>
                            <div className="follow-pill">
                              <i aria-hidden="true">P</i>
                              <span id="pillRight">Priya started following</span>
                            </div>
                          </div>
                          <div className="phone-actions">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <path d="M12 21s-6-4.35-6-10a4 4 0 0 1 8 0c0 5.65-6 10-6 10z" />
                            </svg>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8z" />
                            </svg>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                            </svg>
                          </div>
                          <div className="phone-bookmark">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                            </svg>
                          </div>
                          <div className="phone-home-bar"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="features-panel" id="why-rava">
          <div className="wrap">
            <div className="partners" data-reveal>
              <p className="partners-label">Built with fashion brands and creators in India</p>
            </div>

            <div className="why-head" data-reveal>
              <span className="why-badge">Why Rava?</span>
              <h2>The gap between wanting it and buying it is where sales die.</h2>
            </div>

            <div className="insights-row">
              <article className="insight-card" data-reveal style={{ "--i": 0 } as React.CSSProperties}>
                <div className="insight-svg" aria-hidden="true">
                  <svg viewBox="0 0 200 120" role="presentation">
                    <g stroke="#f9a8d4" strokeWidth="1.5" fill="none">
                      <path className="match-link" d="M100 60 L44 30" />
                      <path className="match-link" d="M100 60 L158 34" />
                      <path className="match-link" d="M100 60 L40 92" />
                      <path className="match-link" d="M100 60 L156 90" />
                    </g>
                    <circle cx="100" cy="60" r="20" fill="#db2777" />
                    <text
                      x="100"
                      y="64"
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="700"
                      fill="#fff"
                    >
                      BRAND
                    </text>
                    <g fill="#fff" stroke="#f472b6" strokeWidth="1.5">
                      <circle className="match-node" cx="44" cy="30" r="13" />
                      <circle className="match-node" cx="158" cy="34" r="13" />
                      <circle className="match-node" cx="40" cy="92" r="13" />
                      <circle className="match-node" cx="156" cy="90" r="13" />
                    </g>
                    <g fontSize="8" fontWeight="700" fill="#9d2f6a" textAnchor="middle">
                      <text x="44" y="33">92%</text>
                      <text x="158" y="37">88%</text>
                      <text x="40" y="95">85%</text>
                      <text x="156" y="93">81%</text>
                    </g>
                  </svg>
                </div>
                <h3>Find creators who actually fit</h3>
                <p>
                  Stop cold-DMing accounts and hoping. Matching reads category, audience age and
                  style so you brief creators whose followers already shop your lane.
                </p>
              </article>

              <article className="insight-card" data-reveal style={{ "--i": 1 } as React.CSSProperties}>
                <div className="insight-svg" aria-hidden="true">
                  <svg viewBox="0 0 200 120" role="presentation">
                    <line x1="10" y1="100" x2="190" y2="100" stroke="#f9a8d4" strokeWidth="1.5" />
                    {[28, 46, 38, 64, 52, 82, 74].map((h, i) => (
                      <rect
                        key={i}
                        className="chart-bar"
                        x={20 + i * 24}
                        y={100 - h}
                        width="14"
                        height={h}
                        rx="4"
                        fill={i === 5 ? "#db2777" : "#f9a8d4"}
                        style={{ "--b": i } as React.CSSProperties}
                      />
                    ))}
                    <g fontSize="8" fontWeight="700" fill="#9d2f6a">
                      <text x="140" y="12">Reel → sale</text>
                    </g>
                  </svg>
                </div>
                <h3>Attribution down to the reel</h3>
                <p>
                  Views and likes do not pay invoices. Every purchase traces back to the reel and
                  the creator that earned it, so you know what to spend again.
                </p>
              </article>

              <article className="insight-card" data-reveal style={{ "--i": 2 } as React.CSSProperties}>
                <div className="insight-card-img">
                  <img src={MEDIA.insight3} alt="" loading="lazy" decoding="async" />
                </div>
                <h3>Zero steps to purchase</h3>
                <p>
                  No bio link, no screenshot, no searching the site later. The product sits in the
                  reel and checkout happens where the wanting happened.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="about-section" id="about">
          <div className="about-hero">
            <div className="about-hero-inner" data-reveal>
              <span className="tag-pill">About Us</span>
              <h2>Fashion is discovered in reels. It should be bought there too.</h2>
              <p>
                People find what they want to wear by scrolling. Then the trail goes cold — a bio
                link, a screenshot, a search that never happens. Rava closes that gap: creators
                tag the pieces in their reels, shoppers buy in the same tap, and brands finally
                see which content sold what.
              </p>
              <div className="about-actions">
                <a href="mailto:shopatrava@gmail.com" className="btn-ghost" style={{ textDecoration: "none" }}>
                  Contact us
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="process-section" id="process">
          <div className="wrap">
            <div className="section-intro" data-reveal>
              <span className="why-badge">Our Process</span>
              <h2>How it works</h2>
            </div>
            <div className="process-grid">
              {STEPS.map((step, i) => (
                <article
                  key={step.num}
                  className="process-card"
                  data-reveal
                  style={{ "--i": i % 2 } as React.CSSProperties}
                >
                  <div
                    className="process-card-art"
                    data-num={step.num}
                    style={{ "--art": step.art } as React.CSSProperties}
                    aria-hidden="true"
                  >
                    <span className="process-card-glow" />
                  </div>
                  <div className="process-card-inner">
                    <div>
                      <div className="process-num">{step.num}</div>
                      <h3>{step.title}</h3>
                      <p>{step.body}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="cta-final" id="get-started">
          <div className="cta-final-inner" data-reveal>
            <span className="tag-pill">Get Started</span>
            <h2>Put your collection where people are already looking.</h2>
            <p>
              Brief the right creators, publish shoppable reels, and watch which ones actually
              move stock. Tell us what you sell and we will set you up.
            </p>
            <div className="about-actions">
              <a
                href="https://app.rava.one/"
                className="btn-solid"
                style={{ textDecoration: "none", display: "inline-block" }}
                rel="noopener noreferrer"
                target="_blank"
              >
                Open Web App
              </a>
              <a href="mailto:shopatrava@gmail.com" className="btn-ghost" style={{ textDecoration: "none" }}>
                Contact us
              </a>
            </div>
            <div className="cta-reels" aria-hidden="true">
              {CTA_REELS.map((reel, i) => (
                <div
                  key={reel.label}
                  className="cta-reel-card"
                  style={
                    {
                      backgroundImage: `url('${reel.img}')`,
                      "--i": i,
                      "--rot": `${(i - 1) * 5}deg`,
                    } as React.CSSProperties
                  }
                >
                  <div className="cta-reel-badges">
                    <span>{reel.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer" id="contact">
        <div className="footer-inner">
          <div className="footer-brand-box">
            <div className="nav-brand">
              <img src={MEDIA.logo} alt="" className="nav-logo nav-logo--footer" width={36} height={36} />
              Rava
            </div>
            <p style={{ margin: "12px 0 0", opacity: 0.9, fontSize: "0.9rem" }}>
              Shop from reels—discovery to checkout in one flow.
            </p>
            <div className="footer-partner-badges">
              <a
                href="https://launchigniter.com/product/rava?ref=badge-rava"
                className="footer-launch-badge"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src="https://launchigniter.com/api/badge/rava?theme=light"
                  alt="Featured on LaunchIgniter"
                  width={212}
                  height={55}
                />
              </a>
              <a
                href="https://fazier.com/launches/rava.one"
                className="footer-fazier-badge"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src="https://fazier.com/api/v1/public/badges/launch_badges.svg?badge_type=launched&theme=light"
                  alt="Fazier badge"
                  width={120}
                />
              </a>
            </div>
          </div>
          <div className="footer-links">
            <div className="footer-col">
              <h4>Main</h4>
              <a href="#why-rava">Why Rava</a>
              <a href="#about">About</a>
              <a href="#process">Process</a>
              <a href="mailto:shopatrava@gmail.com">Contact</a>
              <a href="https://app.rava.one/" target="_blank" rel="noopener noreferrer">
                Open Web App
              </a>
            </div>
            <div className="footer-col">
              <h4>Legal</h4>
              <a href="/privacy">Privacy Policy</a>
              <a href="/terms">Terms &amp; Conditions</a>
              <a href="/delete-account">Delete Account</a>
              <a href="mailto:shopatrava@gmail.com">Contact Support</a>
            </div>
            <div className="footer-col">
              <h4>Contact</h4>
              <div className="footer-contact-row">
                <span>→</span>{" "}
                <a href="mailto:shopatrava@gmail.com" style={{ color: "inherit", textDecoration: "none" }}>
                  shopatrava@gmail.com
                </a>
              </div>
              <div className="footer-contact-row">
                <span>→</span> Hyderabad, India
              </div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
