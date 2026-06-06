// Malex site — shared primitives: logo, icons, buttons, pills, stickers, X device.
// Requires React + Babel (loaded by index.html). Exports to window.

/* ---------- CONFIG — placeholders, centralized for easy swap ----------
   TODO (a preencher): número real do WhatsApp, telefone, e-mail, endereço. */
window.MALEX_CONTACT = {
  whatsapp: "https://wa.me/5511990000000",   // wa.me/55…
  whatsappLabel: "(11) 99000-0000",
  phone: "(11) 99000-0000",
  phoneHref: "tel:+5511990000000",
  email: "oi@malex.com.br",
  address: "Av. Paulista, 1000 — Bela Vista",
  city: "São Paulo · SP",
};

/* Pricing — ILUSTRATIVO (a confirmar). Shared by the Preços section and the
   Reservar wizard so the numbers always match. Values in BRL. */
window.MALEX_PRICING = {
  P: { key: "P", name: "Pequeno", fits: "mochila, bolsa, capacete", h4: 14, day: 32 },
  M: { key: "M", name: "Médio",   fits: "mala de bordo, 2 mochilas", h4: 22, day: 48 },
  G: { key: "G", name: "Grande",  fits: "mala despachada grande",    h4: 30, day: 64 },
};

/* ---------- LOGO (wordmark MALEX, hard-edge, single colorway) ---------- */
const LOGO_PATHS = (
  <g fill="currentColor">
    <path d="M93.0605 99.4785V32.0898H54.5527V160.449H93.0605V99.4785Z"/>
    <path d="M144.404 99.4785V32.0898H105.896V160.449H144.404V99.4785Z"/>
    <path d="M41.7168 99.4785V32.0898H3.20898V160.449H41.7168V99.4785Z"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M304.854 32.0898H157.24V67.3887H263.137V80.2246H157.24V160.449H304.854V32.0898Z M195.748 115.523H259.928V121.941H195.748V115.523Z"/>
    <path d="M356.197 87.4448V3.20898H317.689V160.449H356.197V87.4448Z"/>
    <path d="M436.422 78.7663H369.033V113.773L497.393 113.773V78.7663H436.422Z"/>
    <path d="M436.422 32.0906L369.033 32.0906V67.0977L497.393 67.0977V32.0906H436.422Z"/>
    <path d="M436.422 125.442H369.033V160.449H497.393V125.442H436.422Z"/>
    <path d="M558.363 96.2695L510.229 160.449H558.363L584.035 126.882L609.707 160.449H657.842L609.707 96.2695L657.842 32.0898H603.289L584.035 67.3887L558.363 32.0898H510.229L558.363 96.2695Z"/>
  </g>
);

function MalexLogo({ height = 28, color = "var(--cream-500)", style, className }) {
  return (
    <svg viewBox="0 0 665 177" className={className} style={{ height, width: "auto", color, display: "block", ...style }} aria-label="Malex" role="img">
      {LOGO_PATHS}
    </svg>
  );
}

/* ---------- ICON (lllX) — three bars + X glyph, separable for two-tone ---------- */
const X_GLYPH = "M215.002 67.3887L141.195 131.568H189.33L215.002 98.0016L240.674 131.568H288.809L240.674 67.3887L288.809 3.20898H234.256L215.002 38.5078L189.33 3.20898H141.195L215.002 67.3887Z";
const X_BARS = [
  "M160.449 70.5976L131.568 3.20898H105.896V131.568H131.568L160.449 70.5976Z",
  "M93.0605 70.5977V3.20898H54.5527V131.568H93.0605V70.5977Z",
  "M41.7168 70.5977V3.20898H3.20898V131.568H41.7168V70.5977Z",
];

// Single-color X icon (watermark/device). color sets the whole mark.
function MalexIcon({ size = 40, color = "var(--cream-500)", style, className }) {
  return (
    <svg viewBox="0 0 296 135" className={className} style={{ width: size, height: "auto", color, ...style }} aria-hidden="true">
      <g fill="currentColor">
        <path d={X_GLYPH}/>
        {X_BARS.map((d, i) => <path key={i} d={d}/>)}
      </g>
    </svg>
  );
}

// Two-tone brand icon: three bars (cream) + X glyph (orange). Hard-edge, intocável.
function MalexIconTwo({ size = 40, bars = "var(--cream-500)", x = "var(--orange-500)", style, className }) {
  return (
    <svg viewBox="0 0 296 135" className={className} style={{ width: size, height: "auto", display: "block", ...style }} aria-hidden="true">
      {X_BARS.map((d, i) => <path key={i} d={d} fill={bars}/>)}
      <path d={X_GLYPH} fill={x}/>
    </svg>
  );
}

/* ---------- Generic icon: Malex brand set, falls back to Lucide for OS chrome ---------- */
function Icon({ name, size = 22, color = "currentColor", strokeWidth = 2, style }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!ref.current) return;
    const svg = window.malexIconSVG && window.malexIconSVG(name, { size, color, stroke: strokeWidth });
    if (svg) { ref.current.innerHTML = svg; return; }
    if (window.lucide) {
      ref.current.innerHTML = "";
      const el = document.createElement("i");
      el.setAttribute("data-lucide", name);
      ref.current.appendChild(el);
      window.lucide.createIcons({ attrs: { width: size, height: size, stroke: color, "stroke-width": strokeWidth }, nameAttr: "data-lucide" });
    }
  }, [name, size, color, strokeWidth]);
  return <span ref={ref} style={{ display: "inline-flex", lineHeight: 0, ...style }} />;
}

/* ---------- BUTTONS ---------- */
function Btn({ children, variant = "primary", cta, size, onClick, style, icon, iconLeft, type = "button", disabled, className = "" }) {
  const cls = ["btn", `btn-${variant}`, cta ? "btn-cta" : "", size ? `btn-${size}` : "", className].join(" ");
  return (
    <button className={cls} onClick={onClick} style={style} type={type} disabled={disabled}>
      {iconLeft && <Icon name={iconLeft} size={18} />}
      {children}
      {icon && <Icon name={icon} size={18} />}
    </button>
  );
}

function Pill({ children, tone = "cream", style, icon }) {
  return (
    <span className={`pill pill-${tone}`} style={style}>
      {icon && <Icon name={icon} size={14} color="currentColor" />}
      {children}
    </span>
  );
}

function Sticker({ children, tone, rot = -3, pill, style, className = "" }) {
  const cls = ["sticker", tone ? `sticker-${tone}` : "", pill ? "sticker-pill" : "", className].join(" ");
  return <span className={cls} style={{ transform: `rotate(${rot}deg)`, ...style }}>{children}</span>;
}

Object.assign(window, { MalexLogo, MalexIcon, MalexIconTwo, Icon, Btn, Pill, Sticker });
