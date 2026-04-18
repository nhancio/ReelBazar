"use client";
import React, { useEffect, useRef } from "react";
import { MEDIA } from "../lib/media";

const ORBIT_ICONS: { emoji: string; title: string }[] = [
  { emoji: "🎵", title: "TikTok" },
  { emoji: "📷", title: "Instagram" },
  { emoji: "▶️", title: "Video" },
  { emoji: "💬", title: "Chat" },
  { emoji: "✨", title: "Trending" },
  { emoji: "🔗", title: "Share" },
];

export default function Home() {
  const orbitNodeRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // Drawer
    const drawer = document.getElementById("mobileDrawer");
    const drawerOverlay = document.getElementById("drawerOverlay");
    const btnMenu = document.getElementById("btnMenu");

    function openDrawer(open: boolean) {
      if (!drawer || !drawerOverlay || !btnMenu) return;
      if (open) {
        drawer.classList.add("is-open");
        drawerOverlay.classList.add("is-open");
        drawer.setAttribute("aria-hidden", "false");
        btnMenu.setAttribute("aria-expanded", "true");
        document.body.classList.add("modal-open");
      } else {
        drawer.classList.remove("is-open");
        drawerOverlay.classList.remove("is-open");
        drawer.setAttribute("aria-hidden", "true");
        btnMenu.setAttribute("aria-expanded", "false");
        document.body.classList.remove("modal-open");
      }
    }

    const btnMenuClick = () => {
      if(drawer) openDrawer(!drawer.classList.contains("is-open"));
    };
    if (btnMenu) btnMenu.addEventListener("click", btnMenuClick);
    if (drawerOverlay) drawerOverlay.addEventListener("click", () => openDrawer(false));

    const aTags = drawer?.querySelectorAll("a");
    aTags?.forEach(a => a.addEventListener("click", () => openDrawer(false)));

    const keydownHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        openDrawer(false);
      }
    };
    document.addEventListener("keydown", keydownHandler);

    return () => {
      if (btnMenu) btnMenu.removeEventListener("click", btnMenuClick);
      if (drawerOverlay) drawerOverlay.removeEventListener("click", () => openDrawer(false));
      aTags?.forEach(a => a.removeEventListener("click", () => openDrawer(false)));
      document.removeEventListener("keydown", keydownHandler);
    };
  }, []);

  /* Elliptical “rolling” orbit: depth via scale, opacity, blur, and z-order between icons */
  useEffect(() => {
    const nodes = orbitNodeRefs.current;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const n = ORBIT_ICONS.length;

    const dims = () =>
      window.innerWidth <= 700 ? { rx: 132, ry: 40 } : { rx: 196, ry: 54 };

    const applyStatic = () => {
      const { rx, ry } = dims();
      for (let i = 0; i < n; i++) {
        const el = nodes[i];
        if (!el) continue;
        const a = (i * Math.PI * 2) / n;
        const x = Math.cos(a) * rx;
        const y = Math.sin(a) * ry;
        const nearness = (Math.sin(a) + 1) / 2;
        const scale = 0.58 + 0.42 * (1 - nearness * 0.9);
        const opacity = 0.55 + 0.45 * (1 - nearness * 0.85);
        el.style.zIndex = String(10 + Math.round(nearness * 20));
        el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
        el.style.opacity = String(opacity);
        el.style.filter = nearness > 0.62 ? "blur(0.45px)" : "none";
      }
    };

    if (mq.matches) {
      applyStatic();
      return;
    }

    let rafId = 0;
    const start = performance.now();
    const periodMs = 38_000;

    const tick = (now: number) => {
      const { rx, ry } = dims();
      const t = ((now - start) / periodMs) * Math.PI * 2;
      for (let i = 0; i < n; i++) {
        const el = nodes[i];
        if (!el) continue;
        const a = t + (i * Math.PI * 2) / n;
        const x = Math.cos(a) * rx;
        const y = Math.sin(a) * ry;
        const nearness = (Math.sin(a) + 1) / 2;
        const scale = 0.58 + 0.42 * (1 - nearness * 0.9);
        const opacity = 0.52 + 0.48 * (1 - nearness * 0.88);
        el.style.zIndex = String(10 + Math.round(nearness * 20));
        el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
        el.style.opacity = String(opacity);
        el.style.filter = nearness > 0.62 ? "blur(0.45px)" : "none";
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    const onResize = () => {
      if (mq.matches) applyStatic();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <>
      <div className="page-bg-lines" aria-hidden="true"></div>

      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="site-header">
        <nav className="site-nav site-nav--on-light" aria-label="Primary">
          <button type="button" className="nav-menu-btn" id="btnMenu" aria-label="Open menu" aria-expanded="false">
            <span></span>
          </button>
          <a href="#top" className="nav-brand logo-link">
            <img src={MEDIA.logo} alt="" className="nav-logo" width={28} height={28} />
            Rava
          </a>
          <a href="mailto:shopatrava@gmail.com" className="nav-cta" style={{textDecoration: "none"}}>Contact us</a>
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
          <a href="mailto:shopatrava@gmail.com">Contact</a>
        </nav>
      </aside>

      <main id="main-content" tabIndex={-1}>
      <section className="hero-panel" id="top">
      <div className="wrap">
        <header className="hero">
          <h1>Scroll.Tap.Buy</h1>
          <p>
            We eliminate friction between discovery and purchase, turning engaged viewers into instant buyers through one seamless platform.
          </p>
          <div className="hero-actions">
            <a href="https://app.rava.one/" className="btn-solid" style={{textDecoration: "none", display: "inline-block"}} rel="noopener noreferrer" target="_blank">Open Web App</a>
            <a href="mailto:shopatrava@gmail.com" className="btn-ghost" style={{textDecoration: "none"}}>Contact us</a>
          </div>
        </header>

        <div className="showcase">
          <div className="glow-behind" aria-hidden="true"></div>

          <div className="showcase-visual">
            <div className="orbit-roll" aria-hidden="true">
              {ORBIT_ICONS.map((item, i) => (
                <div
                  key={item.title}
                  className="orbit-roll-node"
                  ref={(el) => {
                    orbitNodeRefs.current[i] = el;
                  }}
                >
                  <span className="orbit-icon" title={item.title}>
                    {item.emoji}
                  </span>
                </div>
              ))}
            </div>

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
                      <div className="phone-avatar" id="phoneAvatarUi" style={{ backgroundImage: "url('https://i.pravatar.cc/80?img=12')" }}></div>
                      <svg className="phone-dots" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <circle cx="12" cy="5" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="12" cy="19" r="2" />
                      </svg>
                    </div>
                    <div className="follow-pills">
                      <div className="follow-pill">
                        <img src="https://i.pravatar.cc/48?img=33" alt="" width="22" height="22" />
                        <span id="pillLeft">Marcus has followed</span>
                      </div>
                      <div className="follow-pill">
                        <img src="https://i.pravatar.cc/48?img=47" alt="" width="22" height="22" />
                        <span id="pillRight">Priya has followed</span>
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
          <div className="partners">
            <p className="partners-label">30+ brand partners</p>
          </div>

          <div className="why-head">
            <span className="why-badge">Why Rava?</span>
            <h2>Why the fastest growing brands choose us.</h2>
          </div>

          <div className="insights-row">
            <article className="insight-card">
              <div className="insight-card-img">
                <img src={MEDIA.insight1} alt="AI creator matching" loading="lazy" decoding="async" />
              </div>
              <h3>🎯 AI Matches You With Perfect Creators</h3>
              <p>Skip months of searching. Find creators aligned with your brand in seconds.</p>
            </article>

            <article className="insight-card">
              <div className="insight-card-img">
                <img src={MEDIA.insight2} alt="Sales tracking dashboard" loading="lazy" decoding="async" />
              </div>
              <h3>💰 See Every Sale, Track Every Dollar</h3>
              <p>Direct reel-to-purchase attribution. Know exactly what your spend generates.</p>
            </article>

            <article className="insight-card">
              <div className="insight-card-img">
                <img src={MEDIA.insight3} alt="One tap checkout" loading="lazy" decoding="async" />
              </div>
              <h3>⚡ One Tap From Discovery to Checkout</h3>
              <p>Creators post. Shoppers scroll. Buyers click. Friction disappears.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="about-section" id="about">
        <div className="about-hero">
          <div className="about-hero-inner">
            <span className="tag-pill">About Us</span>
            <h2>
              A platform where users can shop directly from reels, eliminating all friction between content discovery and purchase. Seamless experience that converts viewers into buyers instantly for sellers.
            </h2>
            <div className="about-actions">
              <a href="mailto:shopatrava@gmail.com" className="btn-ghost" style={{textDecoration: "none"}}>Contact us</a>
            </div>
          </div>
        </div>
      </section>

      <section className="process-section" id="process">
        <div className="wrap">
          <div className="section-intro">
            <span className="why-badge">Our Process</span>
            <h2>How it works</h2>
          </div>
          <div className="process-grid">
            <article className="process-card" style={{backgroundImage: "url('https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&q=80&fit=crop')"}}>
              <div className="process-card-inner">
                <div>
                  <div className="process-num">01</div>
                  <h3>Authentic reels</h3>
                  <p>Fashion creators share reels showcasing products of brands.</p>
                </div>
              </div>
            </article>
            <article className="process-card" style={{backgroundImage: "url('https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&q=80&fit=crop')"}}>
              <div className="process-card-inner">
                <div>
                  <div className="process-num">02</div>
                  <h3>Smart matching</h3>
                  <p>Our algorithm connects brands with creators whose audience aligns perfectly.</p>
                </div>
              </div>
            </article>
            <article className="process-card" style={{backgroundImage: "url('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80&fit=crop')"}}>
              <div className="process-card-inner">
                <div>
                  <div className="process-num">03</div>
                  <h3>Engaging discovery</h3>
                  <p>Users scroll engaging content from their favorite creators.</p>
                </div>
              </div>
            </article>
            <article className="process-card" style={{backgroundImage: "url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80&fit=crop')"}}>
              <div className="process-card-inner">
                <div>
                  <div className="process-num">04</div>
                  <h3>Instant checkout</h3>
                  <p>Click the product. Purchase instantly. No redirects. No friction.</p>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="cta-final" id="get-started">
        <div className="cta-final-inner">
          <span className="tag-pill">Get Started</span>
          <h2>Turn your ambitious brand into a sensation.</h2>
          <p>Join our global network of innovators and watch your digital presence grow rapidly.</p>
          <div className="about-actions">
            <a href="https://app.rava.one/" className="btn-solid" style={{textDecoration: "none", display: "inline-block"}} rel="noopener noreferrer" target="_blank">Open Web App</a>
            <a href="mailto:shopatrava@gmail.com" className="btn-ghost" style={{textDecoration: "none"}}>Contact us</a>
          </div>
          <div className="cta-reels" aria-hidden="true">
            <div className="cta-reel-card" style={{backgroundImage: "url('https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80')"}}>
              <div className="cta-reel-badges"><span>👁 125M+</span><span>♥ 55K+</span></div>
            </div>
            <div className="cta-reel-card" style={{backgroundImage: "url('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80')"}}>
              <div className="cta-reel-badges"><span>👁 100M</span><span>♥ 1M+</span></div>
            </div>
            <div className="cta-reel-card" style={{backgroundImage: "url('https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&q=80')"}}>
              <div className="cta-reel-badges"><span>👁 88M</span><span>♥ 420K</span></div>
            </div>
            <div className="cta-reel-card" style={{backgroundImage: "url('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80')"}}>
              <div className="cta-reel-badges"><span>👁 200M+</span><span>♥ 2M</span></div>
            </div>
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
            <p style={{margin: "12px 0 0", opacity: 0.9, fontSize: "0.9rem"}}>Shop from reels—discovery to checkout in one flow.</p>
          </div>
          <div className="footer-links">
            <div className="footer-col">
              <h4>Main</h4>
              <a href="#why-rava">Why Rava</a>
              <a href="#about">About</a>
              <a href="#process">Process</a>
              <a href="mailto:shopatrava@gmail.com">Contact</a>
            </div>
            <div className="footer-col">
              <h4>Contact</h4>
              <div className="footer-contact-row"><span>→</span> <a href="mailto:shopatrava@gmail.com" style={{color: "inherit", textDecoration: "none"}}>shopatrava@gmail.com</a></div>
              <div className="footer-contact-row"><span>→</span> Hyderabad, India</div>
            </div>
          </div>
        </div>
      </footer>

    </>
  );
}
