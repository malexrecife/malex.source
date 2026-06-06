// Malex site — Preços, Sobre, Contato, Footer.
import React from "react";
import { MalexLogo, MalexIcon, Icon, Btn, Sticker, MALEX_CONTACT, MALEX_PRICING } from "./Primitives.jsx";
import { scrollToId } from "./Site.jsx";

/* ============================ PREÇOS ============================ */
export function Pricing({ onReserve }) {
  const order = ["P", "G"];
  return (
    <section className="sec-navy on-navy" id="precos">
      <MalexIcon size={520} color="var(--navy-800)" className="precos-x" />
      <div className="container precos-inner">
        <div className="precos-head">
          <span className="t-overline" style={{ color: "var(--orange-400)" }}>Transparência</span>
          <h2 className="t-display" style={{ color: "var(--cream-500)", margin: "8px 0 0" }}>Preço na tela. Sem surpresa.</h2>
          <p className="t-body-lg" style={{ color: "var(--navy-200)", maxWidth: 520, marginTop: 14 }}>
            Escolhe o tamanho, vê o valor antes de decidir. Sem letra miúda, sem fila no balcão.
          </p>
        </div>

        <div className="price-grid">
          {order.map((k) => {
            const p = MALEX_PRICING[k];
            const hot = k === "P";
            return (
              <div className={`price-card${hot ? " price-card-hot" : ""}`} key={k}>
                {hot && <span className="price-flag">Mais usado</span>}
                <div className="price-card-name t-h3">{p.name}</div>
                <div className="price-card-fits t-body-sm">{p.fits}</div>
                <div className="price-card-big">
                  <span className="price tabular">
                    <span className="price-cur">R$</span>{p.day}
                  </span>
                  <span className="price-unit">/ diária</span>
                </div>
                <div className="price-card-day tabular">por dia · sem tarifa por hora</div>
                <Btn
                  variant={hot ? "primary" : "secondary"}
                  className="btn-block price-card-cta"
                  icon="arrow-right"
                  onClick={() => onReserve({ size: k })}
                >Reservar {p.name.toLowerCase()}</Btn>
              </div>
            );
          })}
        </div>

        <p className="precos-note t-body-sm">
          Cobrança por diária cheia · o mesmo preço em todas as unidades.
        </p>
      </div>
    </section>
  );
}

/* ============================ SOBRE ============================ */
const PROOF = [
  { n: "50", l: "anos de cuidado" },
  { n: "+100", l: "unidades" },
  { n: "26", l: "estados" },
  { n: "24h", l: "monitorado" },
];

export function Sobre() {
  return (
    <section className="sec-cream" id="sobre">
      <div className="container sobre-grid">
        <div className="sobre-copy">
          <span className="t-overline" style={{ color: "var(--orange-600)" }}>Desde 1976</span>
          <h2 className="t-h1 sobre-title">Cinquenta anos guardando o que importa.</h2>
          <p className="t-body-lg sobre-body">
            A Malex nasceu em 1976 com uma ideia simples: ninguém deveria ficar preso à própria bagagem.
            Cinquenta anos depois, somos mais de 100 unidades em 26 estados — e agora trazemos toda essa
            confiança pro digital. Armário que abre com QR Code, pagamento na palma da mão, monitoramento 24h.
            A tecnologia mudou; o que a gente guarda, não: o que é seu, pra você seguir leve.
          </p>
          <div className="proof-row">
            {PROOF.map((p) => (
              <div className="proof-i" key={p.l}>
                <div className="proof-n price tabular">{p.n}</div>
                <div className="proof-l t-body-sm">{p.l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="sobre-media">
          <div className="sobre-photo">
            <img src="/assets/photos/friends-sunset.png" alt="Amigos de mãos livres numa capital brasileira ao pôr do sol" />
          </div>
          <Sticker tone="orange" rot={-3.5} className="sobre-sticker">
            <span className="sticker-tag">Desde 1976</span>
          </Sticker>
        </div>
      </div>
    </section>
  );
}

/* ============================ CONTATO ============================ */
export function Contato() {
  const C = MALEX_CONTACT;
  return (
    <section className="sec-navy on-navy contato" id="contato">
      <MalexIcon size={480} color="var(--navy-800)" className="contato-x" />
      <div className="container contato-inner">
        <span className="t-overline" style={{ color: "var(--orange-400)" }}>A gente fica de olho</span>
        <h2 className="t-display contato-title">Fala com a gente.</h2>
        <p className="t-body-lg contato-sub">Suporte e comercial num lugar só.</p>

        <a className="btn btn-cta contato-wpp" href={C.whatsapp} target="_blank" rel="noopener noreferrer">
          <Icon name="phone" size={20} color="var(--cream-500)" />
          Falar no WhatsApp
        </a>

        <div className="contato-grid">
          <div className="contato-item">
            <Icon name="phone" size={22} color="var(--orange-400)" />
            <div className="contato-lbl t-overline">Telefone</div>
            <a className="contato-val" href={C.phoneHref}>{C.phone}</a>
          </div>
          <div className="contato-item">
            <Icon name="user" size={22} color="var(--orange-400)" />
            <div className="contato-lbl t-overline">E-mail</div>
            <a className="contato-val" href={`mailto:${C.email}`}>{C.email}</a>
          </div>
          <div className="contato-item">
            <Icon name="location" size={22} color="var(--orange-400)" />
            <div className="contato-lbl t-overline">Onde estamos</div>
            <span className="contato-val">{C.address}<br />{C.city}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================ FOOTER ============================ */
export function Footer({ onReserve }) {
  const cols = {
    Navegação: [
      { label: "Como funciona", id: "como" },
      { label: "Preços", id: "precos" },
      { label: "Sobre", id: "sobre" },
      { label: "Contato", id: "contato" },
    ],
  };
  return (
    <footer className="footer on-navy">
      <div className="container footer-grid">
        <div className="footer-brand">
          <MalexLogo height={28} />
          <p className="t-body footer-thread">Guardamos o que importa pra você seguir leve.</p>
          <a className="btn btn-cta footer-reserve" href="#" onClick={(e) => { e.preventDefault(); onReserve(); }}>
            Reservar locker <Icon name="arrow-right" size={18} color="var(--cream-500)" />
          </a>
        </div>
        <div className="footer-cols">
          {Object.entries(cols).map(([h, items]) => (
            <div key={h}>
              <div className="t-overline footer-col-h">{h}</div>
              <ul className="footer-list">
                {items.map((it) => (
                  <li key={it.label}>
                    <a href={`#${it.id}`} onClick={(e) => { e.preventDefault(); scrollToId(it.id); }}>{it.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <div className="t-overline footer-col-h">Reserva</div>
            <ul className="footer-list">
              <li><a href="#" onClick={(e) => { e.preventDefault(); onReserve(); }}>Reservar locker</a></li>
              <li><a href={MALEX_CONTACT.whatsapp} target="_blank" rel="noopener noreferrer">Falar no WhatsApp</a></li>
            </ul>
          </div>
        </div>
      </div>
      <div className="container footer-bottom">
        <span className="t-body-sm">© 2026 Malex · desde 1976</span>
        <span className="t-body-sm">Feito no Brasil · Pix · cartão · QR Code</span>
      </div>
    </footer>
  );
}
