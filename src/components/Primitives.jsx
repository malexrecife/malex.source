// Malex site — shared primitives: logo, icons, buttons, pills, stickers, X device.
import React from "react";
import { malexIconInner } from "../icons.js";

/* ---------- CONFIG — placeholders, centralized for easy swap ----------
   TODO (a preencher): número real do WhatsApp, telefone, e-mail, endereço. */
export const MALEX_CONTACT = {
  whatsapp: "https://wa.me/5581985570500?text=" + encodeURIComponent("Olá! Vim pelo site da Malex e gostaria de ajuda."),
  whatsappLabel: "(81) 98557-0500",
  phone: "(81) 98557-0500",
  phoneHref: "tel:+5581985570500",
  email: "contato@malexpernambuco.com.br",
  address: "Praça Min. Salgado Filho, s/n — Imbiribeira",
  city: "Recife · PE · 51210-902",
};

/* Pix — chave do recebedor p/ gerar o "Copia e Cola" + QR Code reais. */
export const MALEX_PIX = {
  key: "+5581985199442",
  name: "Malex",
  city: "Recife",
};

/* Pricing — ILUSTRATIVO (a confirmar). Shared by the Preços section and the
   Reservar wizard so the numbers always match. Values in BRL. */
export const MALEX_PRICING = {
  P: { key: "P", name: "Pequeno", fits: "até 4 malas de bordo",  day: 50 },
  G: { key: "G", name: "Grande",  fits: "até 3 malas de 23 kg", day: 100 },
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

export function MalexLogo({ height = 28, color = "var(--cream-500)", style, className }) {
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
export function MalexIcon({ size = 40, color = "var(--cream-500)", style, className }) {
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
export function MalexIconTwo({ size = 40, bars = "var(--cream-500)", x = "var(--orange-500)", style, className }) {
  return (
    <svg viewBox="0 0 296 135" className={className} style={{ width: size, height: "auto", display: "block", ...style }} aria-hidden="true">
      {X_BARS.map((d, i) => <path key={i} d={d} fill={bars}/>)}
      <path d={X_GLYPH} fill={x}/>
    </svg>
  );
}

/* ---------- Generic icon: Malex brand set (round join/cap, stroke-based) ---------- */
export function Icon({ name, size = 22, color = "currentColor", strokeWidth = 2, style }) {
  const inner = malexIconInner(name);
  if (!inner) return <span style={{ display: "inline-flex", lineHeight: 0, width: size, height: size, ...style }} />;
  return (
    <span style={{ display: "inline-flex", lineHeight: 0, ...style }}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: inner }}
      />
    </span>
  );
}

/* ---------- BUTTONS ---------- */
export function Btn({ children, variant = "primary", cta, size, onClick, style, icon, iconLeft, type = "button", disabled, className = "" }) {
  const cls = ["btn", `btn-${variant}`, cta ? "btn-cta" : "", size ? `btn-${size}` : "", className].join(" ");
  return (
    <button className={cls} onClick={onClick} style={style} type={type} disabled={disabled}>
      {iconLeft && <Icon name={iconLeft} size={18} />}
      {children}
      {icon && <Icon name={icon} size={18} />}
    </button>
  );
}

export function Pill({ children, tone = "cream", style, icon }) {
  return (
    <span className={`pill pill-${tone}`} style={style}>
      {icon && <Icon name={icon} size={14} color="currentColor" />}
      {children}
    </span>
  );
}

export function Sticker({ children, tone, rot = -3, pill, style, className = "" }) {
  const cls = ["sticker", tone ? `sticker-${tone}` : "", pill ? "sticker-pill" : "", className].join(" ");
  return <span className={cls} style={{ transform: `rotate(${rot}deg)`, ...style }}>{children}</span>;
}
