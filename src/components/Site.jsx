// Malex site — Nav (+ mobile drawer), Hero, Ticker, Como Funciona (+ SAC band).
import React, { useState, useEffect } from "react";
import { MalexLogo, MalexIcon, Icon, Btn, Pill, Sticker, MALEX_CONTACT } from "./Primitives.jsx";

const NAV_LINKS = [
  { id: "como", label: "Como funciona" },
  { id: "precos", label: "Preços" },
  { id: "sobre", label: "Sobre" },
  { id: "contato", label: "Contato" },
];

export function scrollToId(id) {
  const el = document.getElementById(id);
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior: "smooth" });
}

/* ============================ NAV ============================ */
export function Nav({ onReserve }) {
  const [drawer, setDrawer] = useState(false);
  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawer]);

  return (
    <header className="nav">
      <div className="nav-inner">
        <a href="#" className="nav-logo" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label="Malex — início">
          <MalexLogo height={24} />
        </a>
        <nav className="nav-links" aria-label="Principal">
          {NAV_LINKS.map((l) => (
            <a key={l.id} href={`#${l.id}`} onClick={(e) => { e.preventDefault(); scrollToId(l.id); }}>{l.label}</a>
          ))}
        </nav>
        <div className="nav-cta">
          <Btn variant="primary" cta size="sm" onClick={() => onReserve()}>Reservar locker</Btn>
        </div>
        <button className="nav-burger" aria-label="Abrir menu" aria-expanded={drawer} onClick={() => setDrawer(true)}>
          <Icon name="menu" size={26} color="var(--cream-500)" />
        </button>
      </div>

      {/* Mobile drawer */}
      <div className={`drawer-scrim${drawer ? " open" : ""}`} onClick={() => setDrawer(false)} />
      <aside className={`drawer${drawer ? " open" : ""}`} aria-hidden={!drawer} role="dialog" aria-label="Menu">
        <div className="drawer-top">
          <MalexLogo height={22} />
          <button className="drawer-close" aria-label="Fechar menu" onClick={() => setDrawer(false)}>
            <Icon name="close" size={24} color="var(--cream-500)" />
          </button>
        </div>
        <nav className="drawer-links">
          {NAV_LINKS.map((l) => (
            <a key={l.id} href={`#${l.id}`} onClick={(e) => { e.preventDefault(); setDrawer(false); setTimeout(() => scrollToId(l.id), 120); }}>{l.label}</a>
          ))}
        </nav>
        <Btn variant="primary" cta className="btn-block" onClick={() => { setDrawer(false); onReserve(); }}>Reservar locker</Btn>
      </aside>
    </header>
  );
}

/* ============================ HERO ============================ */
export function Hero({ onReserve }) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { const t = setTimeout(() => setLoaded(true), 60); return () => clearTimeout(t); }, []);

  return (
    <section className={`hero on-navy${loaded ? " is-loaded" : ""}`} id="inicio">
      <MalexIcon size={720} color="var(--royal-500)" className="hero-x" />
      <div className="hero-inner">
        <div className="hero-copy">
          <span className="t-caption hero-eyebrow" style={{ color: "var(--orange-400)" }}>Guarda-volumes digital · desde 1976</span>
          <h1 className="t-hero hero-title">
            Você, livre<br />de <span className="impact-word">malas.</span>
          </h1>
          <p className="t-body-lg hero-sub">
            Larga a mala em segundos e vai viver a cidade. A gente fica de olho — monitorado 24h, preço na tela, sem fila.
          </p>
          <div className="hero-actions">
            <Btn variant="primary" cta icon="arrow-right" onClick={() => onReserve()}>Reservar locker</Btn>
            <Btn variant="tertiary" onClick={() => scrollToId("como")}>Como funciona</Btn>
          </div>
          <div className="hero-pills">
            <Pill tone="navy" icon="check">Mãos livres em 30s</Pill>
            <Pill tone="outline-cream" icon="qr-code">Abre com QR Code</Pill>
            <Pill tone="outline-cream" icon="pix">Pix &amp; cartão</Pill>
          </div>
        </div>

        <div className="hero-media">
          <div className="hero-panel">
            <MalexIcon size={300} color="var(--royal-600)" className="hero-panel-x" />
            <img className="hero-person" src="/assets/photos/hero-cutout.png" alt="Pessoa de mãos livres, pronta pra viver a cidade" />
          </div>
          <Sticker tone="navy" rot={-4} className="hero-sticker-1">
            <span className="sticker-tag">Mãos livres</span>
          </Sticker>
          <Sticker rot={3.5} className="hero-sticker-2">
            <span style={{ fontSize: 15 }}>Desde 1976</span>
          </Sticker>
        </div>
      </div>
    </section>
  );
}

/* ============================ TICKER ============================ */
const TICKER_ITEMS = [
  "Mãos livres", "Sem fila", "Em 30 segundos", "Preço na tela", "Monitorado 24h",
  "Abre com QR Code", "Pix & cartão", "Você segue, a gente guarda",
];
export function Ticker() {
  const run = TICKER_ITEMS.concat(TICKER_ITEMS);
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {[0, 1].map((dup) => (
          <div className="ticker-group" key={dup}>
            {run.map((t, i) => (
              <span className="ticker-item" key={`${dup}-${i}`}>
                {t}
                <MalexIcon size={20} color="var(--navy-900)" className="ticker-x" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ====================== COMO FUNCIONA (+ SAC) ====================== */
const STEPS = [
  { n: "1", t: "Reserva na tela", d: "Escolhe tamanho e período. O preço aparece na tela antes de você decidir." },
  { n: "2", t: "Larga a mala", d: "Chega, abre o locker com QR Code e larga a mala em menos de 30 segundos, sozinho pelo celular." },
  { n: "3", t: "Segue leve", d: "Mãos livres pra viver a cidade. A gente fica de olho — monitorado 24h." },
];

export function ComoFunciona({ onReserve }) {
  return (
    <section className="sec-cream" id="como">
      <div className="container">
        <div className="como-head">
          <span className="t-overline" style={{ color: "var(--orange-600)" }}>Passo a passo</span>
          <h2 className="t-display como-title">Nunca foi tão fácil.</h2>
        </div>

        <div className="como-grid">
          {/* Phone mockup */}
          <div className="como-phone-wrap">
            <PhoneMock onReserve={onReserve} />
          </div>

          {/* Steps */}
          <ol className="steps-list">
            {STEPS.map((s) => (
              <li className="step-item" key={s.n}>
                <span className="step-no">{s.n}</span>
                <div>
                  <h3 className="t-h4 step-t">{s.t}</h3>
                  <p className="t-body step-d">{s.d}</p>
                </div>
              </li>
            ))}
            <li className="steps-cta">
              <Btn variant="primary" cta icon="arrow-right" onClick={() => onReserve()}>Reservar locker</Btn>
            </li>
          </ol>
        </div>

        {/* SAC band — WhatsApp único canal */}
        <div className="sac-band">
          <div className="sac-copy">
            <Icon name="support" size={26} color="var(--cream-500)" />
            <div>
              <div className="t-h4" style={{ color: "var(--cream-500)" }}>Precisa de ajuda? Fala com a gente.</div>
              <div className="t-body-sm" style={{ color: "var(--navy-200)" }}>Suporte e comercial num lugar só, direto no WhatsApp.</div>
            </div>
          </div>
          <a className="btn btn-cta sac-wpp" href={MALEX_CONTACT.whatsapp} target="_blank" rel="noopener noreferrer">
            <Icon name="phone" size={18} color="var(--cream-500)" />
            Falar no WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}

/* Phone mockup — app reservation screen drawn in CSS */
function PhoneMock({ onReserve }) {
  return (
    <div className="phone" role="img" aria-label="Prévia do app Malex: reserva de locker">
      <div className="phone-notch" />
      <div className="phone-screen">
        <div className="ph-statusbar">
          <span>9:41</span>
          <span className="ph-status-icons"><Icon name="navigation" size={12} color="var(--navy-900)" /></span>
        </div>
        <div className="ph-head">
          <MalexLogo height={16} color="var(--navy-900)" />
          <span className="ph-badge">GRU · T2</span>
        </div>
        <div className="ph-card">
          <div className="ph-card-row">
            <Icon name="locker" size={20} color="var(--navy-900)" />
            <div>
              <div className="ph-card-t">Locker pequeno</div>
              <div className="ph-card-s">até 4 malas de bordo</div>
            </div>
          </div>
          <div className="ph-period">
            <div className="ph-period-col"><span className="ph-lbl">Entrada</span><span className="ph-val">hoje · 14:00</span></div>
            <Icon name="arrow-right" size={14} color="var(--navy-400)" />
            <div className="ph-period-col"><span className="ph-lbl">Saída</span><span className="ph-val">amanhã · 12:00</span></div>
          </div>
        </div>
        <div className="ph-price">
          <div>
            <div className="ph-price-lbl">Total · 1 diária</div>
            <div className="ph-price-val tabular">R$ 50</div>
          </div>
          <span className="ph-monit"><Icon name="shield" size={14} color="var(--success)" /> 24h</span>
        </div>
        <button className="ph-cta" onClick={() => onReserve()}>Abrir locker</button>
        <div className="ph-foot">Preço na tela. Sem surpresa.</div>
      </div>
    </div>
  );
}
