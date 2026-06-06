// Malex site — Preços, Sobre, Unidades, Contato, Footer.
import React, { useState, useEffect, useMemo } from "react";
import { MalexLogo, MalexIcon, Icon, Btn, Sticker, MALEX_CONTACT, MALEX_PRICING } from "./Primitives.jsx";
import { scrollToId } from "./Site.jsx";
import { listUnits, supabaseEnabled } from "../lib/admin.js";

/* Centro geográfico aproximado de cada UF (lat, lng) */
const UF_CENTERS = {
  AC:[-9.02,-70.81],AL:[-9.67,-35.74],AM:[-3.13,-60.02],AP:[-0.04,-51.07],BA:[-12.97,-38.50],
  CE:[-3.72,-38.54],DF:[-15.78,-47.93],ES:[-20.32,-40.34],GO:[-16.69,-49.25],MA:[-2.53,-44.29],
  MG:[-19.92,-43.94],MS:[-20.44,-54.65],MT:[-12.64,-55.42],PA:[-1.46,-48.50],PB:[-7.12,-34.86],
  PE:[-8.05,-34.87],PI:[-5.09,-42.80],PR:[-25.43,-49.27],RJ:[-22.91,-43.17],RN:[-5.79,-35.21],
  RO:[-8.76,-63.90],RR:[2.82,-60.68],RS:[-30.03,-51.23],SC:[-27.59,-48.55],SE:[-10.91,-37.07],
  SP:[-23.55,-46.63],TO:[-10.17,-48.33],
};

function geoDistKm(lat1, lng1, lat2, lng2) {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const FALLBACK_UNITS = [
  { id:"rec", code:"REC", name:"Aeroporto de Recife", city:"Recife", state:"PE", kind:"plane" },
  { id:"gru", code:"GRU", name:"Aeroporto de Guarulhos · T2", city:"Guarulhos", state:"SP", kind:"plane" },
  { id:"cgh", code:"CGH", name:"Aeroporto de Congonhas", city:"São Paulo", state:"SP", kind:"plane" },
  { id:"gig", code:"GIG", name:"Aeroporto do Galeão", city:"Rio de Janeiro", state:"RJ", kind:"plane" },
  { id:"tte", code:"TTE", name:"Rodoviária do Tietê", city:"São Paulo", state:"SP", kind:"train" },
  { id:"luz", code:"LUZ", name:"Estação da Luz · Centro", city:"São Paulo", state:"SP", kind:"train" },
];

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

/* ============================ ONDE ESTAMOS ============================ */
export function Unidades({ onReserve }) {
  const [units, setUnits] = useState(null);
  const [nearState, setNearState] = useState(null);
  const [geoActive, setGeoActive] = useState(false);

  useEffect(() => {
    if (supabaseEnabled) {
      listUnits().then(({ data }) => setUnits(data && data.length ? data : FALLBACK_UNITS)).catch(() => setUnits(FALLBACK_UNITS));
    } else {
      setUnits(FALLBACK_UNITS);
    }
  }, []);

  const requestGeo = () => {
    if (!navigator.geolocation) return;
    setGeoActive(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude: lat, longitude: lng } }) => {
        let best = null, bestDist = Infinity;
        for (const [uf, [ulat, ulng]] of Object.entries(UF_CENTERS)) {
          const d = geoDistKm(lat, lng, ulat, ulng);
          if (d < bestDist) { bestDist = d; best = uf; }
        }
        setNearState(best);
      },
      () => setGeoActive(false),
      { timeout: 6000 }
    );
  };

  const grouped = useMemo(() => {
    const list = units || FALLBACK_UNITS;
    const g = {};
    for (const u of list) { (g[u.state] ||= []).push(u); }
    return g;
  }, [units]);

  const states = Object.keys(grouped).sort((a, b) => {
    if (a === nearState) return -1;
    if (b === nearState) return 1;
    return a.localeCompare(b);
  });

  return (
    <section className="sec-navy on-navy" id="unidades">
      <div className="container">
        <div className="unidades-head">
          <div>
            <span className="t-overline" style={{ color: "var(--orange-400)" }}>Presença nacional</span>
            <h2 className="t-display" style={{ color: "var(--cream-500)", margin: "8px 0 0" }}>Onde estamos.</h2>
          </div>
          <button className={`unidades-geo${geoActive ? " active" : ""}`} onClick={requestGeo}>
            <Icon name="location" size={16} color="currentColor" />
            {nearState ? `Mais perto: ${nearState}` : "Perto de você"}
          </button>
        </div>

        {!units ? (
          <div style={{ color: "var(--navy-300)", fontSize: 14 }}>Carregando unidades…</div>
        ) : (
          states.map((st) => (
            <div className="unidades-state" key={st}>
              <div className="unidades-state-h">
                <span className="unidades-state-code">{st}</span>
                <span style={{ color: "var(--navy-400)", fontSize: 16 }}>· {grouped[st][0].city.split(",")[0].split("·")[0].trim()}</span>
                {st === nearState && <span className="unidades-near"><Icon name="location" size={12} color="currentColor" /> Perto de você</span>}
              </div>
              <div className="unidades-grid">
                {grouped[st].map((u) => (
                  <button key={u.id || u.code} className="unidades-card" onClick={() => onReserve({ unitId: u.id })}>
                    <span className="unidades-card-code"><Icon name={u.kind === "plane" ? "plane" : u.kind === "train" ? "train" : "location"} size={13} color="var(--orange-400)" style={{ marginRight: 6 }} />{u.code}</span>
                    <span className="unidades-card-name">{u.name}</span>
                    <span className="unidades-card-city">{u.city} · {u.state}</span>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}

        <div className="unidades-cta">
          <p className="t-body-sm" style={{ color: "var(--navy-300)", marginBottom: 18 }}>Todas as unidades funcionam 24h. Selecione a mais próxima pra reservar.</p>
          <Btn variant="primary" cta icon="arrow-right" onClick={() => onReserve()}>Reservar locker</Btn>
        </div>
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
      { label: "Unidades", id: "unidades" },
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
