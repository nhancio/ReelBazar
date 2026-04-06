"use client";
import React, { useEffect, useRef } from "react";

const TRANS_MS = 650;

function initVerticalReelCarousel(track: HTMLElement | null, imageUrls: string[], intervalMs: number) {
  if (!track || !imageUrls.length) return;
  const len = imageUrls.length;
  const slides = imageUrls.concat(imageUrls[0]);
  slides.forEach((url) => {
    const div = document.createElement("div");
    div.className = "reel";
    div.style.backgroundImage = "url('" + url + "')";
    track.appendChild(div);
  });

  let index = 0;

  function tick() {
    index += 1;
    track!.style.transform = "translateY(-" + index * 100 + "%)";

    if (index === len) {
      window.setTimeout(() => {
        track!.style.transition = "none";
        index = 0;
        track!.style.transform = "translateY(0)";
        track!.offsetHeight; // trigger reflow
        track!.style.transition = "";
      }, TRANS_MS);
    }
  }

  return window.setInterval(tick, intervalMs);
}

const REEL_IMAGES = [
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80&fit=crop",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&q=80&fit=crop",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&q=80&fit=crop",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=600&q=80&fit=crop",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=600&q=80&fit=crop"
];

const SERVICE_REEL_IMAGES = [
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&q=80&fit=crop",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&q=80&fit=crop",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&q=80&fit=crop",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&q=80&fit=crop"
];

const NAMES_LEFT = ["Benjamin", "Marcus", "Sofia", "Jordan", "Alex"];
const NAMES_RIGHT = ["Angeline", "Priya", "Chris", "Taylor", "Sam"];

export default function Home() {
  const reelsTrackRef = useRef<HTMLDivElement>(null);
  const serviceReelsTrackRef = useRef<HTMLDivElement>(null);
  const pillLeftRef = useRef<HTMLSpanElement>(null);
  const pillRightRef = useRef<HTMLSpanElement>(null);
  const avatarUiRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const track = reelsTrackRef.current;
    if (!track) return;
    
    // Clear in case of strict mode double run
    track.innerHTML = '';
    if (serviceReelsTrackRef.current) serviceReelsTrackRef.current.innerHTML = '';

    const len = REEL_IMAGES.length;
    const slides = REEL_IMAGES.concat(REEL_IMAGES[0]);
    slides.forEach((url) => {
      const div = document.createElement("div");
      div.className = "reel";
      div.style.backgroundImage = "url('" + url + "')";
      track.appendChild(div);
    });

    let index = 0;

    function setFollowText() {
      const i = index % len;
      if (pillLeftRef.current) pillLeftRef.current.textContent = NAMES_LEFT[i % NAMES_LEFT.length] + " has followed";
      if (pillRightRef.current) pillRightRef.current.textContent = NAMES_RIGHT[i % NAMES_RIGHT.length] + " has followed";
      if (avatarUiRef.current) avatarUiRef.current.style.backgroundImage = "url('https://i.pravatar.cc/80?img=" + (12 + (i % 5)) + "')";
    }

    function goNext() {
      index += 1;
      track!.style.transform = "translateY(-" + index * 100 + "%)";

      if (index === len) {
        window.setTimeout(() => {
          if (!track) return;
          track.style.transition = "none";
          index = 0;
          track.style.transform = "translateY(0)";
          track.offsetHeight;
          track.style.transition = "";
        }, TRANS_MS);
      }
      setFollowText();
    }

    setFollowText();
    const interval1 = window.setInterval(goNext, 3200);
    const interval2 = initVerticalReelCarousel(serviceReelsTrackRef.current, SERVICE_REEL_IMAGES, 3400);

    // Modals and Drawer
    const drawer = document.getElementById("mobileDrawer");
    const drawerOverlay = document.getElementById("drawerOverlay");
    const btnMenu = document.getElementById("btnMenu");

    function openModal(el: HTMLElement | null) {
      if (!el) return;
      openDrawer(false);
      el.classList.add("is-open");
      el.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
    }

    function closeModal(el: HTMLElement | null) {
      if (!el) return;
      el.classList.remove("is-open");
      el.setAttribute("aria-hidden", "true");
      if (!document.querySelector(".modal-root.is-open")) {
        document.body.classList.remove("modal-open");
      }
    }

    function closeAllModals() {
      ["modalContact", "modalCase", "modalToast"].forEach(id => {
        closeModal(document.getElementById(id));
      });
    }

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

    const clickHandler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const openTrigger = t.closest && t.closest("[data-open]");
      if (openTrigger) {
        const kind = openTrigger.getAttribute("data-open");
        if (kind === "contact") {
          e.preventDefault();
          openModal(document.getElementById("modalContact"));
        } else if (kind === "case-studies") {
          e.preventDefault();
          openModal(document.getElementById("modalCase"));
        } else if (kind === "instagram") {
          e.preventDefault();
          const tTitle = document.getElementById("toastTitle");
          const tBody = document.getElementById("toastBody");
          if (tTitle) tTitle.textContent = "Instagram";
          if (tBody) tBody.textContent = "Profile links would open here in a production build.";
          openModal(document.getElementById("modalToast"));
        }
      }

      const closeTrigger = t.closest && t.closest("[data-close-modal]");
      if (closeTrigger) {
        const m = closeTrigger.closest(".modal-root") as HTMLElement;
        if (m) closeModal(m);
      }
    };

    document.addEventListener("click", clickHandler);

    const btnMenuClick = () => {
      if(drawer) openDrawer(!drawer.classList.contains("is-open"));
    };
    if (btnMenu) btnMenu.addEventListener("click", btnMenuClick);
    if (drawerOverlay) drawerOverlay.addEventListener("click", () => openDrawer(false));
    
    const aTags = drawer?.querySelectorAll("a");
    aTags?.forEach(a => a.addEventListener("click", () => openDrawer(false)));

    const keydownHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeAllModals();
        openDrawer(false);
      }
    };
    document.addEventListener("keydown", keydownHandler);

    const contactForm = document.getElementById("contactForm");
    const formSubmitHandler = (e: Event) => {
      e.preventDefault();
      closeModal(document.getElementById("modalContact"));
      const tTitle = document.getElementById("toastTitle");
      const tBody = document.getElementById("toastBody");
      if (tTitle) tTitle.textContent = "Message received";
      if (tBody) tBody.textContent = "Thanks! In a real app this would be sent to our team.";
      openModal(document.getElementById("modalToast"));
      (contactForm as HTMLFormElement).reset();
    };
    if (contactForm) contactForm.addEventListener("submit", formSubmitHandler);

    return () => {
      clearInterval(interval1);
      if (interval2) clearInterval(interval2);
      document.removeEventListener("click", clickHandler);
      if (btnMenu) btnMenu.removeEventListener("click", btnMenuClick);
      if (drawerOverlay) drawerOverlay.removeEventListener("click", () => openDrawer(false));
      aTags?.forEach(a => a.removeEventListener("click", () => openDrawer(false)));
      document.removeEventListener("keydown", keydownHandler);
      if (contactForm) contactForm.removeEventListener("submit", formSubmitHandler);
    };
  }, []);

  return (
    <>
      <div className="page-bg-lines" aria-hidden="true"></div>

      <header className="site-header">
        <nav className="site-nav site-nav--on-light" aria-label="Primary">
          <button type="button" className="nav-menu-btn" id="btnMenu" aria-label="Open menu" aria-expanded="false">
            <span></span>
          </button>
          <a href="#top" className="nav-brand logo-link">
            <svg className="nav-mark" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2.25c1.65 1.6 2.75 4.05 2.75 6.75 0 1.45-.28 2.82-.8 4.05l.75 6.2-2.7-2.55L9.3 17.3l.75-6.2A7.01 7.01 0 019.25 9c0-2.7 1.1-5.15 2.75-6.75zM12 10.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
            </svg>
            ReelBazaar
          </a>
          <button type="button" className="nav-cta" data-open="contact">Contact us</button>
        </nav>
      </header>

      <div className="drawer-overlay" id="drawerOverlay"></div>
      <aside className="mobile-drawer" id="mobileDrawer" aria-hidden="true">
        <nav aria-label="Mobile">
          <a href="#why-scrollix">Why ReelBazaar</a>
          <a href="#about">About</a>
          <a href="#process">Process</a>
          <a href="#services">Services</a>
          <a href="#pricing">Pricing</a>
          <a href="#team">Team</a>
          <a href="#contact">Contact</a>
        </nav>
      </aside>

      <section className="hero-panel" id="top">
      <div className="wrap">
        <header className="hero">
          <h1>Drive results through social media mastery.</h1>
          <p>
            We specialize in creating explosive viral growth that turns your brand into a social media sensation &amp; a market leader.
          </p>
          <div className="hero-actions">
            <a href="https://rb-app.nhancio.com/" className="btn-solid" style={{textDecoration: "none", display: "inline-block"}}>Open Web App</a>
            <button type="button" className="btn-ghost" data-open="contact">Contact us</button>
          </div>
        </header>

        <div className="showcase">
          <div className="glow-behind" aria-hidden="true"></div>

          <div className="orbit" aria-hidden="true">
            <span className="orbit-icon" title="TikTok">🎵</span>
            <span className="orbit-icon" title="Instagram">📷</span>
            <span className="orbit-icon" title="Video">▶️</span>
            <span className="orbit-icon" title="Chat">💬</span>
            <span className="orbit-icon" title="Trending">✨</span>
            <span className="orbit-icon" title="Share">🔗</span>
          </div>

          <div className="phone-hand">
            <div className="phone-stage">
              <div className="phone-frame">
                <div className="phone-frame-inner">
                  <div className="reels-viewport">
                    <div className="reels-track" id="reelsTrack" ref={reelsTrackRef}>
                      {/* Reels injected by JS */}
                    </div>
                  </div>

                  <div className="phone-ui">
                    <div className="phone-top-bar">
                      <div className="phone-avatar" id="phoneAvatarUi" ref={avatarUiRef} style={{backgroundImage: "url('https://i.pravatar.cc/80?img=12')"}}></div>
                      <svg className="phone-dots" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <circle cx="12" cy="5" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="12" cy="19" r="2" />
                      </svg>
                    </div>
                    <div className="follow-pills">
                      <div className="follow-pill">
                        <img src="https://i.pravatar.cc/48?img=33" alt="" width="22" height="22" />
                        <span id="pillLeft" ref={pillLeftRef}>Benjamin has followed</span>
                      </div>
                      <div className="follow-pill">
                        <img src="https://i.pravatar.cc/48?img=47" alt="" width="22" height="22" />
                        <span id="pillRight" ref={pillRightRef}>Angeline has followed</span>
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
      </section>

      <section className="features-panel" id="why-scrollix">
        <div className="wrap">
          <div className="partners">
            <p className="partners-label">150+ Satisfied brand-partners</p>
            <div className="partners-logos" aria-hidden="true">
              <span>U-Turn</span>
              <span>Berlin.</span>
              <span>Imprintify</span>
              <span>oslo.</span>
              <span>theo</span>
              <span>Nimbus</span>
            </div>
          </div>

          <div className="why-head">
            <span className="why-badge">Why ReelBazaar?</span>
            <h2>Why the fastest growing brands choose us.</h2>
          </div>

          <div className="insights-row">
            <article className="insight-card">
              <div className="insight-card-visual--pills">
                <div className="stat-pill">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 20V8M12 20V4M20 20v-8" strokeLinecap="round" /></svg>
                  +85% Reach in 30 days
                </div>
                <div className="stat-pill">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /></svg>
                  2x Higher convers.
                </div>
                <div className="stat-pill">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                  10x Viral reach
                </div>
              </div>
              <h3>Fast Growth</h3>
              <p>Achieve higher engagement, stronger reach, and measurable growth.</p>
            </article>

            <article className="insight-card">
              <div className="chart-weeks">
                <svg viewBox="0 0 320 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <text x="10" y="18" fill="#64748b" fontSize="11" fontFamily="DM Sans, sans-serif">Week 1</text>
                  <text x="88" y="18" fill="#64748b" fontSize="11" fontFamily="DM Sans, sans-serif">Week 2</text>
                  <text x="166" y="18" fill="#64748b" fontSize="11" fontFamily="DM Sans, sans-serif">Week 3</text>
                  <text x="244" y="18" fill="#64748b" fontSize="11" fontFamily="DM Sans, sans-serif">Week 4</text>
                  <path d="M0 115H320" stroke="#e2e8f0" strokeWidth="1" />
                  <path d="M32 98 L96 82 L160 88 L224 52 L288 38" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  <circle cx="32" cy="98" r="5" fill="#fff" stroke="#0f172a" strokeWidth="2" />
                  <circle cx="96" cy="82" r="5" fill="#fff" stroke="#0f172a" strokeWidth="2" />
                  <circle cx="160" cy="88" r="5" fill="#fff" stroke="#0f172a" strokeWidth="2" />
                  <circle cx="224" cy="52" r="5" fill="#fff" stroke="#0f172a" strokeWidth="2" />
                  <circle cx="288" cy="38" r="5" fill="#fff" stroke="#0f172a" strokeWidth="2" />
                </svg>
              </div>
              <h3>Clear Analytics</h3>
              <p>See real performance insights through clear and transparent reports.</p>
            </article>

            <article className="insight-card insight-card--dark">
              <div className="insight-bg" style={{backgroundImage: "url('https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=900&q=80&fit=crop')"}}></div>
              <div className="insight-inner">
                <h3>Scale with our expert team</h3>
                <p className="sub">Expert strategies designed to help your brand dominate social.</p>
                <div className="insight-actions">
                  <button type="button" className="btn-pill btn-pill--white" data-open="contact">Get Started</button>
                  <button type="button" className="btn-pill btn-pill--glass" data-open="case-studies">View Case Studies</button>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="about-section" id="about">
        <div className="about-hero">
          <div className="about-hero-inner">
            <span className="tag-pill">About Us</span>
            <h2>Our platform transforms ambitious digital brands into viral sensations through expert social media mastery.</h2>
            <div className="about-actions">
              <button type="button" className="btn-solid" data-open="case-studies">View Case Studies</button>
              <button type="button" className="btn-ghost" data-open="contact">Contact us</button>
            </div>
          </div>
        </div>
      </section>

      <section className="process-section" id="process">
        <div className="wrap">
          <div className="section-intro">
            <span className="why-badge">Our Process</span>
            <h2>From initial audit to global brand success.</h2>
          </div>
          <div className="process-grid">
            <article className="process-card" style={{backgroundImage: "url('https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&q=80&fit=crop')"}}>
              <div className="process-card-inner">
                <div>
                  <div className="process-num">01</div>
                  <h3>Audit your social brand</h3>
                  <p>We analyze your current digital presence in detail thoroughly today.</p>
                </div>
                <div className="process-tags">
                  <span className="process-tag">✓ Audit Report</span>
                  <span className="process-tag">✓ Data First</span>
                </div>
              </div>
            </article>
            <article className="process-card" style={{backgroundImage: "url('https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&q=80&fit=crop')"}}>
              <div className="process-card-inner">
                <div>
                  <div className="process-num">02</div>
                  <h3>Design your viral plan</h3>
                  <p>Our team creates high-impact social hooks that convert effectively fast.</p>
                </div>
                <div className="process-tags">
                  <span className="process-tag">✓ Strategy</span>
                  <span className="process-tag">✓ Content Roadmap</span>
                </div>
              </div>
            </article>
            <article className="process-card" style={{backgroundImage: "url('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80&fit=crop')"}}>
              <div className="process-card-inner">
                <div>
                  <div className="process-num">03</div>
                  <h3>Launch &amp; optimize</h3>
                  <p>We ship campaigns, monitor performance, and iterate in real time.</p>
                </div>
                <div className="process-tags">
                  <span className="process-tag">✓ Live Deployment</span>
                  <span className="process-tag">✓ Presence</span>
                </div>
              </div>
            </article>
            <article className="process-card" style={{backgroundImage: "url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80&fit=crop')"}}>
              <div className="process-card-inner">
                <div>
                  <div className="process-num">04</div>
                  <h3>Scale &amp; sustain</h3>
                  <p>Scale winning creatives and reporting as your brand grows globally.</p>
                </div>
                <div className="process-tags">
                  <span className="process-tag">✓ Scaling</span>
                  <span className="process-tag">✓ Analytics</span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="services-section" id="services">
        <div className="wrap">
          <div className="section-intro">
            <span className="why-badge">Our Services</span>
          </div>
          <div className="services-head">
            <h2>Unlock your brands true potential with us.</h2>
            <button type="button" className="nav-cta" data-open="case-studies">View Case Studies</button>
          </div>

          <div className="service-card-lg service-card-lg--split">
            <div className="phone-mock--sm">
              <div className="phone-frame">
                <div className="phone-frame-inner">
                  <div className="reels-viewport mini-reels">
                    <div className="reels-track" id="serviceReelsTrack" ref={serviceReelsTrackRef}></div>
                  </div>
                  <div className="svc-app-screen">
                    <div className="svc-app-top">
                      <span>←</span>
                      <span>☰</span>
                    </div>
                    <div className="svc-hero-blur">
                      <strong>Viral stories that convert</strong>
                      <span style={{opacity: 0.85}}>Watch our viral stories.</span>
                      <div style={{marginTop: "8px"}}><button type="button" className="btn-pill btn-pill--white" style={{padding: "6px 12px", fontSize: "9px"}} data-open="case-studies">Watch Now</button></div>
                    </div>
                    <div className="svc-stories-h">
                      <span>Stories</span>
                      <span style={{background: "var(--blue)", color: "#fff", padding: "2px 6px", borderRadius: "4px", fontSize: "8px"}}>New</span>
                    </div>
                    <div className="svc-stories-grid">
                      <div className="svc-thumb" style={{backgroundImage: "url('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80')"}}></div>
                      <div className="svc-thumb" style={{backgroundImage: "url('https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80')"}}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <span className="service-kicker">Viral Growth</span>
              <h3>Content Marketing</h3>
              <p className="lead">We engineer viral short-form videos that capture attention and grow your community presence organically online.</p>
              <ul className="check-list">
                <li>Expert Video Editing</li>
                <li>Content Calendar Planning</li>
                <li>Viral Script Writing</li>
              </ul>
            </div>
          </div>

          <div className="service-card-lg service-card-lg--split">
            <div>
              <span className="service-kicker">Brand Growth</span>
              <h3>Social Media Marketing</h3>
              <p className="lead">We manage your entire social presence to build community trust and drive consistent organic engagement.</p>
              <ul className="check-list">
                <li>Multi-Platform Account Management</li>
                <li>Community Engagement &amp; Growth</li>
                <li>Viral Trend Integration Strategy</li>
              </ul>
            </div>
            <div className="phone-mock--sm">
              <div className="phone-frame">
                <div className="phone-frame-inner">
                  <div className="reels-viewport" style={{background: "linear-gradient(180deg, #0f172a, #1e293b)"}}>
                    <div className="svc-app-screen">
                      <div className="svc-app-top">
                        <span>←</span>
                        <span>☰</span>
                      </div>
                      <div style={{textAlign: "center", margin: "12px 0"}}>
                        <svg className="nav-mark" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style={{color: "var(--blue)", margin: "0 auto"}}><path d="M12 2.25c1.65 1.6 2.75 4.05 2.75 6.75 0 1.45-.28 2.82-.8 4.05l.75 6.2-2.7-2.55L9.3 17.3l.75-6.2A7.01 7.01 0 019.25 9c0-2.7 1.1-5.15 2.75-6.75z" /></svg>
                        <p style={{margin: "8px 0 4px", fontWeight: "700"}}>Manage all your socials</p>
                        <p style={{margin: "0", opacity: 0.8, fontSize: "9px"}}>Grow your audience</p>
                        <button type="button" className="btn-pill" style={{marginTop: "12px", background: "#fff", color: "#0f172a", fontSize: "9px", padding: "8px 16px"}} data-open="contact">Get Started</button>
                      </div>
                      <div className="app-icon-grid">
                        <div className="app-icon" style={{background: "linear-gradient(135deg, #f09433, #e6683c, #dc2743)"}}>◎</div>
                        <div className="app-icon" style={{background: "#1877f2"}}>f</div>
                        <div className="app-icon" style={{background: "#ff0000"}}>▶</div>
                        <div className="app-icon" style={{background: "#000"}}> @</div>
                        <div className="app-icon" style={{background: "#25d366"}}>W</div>
                        <div className="app-icon" style={{background: "#111"}}>♪</div>
                        <div className="app-icon" style={{background: "#1da1f2"}}>𝕏</div>
                        <div className="app-icon" style={{background: "#e60023"}}>P</div>
                        <div className="app-icon" style={{background: "#0088cc"}}>T</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="service-card-lg service-card-lg--split reverse">
            <div className="phone-mock--sm">
              <div className="phone-frame">
                <div className="phone-frame-inner">
                  <div className="reels-viewport" style={{background: "linear-gradient(180deg, #f8fafc, #e2e8f0)"}}>
                    <div className="svc-app-screen" style={{color: "#0f172a", pointerEvents: "auto"}}>
                      <div className="svc-app-top">
                        <span>←</span>
                        <span>☰</span>
                      </div>
                      <p style={{margin: "8px 0 0", fontSize: "9px", opacity: 0.7}}>Scaling results</p>
                      <p style={{margin: "4px 0", fontSize: "13px", fontWeight: "700"}}>Active Campaign</p>
                      <p style={{margin: "0 0 8px", fontSize: "9px"}}>Scale your sales</p>
                      <span className="roi-badge">4.7x ROI</span>
                      <div style={{borderRadius: "12px", overflow: "hidden", marginTop: "40px", aspectRatio: "1/1.1", background: "center / cover url('https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500&q=80')"}}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <span className="service-kicker">Paid Results</span>
              <h3>Advertising marketing</h3>
              <p className="lead">We deploy high-converting paid campaigns designed to maximize your return on investment and scale revenue.</p>
              <ul className="check-list">
                <li>Precision Audience Targeting</li>
                <li>Performance Creative Testing</li>
                <li>ROI &amp; Attribution Reporting</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="pricing-section" id="pricing">
        <div className="wrap">
          <div className="section-intro">
            <span className="why-badge">Pricing Plans</span>
            <h2>Flexible pricing plans for viral brand growth.</h2>
          </div>
          <div className="pricing-grid">
            <div className="price-card price-card--lite">
              <div className="price-card-top">
                <h3>⭐ Starter</h3>
              </div>
              <span className="price-tag">Basic</span>
              <div className="price-amount">$499/month</div>
              <p className="price-sub">Launch your viral brand journey.</p>
              <div className="price-features">
                <div className="price-feature">
                  <div>
                    <strong>Social Brand Audit</strong>
                    <span>Find your growth gaps.</span>
                  </div>
                </div>
                <div className="price-feature">
                  <div>
                    <strong>Content Forge</strong>
                    <span>Three viral posts every week.</span>
                  </div>
                </div>
                <div className="price-feature">
                  <div>
                    <strong>Algorithm Hook Guide</strong>
                    <span>Master the basic feed triggers.</span>
                  </div>
                </div>
                <div className="price-feature">
                  <div>
                    <strong>Growth Tracking</strong>
                    <span>Basic metric reports.</span>
                  </div>
                </div>
              </div>
              <button type="button" className="btn-price btn-price--blue" data-open="contact">Get Started Now</button>
            </div>
            <div className="price-card price-card--pro">
              <div className="price-card-top">
                <h3>👑 Professional</h3>
              </div>
              <span className="price-tag">Popular</span>
              <div className="price-amount">$5K/year</div>
              <p className="price-sub">Dominate the global digital feed.</p>
              <div className="price-features">
                <div className="price-feature">
                  <div>
                    <strong>Elite Viral Strategy</strong>
                    <span>Custom mass growth roadmap.</span>
                  </div>
                </div>
                <div className="price-feature">
                  <div>
                    <strong>Infinite Production</strong>
                    <span>Infinite high-impact assets.</span>
                  </div>
                </div>
                <div className="price-feature">
                  <div>
                    <strong>Revenue Scale Pro</strong>
                    <span>Convert your views into cash.</span>
                  </div>
                </div>
                <div className="price-feature">
                  <div>
                    <strong>Priority Access</strong>
                    <span>Direct expert support.</span>
                  </div>
                </div>
              </div>
              <button type="button" className="btn-price btn-price--white" data-open="contact">Get Started Now</button>
            </div>
          </div>
          <p style={{textAlign: "center", marginTop: "28px"}}>
            <a href="#team" className="why-badge" style={{textDecoration: "none", display: "inline-block"}}>Our Team</a>
          </p>
        </div>
      </section>

      <section className="team-section" id="team">
        <div className="wrap">
        <h2>Meet the experts behind your growth.</h2>
          <div className="team-grid">
            <article className="team-card" style={{backgroundImage: "url('https://images.unsplash.com/photo-1502685104226-ee32379fefbe?w=600&q=80')"}}>
              <div className="team-card-inner">
                <div className="team-card-top">
                  <strong>Harley Rose</strong>
                  <span>Viral Lead</span>
                </div>
                <div>
                  <p className="team-bio">Turning brand concepts into massive viral trends.</p>
                  <button type="button" className="btn-ig" data-open="instagram">📷 Instagram</button>
                </div>
              </div>
            </article>
            <article className="team-card" style={{backgroundImage: "url('https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&q=80')"}}>
              <div className="team-card-inner">
                <div className="team-card-top">
                  <strong>Emma Watson</strong>
                  <span>Growth Hacker</span>
                </div>
                <div>
                  <p className="team-bio">Designing high-conversion visuals for top-tier brands.</p>
                  <button type="button" className="btn-ig" data-open="instagram">📷 Instagram</button>
                </div>
              </div>
            </article>
            <article className="team-card" style={{backgroundImage: "url('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80')"}}>
              <div className="team-card-inner">
                <div className="team-card-top">
                  <strong>Sienna Hart</strong>
                  <span>Creative Lead</span>
                </div>
                <div>
                  <p className="team-bio">Leading bold creative concepts for standout brand campaigns.</p>
                  <button type="button" className="btn-ig" data-open="instagram">📷 Instagram</button>
                </div>
              </div>
            </article>
            <article className="team-card" style={{backgroundImage: "url('https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&q=80')"}}>
              <div className="team-card-inner">
                <div className="team-card-top">
                  <strong>Aria Thorne</strong>
                  <span>Media Buyer</span>
                </div>
                <div>
                  <p className="team-bio">Scaling paid social with precision and speed.</p>
                  <button type="button" className="btn-ig" data-open="instagram">📷 Instagram</button>
                </div>
              </div>
            </article>
            <article className="team-card" style={{backgroundImage: "url('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80')"}}>
              <div className="team-card-inner">
                <div className="team-card-top">
                  <strong>Felix Moore</strong>
                  <span>Script Writer</span>
                </div>
                <div>
                  <p className="team-bio">Hooks and scripts engineered for retention.</p>
                  <button type="button" className="btn-ig" data-open="instagram">📷 Instagram</button>
                </div>
              </div>
            </article>
            <article className="team-card" style={{backgroundImage: "url('https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=600&q=80')"}}>
              <div className="team-card-inner">
                <div className="team-card-top">
                  <strong>Lyra Sterling</strong>
                  <span>PR Manager</span>
                </div>
                <div>
                  <p className="team-bio">Stories that earn media and trust.</p>
                  <button type="button" className="btn-ig" data-open="instagram">📷 Instagram</button>
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
            <a href="https://rb-app.nhancio.com/" className="btn-solid" style={{textDecoration: "none", display: "inline-block"}}>Open Web App</a>
            <button type="button" className="btn-ghost" data-open="contact">Contact us</button>
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

      <footer className="site-footer" id="contact">
        <div className="footer-inner">
          <div className="footer-brand-box">
            <div className="nav-brand">
              <svg className="nav-mark" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{color: "#fff"}}>
                <path d="M12 2.25c1.65 1.6 2.75 4.05 2.75 6.75 0 1.45-.28 2.82-.8 4.05l.75 6.2-2.7-2.55L9.3 17.3l.75-6.2A7.01 7.01 0 019.25 9c0-2.7 1.1-5.15 2.75-6.75z" />
              </svg>
              ReelBazaar
            </div>
            <p style={{margin: "12px 0 0", opacity: 0.9, fontSize: "0.9rem"}}>Social media mastery for ambitious brands.</p>
          </div>
          <div className="footer-links">
            <div className="footer-col">
              <h4>Main</h4>
              <a href="#about">About</a>
              <a href="#services">Services</a>
              <a href="#process">Process</a>
              <a href="#pricing">Pricing</a>
              <a href="#team">Team</a>
            </div>
            <div className="footer-col">
              <h4>Pages</h4>
              <button type="button" className="link" data-open="case-studies">Case Studies</button>
              <button type="button" className="link" data-open="contact">Contact</button>
            </div>
            <div className="footer-col">
              <h4>Contact</h4>
              <div className="footer-contact-row"><span>→</span> contact@reelbazaar.com</div>
              <div className="footer-contact-row"><span>→</span> +1 (555) 123-4567</div>
              <div className="footer-contact-row"><span>→</span> New York, USA</div>
            </div>
          </div>
        </div>
      </footer>

      <div className="modal-root" id="modalContact" aria-hidden="true">
        <div className="modal-backdrop" data-close-modal tabIndex={-1}></div>
        <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modalContactTitle">
          <button type="button" className="modal-close" data-close-modal aria-label="Close">&times;</button>
          <h2 id="modalContactTitle">Contact us</h2>
          <p className="hint">Send a message — this is a front-end demo (no server).</p>
          <form id="contactForm">
            <div className="form-row">
              <label htmlFor="c-name">Name</label>
              <input id="c-name" name="name" type="text" autoComplete="name" required />
            </div>
            <div className="form-row">
              <label htmlFor="c-email">Email</label>
              <input id="c-email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="form-row">
              <label htmlFor="c-msg">Message</label>
              <textarea id="c-msg" name="message" required></textarea>
            </div>
            <button type="submit" className="btn-submit">Send message</button>
          </form>
        </div>
      </div>

      <div className="modal-root" id="modalCase" aria-hidden="true">
        <div className="modal-backdrop" data-close-modal tabIndex={-1}></div>
        <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modalCaseTitle">
          <button type="button" className="modal-close" data-close-modal aria-label="Close">&times;</button>
          <h2 id="modalCaseTitle">Case Studies</h2>
          <p className="hint">Explore how we helped brands scale — sample projects coming soon. Close this dialog to continue browsing.</p>
          <button type="button" className="btn-submit" data-close-modal>Got it</button>
        </div>
      </div>

      <div className="modal-root" id="modalToast" aria-hidden="true">
        <div className="modal-backdrop" data-close-modal tabIndex={-1}></div>
        <div className="modal-panel" role="alertdialog" aria-live="polite">
          <button type="button" className="modal-close" data-close-modal aria-label="Close">&times;</button>
          <h2 id="toastTitle">Thanks!</h2>
          <p className="hint" id="toastBody">Your message would be sent in a real app.</p>
          <button type="button" className="btn-submit" data-close-modal>Close</button>
        </div>
      </div>
    </>
  );
}
