import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import Lenis from "@studio-freight/lenis";
import { JOURNEY } from "./journey";
import Scene, { SceneLoader } from "./Scene";
import { scrollState as state } from "./scrollState";
import "./style.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const BASE = import.meta.env.BASE_URL;
const INSTAGRAM_URL =
  "https://www.instagram.com/chapterofushk_1a?vrfl=ZjVuN3I0aDBpOTg5";

function App() {
  const root = useRef(),
    lenis = useRef(),
    origin = useRef(),
    dialog = useRef(),
    closeTimer = useRef(null),
    swipeStart = useRef(null);

  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState("web-kelas");
  const [panel, setPanel] = useState(null);
  const [closing, setClosing] = useState(false);
  const [copiedNote, setCopiedNote] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [reduced, setReduced] = useState(
    matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const selectItem = (id) => {
    state.selectedId = id;
    setSelectedId(id);
  };

  const stepItem = (direction) => {
    if (!items.length) return;
    const index = items.findIndex((i) => i.id === state.selectedId);
    const safeIndex = index < 0 ? 0 : index;
    selectItem(items[(safeIndex + direction + items.length) % items.length].id);
  };

  useEffect(() => {
    fetch(BASE + "props/props.json")
      .then((r) => r.json())
      .then((data) => {
        setItems(data);
        if (data.length && !data.some((d) => d.id === state.selectedId)) {
          state.selectedId = data[0].id;
          setSelectedId(data[0].id);
        }
      });
    const q = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(q.matches);
    q.addEventListener("change", change);
    try {
      const c = document.createElement("canvas");
      if (!c.getContext("webgl2")) setFallback(true);
    } catch {
      setFallback(true);
    }
    return () => q.removeEventListener("change", change);
  }, []);

  useEffect(() => {
    if (!items.length) return;
    const onDown = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (
        panel ||
        (state.progress <= JOURNEY.panelStart && !reduced && !fallback)
      )
        return;
      if (e.target.closest?.("button, a, input, .detail-panel")) return;
      swipeStart.current = [e.clientX, e.clientY];
    };
    const onCancel = () => {
      swipeStart.current = null;
    };
    const onUp = (e) => {
      const start = swipeStart.current;
      swipeStart.current = null;
      if (!start) return;
      const dx = e.clientX - start[0];
      const dy = e.clientY - start[1];
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        stepItem(dx < 0 ? 1 : -1);
      }
    };
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointercancel", onCancel, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("pointerup", onUp);
    };
  }, [items, panel, reduced, fallback]);

  const enterBubble = () => {
    setTimeout(
      () =>
        lenis.current?.scrollTo((innerHeight * JOURNEY.scrollVh) / 100, {
          duration: 3.1,
        }),
      240,
    );
  };

  const close = () => {
    if (closeTimer.current) return;
    setClosing(true);
    closeTimer.current = setTimeout(
      () => {
        setPanel(null);
        setClosing(false);
        setCopiedNote(false);
        closeTimer.current = null;
        state.focusedId = null;
        state.phase = state.progress > 0.985 ? "INTERIOR" : "HERO";
      },
      reduced ? 0 : 420,
    );
  };

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const open = (item) => {
    clearTimeout(closeTimer.current);
    closeTimer.current = null;
    setClosing(false);
    setCopiedNote(false);
    origin.current = document.activeElement;
    setPanel(item);
    if (item.id) {
      state.focusedId = item.id;
      state.phase = "FOCUSED";
    }
  };

  useEffect(() => {
    if (!panel) return;
    lenis.current?.stop();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = setTimeout(
      () => dialog.current?.querySelector("button, a")?.focus(),
      30,
    );
    const key = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab" && dialog.current) {
        const els = [
          ...dialog.current.querySelectorAll(
            'button:not([disabled]), a[href], input:not([disabled])',
          ),
        ];
        if (!els.length) return;
        const first = els[0],
          last = els.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = old;
      lenis.current?.start();
      window.removeEventListener("keydown", key);
      origin.current?.focus?.({ preventScroll: true });
    };
  }, [panel]);

  useGSAP(
    () => {
      state.reduced = reduced;
      state.progress = 0;
      state.outro = 0;
      state.entrance = 1;
      const smooth = new Lenis({ smoothWheel: !reduced, duration: 1.5 });
      lenis.current = smooth;
      smooth.on("scroll", ScrollTrigger.update);
      const tick = (t) => smooth.raf(t * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      if (!reduced && !fallback) {
        gsap.from(".hero-top, .hero-bottom", {
          opacity: 0,
          y: 8,
          duration: 1.6,
          stagger: 0.12,
          ease: "power2.out",
        });
        const zoomPanel = root.current.querySelector(".zoom-panel");
        const tl = gsap.timeline({
          onUpdate() {
            const pr = this.progress();
            state.progress = pr;
            if (zoomPanel) {
              const live = pr > JOURNEY.panelStart;
              zoomPanel.classList.toggle("is-live", live);
              zoomPanel.inert = !live || Boolean(panel);
            }
          },
          scrollTrigger: {
            id: "themis-journey",
            trigger: ".hero",
            start: "top top",
            end: () => "+=" + (innerHeight * JOURNEY.scrollVh) / 100,
            pin: true,
            scrub: JOURNEY.scrub,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
          defaults: { ease: "none" },
        });
        tl.fromTo(
          ".lockup-left > span, .lockup-right > span",
          { opacity: 0.86, y: 18 },
          { opacity: 1, y: 0, duration: 0.12, stagger: 0.03 },
          0,
        )
          .fromTo(
            ".eyebrow, .tagline",
            { opacity: 0.72, y: 12 },
            { opacity: 1, y: 0, duration: 0.13, stagger: 0.03 },
            0.02,
          )
          .to(
            ".hero-copy, .hero-top, .hero-bottom",
            { opacity: 0, y: -30, duration: 0.14 },
            JOURNEY.zoomStart,
          )
          .to({}, { duration: 0.01 }, 1);
      }
      return () => {
        smooth.destroy();
        gsap.ticker.remove(tick);
      };
    },
    { scope: root, dependencies: [reduced, fallback], revertOnUpdate: true },
  );

  const activeIndex = Math.max(
    0,
    items.findIndex((i) => i.id === selectedId),
  );

  return (
    <div ref={root}>
      {!fallback && items.length > 0 && (
        <Scene
          items={items}
          onSelect={open}
          onEnterBubble={enterBubble}
          onCycleProp={() => stepItem(1)}
          onFail={() => setFallback(true)}
          reduced={reduced}
        />
      )}
      <SceneLoader />
      <div className="ambient-base" />
      <main inert={Boolean(panel)}>
        <section className="hero" id="home">
          {fallback && (
            <div className="hero-atmosphere" aria-hidden="true">
              <picture>
                <source
                  media="(max-width: 700px)"
                  srcSet={BASE + "textures/scene-mobile.jpg"}
                />
                <img
                  src={BASE + "textures/scene.jpg"}
                  alt=""
                  fetchPriority="high"
                />
              </picture>
              <div className="hero-light" />
            </div>
          )}

          <header className="hero-top hero-fade">
            <a
              className="wordmark"
              href="#home"
              aria-label="Beranda HK A 2025"
            >
              HK A <span className="wordmark-year">&apos;25</span>
              <span className="brand-star" aria-hidden="true">
                ⚖
              </span>
            </a>
           
          </header>

          {fallback && (
            <div className="character-wrap">
              <img
                className="character"
                src={BASE + "character.png"}
                alt="Sosok Dewi Themis modern memegang pedang keadilan dengan telapak tangan terbuka"
                fetchPriority="high"
              />
            </div>
          )}

          <div className="hero-copy hero-fade">
            <p className="eyebrow">
              <span className="eyebrow-rule" />
              Chapter of Us · UINSSC Cirebon
            </p>
            <h1 className="lockup">
              <span className="lockup-left">
                <span className="line-solid">HUKUM</span>
                <span className="line-solid">Keluarga</span>
              </span>
              <span className="lockup-right">
                <span className="line-hollow">Kelas A</span>
                <span className="line-hollow">2025</span>
              </span>
            </h1>
            <p className="tagline">
              Tegak dalam keadilan.
              <br />
              Satu cerita dalam kebersamaan.
            </p>
          </div>

          {fallback && (
            <img
              className="static-bubble"
              src={BASE + "bubble.png"}
              alt=""
              aria-hidden="true"
            />
          )}

          <div className="hero-bottom hero-fade">
            <a
              href="#koleksi"
              onClick={(e) => {
                e.preventDefault();
                lenis.current?.scrollTo((innerHeight * JOURNEY.scrollVh) / 100, {
                  duration: 3,
                });
              }}
            >
              <span className="scroll-icon" aria-hidden="true">
                ↓
              </span>{" "}
              Scroll pelan. Masuk ke ruang kelas.
            </a>
            
            <span>UIN Siber Syekh Nurjati Cirebon · HK A</span>
          </div>

          <div
            id="koleksi"
            className={
              "zoom-panel" +
              (reduced || fallback ? " is-live static-collection" : "")
            }
            inert={(!reduced && !fallback && state.progress <= JOURNEY.panelStart) || Boolean(panel)}
            aria-label="Portal Menu HK A 2025"
            role="region"
            aria-roledescription="carousel"
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                stepItem(e.key === "ArrowRight" ? 1 : -1);
              }
            }}
          >
            <div className="collection-swipe-surface" aria-hidden="true" />
            <div className="zoom-cards">
              {items.map((item) => (
                <button
                  key={item.id}
                  className={
                    "zoom-card" +
                    (selectedId === item.id ? " is-selected" : "")
                  }
                  aria-pressed={selectedId === item.id}
                  onClick={() => selectItem(item.id)}
                  aria-label={item.name}
                >
                  <img
                    className="zoom-card-thumb"
                    src={`${BASE}editorial/${item.id}.png`}
                    alt=""
                  />
                </button>
              ))}
            </div>

            <div className="zoom-text" aria-live="polite">
              {items
                .filter((item) => item.id === selectedId)
                .map((item) => (
                  <div
                    className="collection-copy"
                    data-item={item.id}
                    key={item.id}
                  >
                    <p className="collection-caption">
                      {item.category} · HK A 2025
                    </p>
                    <h2>
                      {item.name.split(" ").map((word, i, arr) => (
                        <React.Fragment key={i}>
                          {i > 0 && (
                            <>
                              {" "}
                              <br className="desktop-br" />
                            </>
                          )}
                          {word}
                          {i === arr.length - 1 ? "." : ""}
                        </React.Fragment>
                      ))}
                    </h2>
                    <p className="zoom-lead">{item.blurb}</p>
                    <div className="zoom-actions">
                      {item.url ? (
                        <>
                          <a
                            className="zoom-cta zoom-cta-gold"
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {item.ctaLabel}
                          </a>
                          <button
                            className="zoom-cta zoom-cta-ghost"
                            onClick={() => open(item)}
                          >
                            Info detail
                          </button>
                        </>
                      ) : (
                        <button
                          className="zoom-cta"
                          onClick={() => open(item)}
                        >
                          {item.ctaLabel}{" "}
                          <span aria-hidden="true">↗</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              <div className="collection-controls">
                <button
                  onClick={() => stepItem(-1)}
                  aria-label="Menu sebelumnya"
                >
                  ←
                </button>
                <span>
                  {String(activeIndex + 1).padStart(2, "0")} /{" "}
                  {String(items.length).padStart(2, "0")}
                </span>
                <button
                  onClick={() => stepItem(1)}
                  aria-label="Menu berikutnya"
                >
                  →
                </button>
              </div>
              
            </div>
          </div>
        </section>
      </main>

      {panel && (
        <div
          className={"panel-backdrop" + (closing ? " is-closing" : "")}
          onClick={close}
        >
          <section
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="panel-title"
            className="detail-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="close" onClick={close} aria-label="Tutup panel">
              ✕
            </button>
            <p className="panel-caption">
              Chapter of Us · {panel.category || "HK A 2025"}
            </p>
            <h2 id="panel-title">{panel.name}</h2>
            <p className="english">{panel.nameEn}</p>
            <div className="panel-mark" aria-hidden="true">
              <img
                src={`${BASE}editorial/${panel.id}.png`}
                alt=""
                className="panel-thumb"
              />
            </div>
            <p className="blurb">{panel.blurb}</p>
            {panel.badge && <p className="panel-price">{panel.badge}</p>}

            {Array.isArray(panel.details) && panel.details.length > 0 && (
              <div className="panel-details">
                {panel.details.map((d, idx) => (
                  <div className="panel-detail-row" key={idx}>
                    <strong>{d.label}</strong>
                    <span>{d.value}</span>
                  </div>
                ))}
              </div>
            )}

            {panel.url ? (
              <a
                className="primary primary-link"
                href={panel.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>{panel.ctaLabel}</span>
                <span aria-hidden="true">↗</span>
              </a>
            ) : (
              <button
                className="primary"
                onClick={() => setCopiedNote(true)}
              >
                {copiedNote
                  ? "Siap dihubungkan ke link kelas"
                  : `${panel.ctaLabel} (Siapkan Link)`}
              </button>
            )}

            <p className="fiction" role="status">
              {panel.url
                ? "Tautan resmi keluarga besar Hukum Keluarga Kelas A Angkatan 2025."
                : copiedNote
                  ? panel.note ||
                    "Masukkan URL tujuan di public/props/props.json agar tombol ini langsung membuka halaman/Drive kelas."
                  : "Portal interaktif Hukum Keluarga Kelas A 2025 · Chapter of Us."}
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

if (!location.search.includes("author=1")) {
  createRoot(document.getElementById("root")).render(<App />);
}
