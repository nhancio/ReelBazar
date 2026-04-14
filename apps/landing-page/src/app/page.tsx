"use client";
import React, { useEffect, useRef } from "react";
import { API_BASE_URL } from "@reelbazaar/config";

const TRANS_MS = 650;

const REEL_IMAGES = [
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80&fit=crop",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&q=80&fit=crop",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&q=80&fit=crop",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=600&q=80&fit=crop",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=600&q=80&fit=crop"
];

const NAMES_LEFT = ["Benjamin", "Marcus", "Sofia", "Jordan", "Alex"];
const NAMES_RIGHT = ["Angeline", "Priya", "Chris", "Taylor", "Sam"];

export default function Home() {
  const reelsTrackRef = useRef<HTMLDivElement>(null);
  const pillLeftRef = useRef<HTMLSpanElement>(null);
  const pillRightRef = useRef<HTMLSpanElement>(null);
  const avatarUiRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const track = reelsTrackRef.current;
    if (!track) return;
    
    // Clear in case of strict mode double run
    track.innerHTML = '';

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
      ["modalContact", "modalToast"].forEach(id => {
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
    const formSubmitHandler = async (e: Event) => {
      e.preventDefault();
      const form = contactForm as HTMLFormElement;
      const fd = new FormData(form);
      const name = String(fd.get("name") || "").trim();
      const email = String(fd.get("email") || "").trim();
      const message = String(fd.get("message") || "").trim();
      const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
      if (submitBtn) submitBtn.disabled = true;
      try {
        const res = await fetch(`${API_BASE_URL}/contact`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, message }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error || "Something went wrong. Please try again.");
        }
        closeModal(document.getElementById("modalContact"));
        const tTitle = document.getElementById("toastTitle");
        const tBody = document.getElementById("toastBody");
        if (tTitle) tTitle.textContent = "Message received";
        if (tBody) tBody.textContent = "Thanks! We'll get back to you soon.";
        openModal(document.getElementById("modalToast"));
        form.reset();
      } catch (err) {
        const tTitle = document.getElementById("toastTitle");
        const tBody = document.getElementById("toastBody");
        if (tTitle) tTitle.textContent = "Could not send";
        if (tBody)
          tBody.textContent =
            err instanceof Error ? err.message : "Please try again or email shopatrava@gmail.com.";
        openModal(document.getElementById("modalToast"));
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    };
    if (contactForm) contactForm.addEventListener("submit", formSubmitHandler);

    return () => {
      clearInterval(interval1);
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
            Rava
          </a>
          <button type="button" className="nav-cta" data-open="contact">Contact us</button>
        </nav>
      </header>

      <div className="drawer-overlay" id="drawerOverlay"></div>
      <aside className="mobile-drawer" id="mobileDrawer" aria-hidden="true">
        <nav aria-label="Mobile">
          <a href="#why-rava">Why Rava</a>
          <a href="#about">About</a>
          <a href="#process">Process</a>
          <a href="#contact">Contact</a>
        </nav>
      </aside>

      <section className="hero-panel" id="top">
      <div className="wrap">
        <header className="hero">
          <h1>Scroll.Tap.Buy</h1>
          <p>
            We eliminate friction between discovery and purchase, turning engaged viewers into instant buyers through one seamless platform.
          </p>
          <div className="hero-actions">
            <a href="https://app.rava.one/" className="btn-solid" style={{textDecoration: "none", display: "inline-block"}}>Open Web App</a>
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
              <h3>🎯 AI Matches You With Perfect Creators</h3>
              <p>Skip months of searching. Find creators aligned with your brand in seconds.</p>
            </article>

            <article className="insight-card">
              <h3>💰 See Every Sale, Track Every Dollar</h3>
              <p>Direct reel-to-purchase attribution. Know exactly what your spend generates.</p>
            </article>

            <article className="insight-card">
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
              <button type="button" className="btn-ghost" data-open="contact">Contact us</button>
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
                  <p>Fashion creators share branded reels showcasing products authentically.</p>
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
            <a href="https://app.rava.one/" className="btn-solid" style={{textDecoration: "none", display: "inline-block"}}>Open Web App</a>
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
              <button type="button" className="link" data-open="contact">Contact</button>
            </div>
            <div className="footer-col">
              <h4>Contact</h4>
              <div className="footer-contact-row"><span>→</span> shopatrava@gmail.com</div>
              <div className="footer-contact-row"><span>→</span> Hyderabad, India</div>
            </div>
          </div>
        </div>
      </footer>

      <div className="modal-root" id="modalContact" aria-hidden="true">
        <div className="modal-backdrop" data-close-modal tabIndex={-1}></div>
        <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modalContactTitle">
          <button type="button" className="modal-close" data-close-modal aria-label="Close">&times;</button>
          <h2 id="modalContactTitle">Contact us</h2>
          <p className="hint">Send a message — we&apos;ll get back to you soon.</p>
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

      <div className="modal-root" id="modalToast" aria-hidden="true">
        <div className="modal-backdrop" data-close-modal tabIndex={-1}></div>
        <div className="modal-panel" role="alertdialog" aria-live="polite">
          <button type="button" className="modal-close" data-close-modal aria-label="Close">&times;</button>
          <h2 id="toastTitle">Thanks!</h2>
          <p className="hint" id="toastBody"></p>
          <button type="button" className="btn-submit" data-close-modal>Close</button>
        </div>
      </div>
    </>
  );
}
