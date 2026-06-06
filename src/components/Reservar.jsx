// Malex site — Reservar: 6-step reservation wizard (fullscreen overlay).
import React, { useState, useEffect, useRef, useMemo } from "react";
import QRCodeLib from "qrcode";
import { MalexLogo, MalexIcon, Icon, Btn, MALEX_CONTACT, MALEX_PRICING, MALEX_PIX } from "./Primitives.jsx";
import { saveReservation, supabaseEnabled } from "../lib/supabase.js";
import { buildPixPayload } from "../lib/pix.js";
import { listUnits, listLockers } from "../lib/admin.js";

/* ---------------- data ---------------- */
const UNITS = [
  { id: "gru", code: "GRU", name: "Aeroporto de Guarulhos · T2", city: "São Paulo · SP", free: 18, type: "plane" },
  { id: "cgh", code: "CGH", name: "Aeroporto de Congonhas", city: "São Paulo · SP", free: 11, type: "plane" },
  { id: "gig", code: "GIG", name: "Aeroporto do Galeão", city: "Rio de Janeiro · RJ", free: 14, type: "plane" },
  { id: "rec", code: "REC", name: "Aeroporto de Recife", city: "Recife · PE", free: 9, type: "plane" },
  { id: "tte", code: "TTE", name: "Rodoviária do Tietê", city: "São Paulo · SP", free: 22, type: "train" },
  { id: "luz", code: "LUZ", name: "Estação da Luz · Centro", city: "São Paulo · SP", free: 7, type: "train" },
];
const STEP_LABELS = ["Unidade", "Tamanho", "Período", "Dados", "Pagamento", "Pronto"];

/* ---------------- helpers ---------------- */
function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}`;
}
function calcPrice(state) {
  const p = MALEX_PRICING[state.size];
  if (!p || !state.inDate || !state.inTime || !state.outDate || !state.outTime) return null;
  const start = new Date(`${state.inDate}T${state.inTime}`);
  const end = new Date(`${state.outDate}T${state.outTime}`);
  if (isNaN(start) || isNaN(end) || end <= start) return null;
  const hours = (end - start) / 3.6e6;
  const days = Math.max(1, Math.ceil(hours / 24));
  return { mode: days === 1 ? "1 diária" : `${days} diárias`, days, hours, total: days * p.day };
}
function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function maskCPF(v) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}
function validCPF(v) {
  const c = v.replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (base) => { let sum = 0; for (let i = 0; i < base.length; i++) sum += parseInt(base[i], 10) * (base.length + 1 - i); const r = (sum * 10) % 11; return r === 10 ? 0 : r; };
  return dv(c.slice(0, 9)) === +c[9] && dv(c.slice(0, 10)) === +c[10];
}
function maskPhone(v) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}
function lockerCode(unit) {
  const n = Math.floor(1000 + Math.random() * 8999);
  return `MLX-${(unit && unit.code) || "BR"}-${n}`;
}


function QRCode({ seed, size = 168, label = "QR Code" }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let alive = true;
    QRCodeLib.toDataURL(String(seed || ""), { margin: 1, width: size * 2, errorCorrectionLevel: "M", color: { dark: "#0A2540", light: "#FFFFFF" } })
      .then((u) => { if (alive) setUrl(u); }).catch(() => {});
    return () => { alive = false; };
  }, [seed, size]);
  return <img src={url} width={size} height={size} alt={label} style={{ display: "block", background: "#fff", borderRadius: 8 }} />;
}

/* ---------------- field ---------------- */
function Field({ label, children, error, hint }) {
  return (
    <label className="wf-field">
      <span className="wf-field-lbl">{label}</span>
      {children}
      {error ? <span className="wf-field-err">{error}</span> : hint ? <span className="wf-field-hint">{hint}</span> : null}
    </label>
  );
}

/* ============================ WIZARD ============================ */
export function Reservar({ open, initialSize, initialUnitId, onClose }) {
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const panelRef = useRef(null);
  const [dbUnits, setDbUnits] = useState(null);

  const [s, setS] = useState(() => ({
    unit: null, size: null,
    inDate: todayISO(), inTime: "14:00",
    outDate: todayISO(), outTime: "17:30",
    name: "", email: "", phone: "", cpf: "", consent: false,
    pay: "pix",
    cardNum: "", cardName: "", cardExp: "", cardCvv: "",
  }));
  const set = (patch) => setS((prev) => ({ ...prev, ...patch }));

  // open / reset
  useEffect(() => {
    if (open) {
      setStep(0); setTouched(false); setConfirmation(null); setCopied(false);
      setSubmitting(false); setSubmitError(null);
      setS((prev) => {
        const patch = { size: initialSize || prev.size };
        if (initialUnitId) {
          const found = (dbUnits || UNITS).find((u) => u.id === initialUnitId);
          if (found) { patch.unit = found; }
        }
        return { ...prev, ...patch };
      });
      document.body.style.overflow = "hidden";
      setTimeout(() => panelRef.current && panelRef.current.focus(), 30);
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, initialSize, initialUnitId]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const [loadingUnits, setLoadingUnits] = useState(false);
  useEffect(() => {
    if (!open || !supabaseEnabled) return;
    let alive = true;
    setLoadingUnits(true);
    Promise.all([listUnits(), listLockers()]).then(([u, l]) => {
      if (!alive) return;
      setLoadingUnits(false);
      if (u.data && u.data.length) {
        const freeBy = {};
        (l.data || []).forEach((x) => { if (x.status === "free") freeBy[x.unit_id] = (freeBy[x.unit_id] || 0) + 1; });
        setDbUnits(u.data.map((x) => ({ id: x.id, code: x.code, name: x.name, city: x.city + " \u00b7 " + x.state, free: freeBy[x.id] || 0, type: x.kind || "other" })));
      } else setDbUnits([]);
    }).catch(() => { if (alive) setLoadingUnits(false); });
    return () => { alive = false; };
  }, [open]);
  const unitsList = dbUnits && dbUnits.length ? dbUnits : UNITS;

  const price = calcPrice(s);

  // per-step validity
  const valid = (() => {
    switch (step) {
      case 0: return !!s.unit;
      case 1: return !!s.size;
      case 2: return !!price;
      case 3: return s.name.trim().length > 1 && validEmail(s.email) && s.phone.replace(/\D/g, "").length >= 10 && validCPF(s.cpf) && s.consent;
      case 4: return s.pay === "pix" || (s.cardNum.replace(/\D/g, "").length >= 15 && s.cardName.trim() && s.cardExp.length >= 4 && s.cardCvv.length >= 3);
      default: return true;
    }
  })();

  // Final step: persist the reservation, then reveal the confirmation.
  // Card data is never sent (only the pay method) — see lib/supabase.js.
  const submit = async () => {
    const code = lockerCode(s.unit);
    const at = new Date();
    setSubmitError(null);
    if (supabaseEnabled) {
      setSubmitting(true);
      const { error } = await saveReservation({ s, price, code });
      setSubmitting(false);
      if (error) {
        console.error("Supabase insert error:", error);
        const detail = error.message || error.hint || error.details || "Confira a conexão e tente de novo.";
        setSubmitError("Não foi possível salvar: " + detail);
        return;
      }
    }
    setConfirmation({ code, at });
    setStep(5); setTouched(false);
    if (panelRef.current) panelRef.current.scrollTop = 0;
  };

  const next = () => {
    if (!valid || submitting) { if (!valid) setTouched(true); return; }
    if (step === 4) { submit(); return; }
    setStep((v) => Math.min(5, v + 1)); setTouched(false);
    if (panelRef.current) panelRef.current.scrollTop = 0;
  };
  const back = () => { setStep((v) => Math.max(0, v - 1)); setTouched(false); setSubmitError(null); };

  if (!open) return null;

  return (
    <div className="wiz-root on-navy" role="dialog" aria-modal="true" aria-label="Reservar locker">
      {/* top bar */}
      <div className="wiz-top">
        <MalexLogo height={22} />
        <div className="wiz-steps" aria-hidden="true">
          {STEP_LABELS.map((lbl, i) => (
            <div className={`wiz-step${i === step ? " on" : ""}${i < step ? " done" : ""}`} key={lbl}>
              <span className="wiz-step-no">{i < step ? <Icon name="check" size={14} color="var(--cream-500)" /> : i + 1}</span>
              <span className="wiz-step-lbl">{lbl}</span>
              {i < STEP_LABELS.length - 1 && <span className="wiz-step-line" />}
            </div>
          ))}
        </div>
        <button className="wiz-close" aria-label="Fechar" onClick={onClose}>
          <Icon name="close" size={24} color="var(--cream-500)" />
        </button>
      </div>

      {/* body */}
      <div className="wiz-body" ref={panelRef} tabIndex={-1}>
        <div className="wiz-inner" key={step}>
          {step === 0 && <StepUnit s={s} set={set} units={unitsList} loading={loadingUnits && supabaseEnabled} />}
          {step === 1 && <StepSize s={s} set={set} />}
          {step === 2 && <StepPeriod s={s} set={set} price={price} touched={touched} />}
          {step === 3 && <StepData s={s} set={set} touched={touched} />}
          {step === 4 && <StepPay s={s} set={set} price={price} touched={touched} copied={copied} setCopied={setCopied} />}
          {step === 5 && <StepDone s={s} price={price} confirmation={confirmation} onClose={onClose} />}
        </div>
      </div>

      {/* footer */}
      {step < 5 && (
        <>
          {submitError && (
            <div className="wiz-error" role="alert">
              <Icon name="shield" size={16} color="var(--orange-400)" /> {submitError}
            </div>
          )}
          <div className="wiz-foot">
            <button className="wiz-back" onClick={back} disabled={step === 0 || submitting}>
              <Icon name="arrow-left" size={18} color="currentColor" /> Voltar
            </button>
            <div className="wiz-foot-mid">
              {price && s.size && (
                <div className="wiz-total">
                  <span className="wiz-total-lbl">{MALEX_PRICING[s.size].name} · {price.mode}</span>
                  <span className="wiz-total-val price tabular">R$ {price.total}</span>
                </div>
              )}
            </div>
            <Btn variant="primary" cta icon={submitting ? undefined : "arrow-right"} onClick={next} disabled={!valid || submitting}>
              {step === 4 ? (submitting ? "Salvando…" : "Confirmar reserva") : "Continuar"}
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- STEP 1 · UNIDADE ---------------- */
function UnitSkeleton() {
  return (
    <div className="unit-grid">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="unit-card unit-card-skel">
          <span className="skel-line skel-w-20" />
          <span className="skel-line skel-w-60" style={{ marginTop: 8 }} />
          <span className="skel-line skel-w-40" style={{ marginTop: 6 }} />
        </div>
      ))}
    </div>
  );
}

function StepUnit({ s, set, units = UNITS, loading = false }) {
  return (
    <div>
      <StepHead n="Passo 1" t="Onde você quer largar a mala?" d="Escolhe a unidade Malex mais perto de você. Todas abrem 24h." />
      {loading ? <UnitSkeleton /> : (
        <div className="unit-grid">
          {units.map((u) => {
            const on = s.unit && s.unit.id === u.id;
            return (
              <button key={u.id} className={`unit-card${on ? " sel" : ""}`} onClick={() => set({ unit: u })} aria-pressed={on}>
                <span className="unit-code">{u.code}</span>
                <span className="unit-radio">{on && <Icon name="check" size={14} color="var(--cream-500)" />}</span>
                <span className="unit-name">{u.name}</span>
                <span className="unit-city">{u.city}</span>
                <span className="unit-free"><Icon name="locker" size={15} color="var(--navy-300)" /> {u.free} lockers livres · 24h</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- STEP 2 · TAMANHO ---------------- */
function StepSize({ s, set }) {
  const order = ["P", "G"];
  return (
    <div>
      <StepHead n="Passo 2" t="Qual o tamanho do volume?" d="Escolhe pelo que você vai guardar. O preço aparece na hora." />
      <div className="size-grid">
        {order.map((k) => {
          const p = MALEX_PRICING[k];
          const on = s.size === k;
          return (
            <button key={k} className={`size-card${on ? " sel" : ""}`} onClick={() => set({ size: k })} aria-pressed={on}>
              <div className="size-card-top">
                <span className="size-key">{k}</span>
                <span className="unit-radio">{on && <Icon name="check" size={14} color="var(--cream-500)" />}</span>
              </div>
              <div className="size-name t-h3">{p.name}</div>
              <div className="size-fits t-body-sm">{p.fits}</div>
              <div className="size-prices">
                <span className="price tabular size-h4"><span className="price-cur">R$</span>{p.day}<span className="size-unit">/diária</span></span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- STEP 3 · PERÍODO ---------------- */
function StepPeriod({ s, set, price, touched }) {
  const invalid = touched && !price;
  return (
    <div>
      <StepHead n="Passo 3" t="Por quanto tempo?" d="Marca a entrada e a saída. A cobrança é por diária — a gente calcula o total." />
      <div className="period-grid">
        <div className="period-col">
          <div className="period-h"><Icon name="calendar-check" size={18} color="var(--orange-400)" /> Entrada</div>
          <div className="period-fields">
            <Field label="Data"><input className="field" type="date" value={s.inDate} min={todayISO()} onChange={(e) => set({ inDate: e.target.value })} /></Field>
            <Field label="Hora"><input className="field" type="time" value={s.inTime} onChange={(e) => set({ inTime: e.target.value })} /></Field>
          </div>
        </div>
        <div className="period-col">
          <div className="period-h"><Icon name="clock" size={18} color="var(--orange-400)" /> Saída</div>
          <div className="period-fields">
            <Field label="Data"><input className="field" type="date" value={s.outDate} min={s.inDate} onChange={(e) => set({ outDate: e.target.value })} /></Field>
            <Field label="Hora"><input className="field" type="time" value={s.outTime} onChange={(e) => set({ outTime: e.target.value })} /></Field>
          </div>
        </div>
      </div>

      {invalid && <div className="period-warn">A saída precisa ser depois da entrada.</div>}

      <div className="period-result">
        {price ? (
          <>
            <div className="period-result-row">
              <span><Icon name="ticket" size={18} color="var(--cream-500)" /> Tarifa</span>
              <span>{price.mode}{price.days > 0 ? ` · ${Math.round(price.hours)}h` : ` · ${price.hours.toFixed(1)}h`}</span>
            </div>
            <div className="period-result-row total">
              <span>Total</span>
              <span className="price tabular">R$ {price.total}</span>
            </div>
            <div className="period-note">Preço na tela. Sem surpresa.</div>
          </>
        ) : (
          <div className="period-note">Selecione um período válido pra ver o total.</div>
        )}
      </div>
    </div>
  );
}

/* ---------------- STEP 4 · DADOS ---------------- */
function StepData({ s, set, touched }) {
  const [priv, setPriv] = useState(false);
  const eName = touched && s.name.trim().length <= 1;
  const eMail = touched && !validEmail(s.email);
  const ePhone = touched && s.phone.replace(/\D/g, "").length < 10;
  const eCpf = touched && !validCPF(s.cpf);
  const eConsent = touched && !s.consent;
  return (
    <div>
      <StepHead n="Passo 4" t="Pra quem é a reserva?" d="Só o essencial pra liberar o seu locker." />
      <div className="data-grid">
        <Field label="Nome completo" error={eName ? "Conta seu nome." : null}>
          <input className="field" type="text" autoComplete="name" value={s.name} placeholder="Maria Silva" onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="E-mail" error={eMail ? "Confere o e-mail." : null}>
          <input className="field" type="email" autoComplete="email" value={s.email} placeholder="voce@email.com" onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field label="Celular" error={ePhone ? "Confere o celular." : null}>
          <input className="field" type="tel" inputMode="numeric" autoComplete="tel" value={s.phone} placeholder="(11) 90000-0000" onChange={(e) => set({ phone: maskPhone(e.target.value) })} />
        </Field>
        <Field label="CPF" error={eCpf ? "CPF precisa de 11 dígitos." : null}>
          <input className="field" type="text" inputMode="numeric" value={s.cpf} placeholder="000.000.000-00" onChange={(e) => set({ cpf: maskCPF(e.target.value) })} />
        </Field>
      </div>
      <label className={`wf-consent${eConsent ? " err" : ""}`}>
        <input type="checkbox" checked={s.consent} onChange={(e) => set({ consent: e.target.checked })} />
        <span>Li e aceito a <button type="button" className="wf-link" onClick={() => setPriv(true)}>Política de Privacidade</button> e o tratamento dos meus dados conforme a LGPD.</span>
      </label>
      {eConsent && <span className="wf-field-err" style={{ marginTop: 6, display: "block" }}>Você precisa aceitar para continuar.</span>}
      <div className="data-reassure"><Icon name="lock" size={16} color="var(--navy-300)" /> Seus dados ficam com a gente, só pra liberar o locker.</div>
      {priv && <PrivacyModal onClose={() => setPriv(false)} />}
    </div>
  );
}

function PrivacyModal({ onClose }) {
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="priv-scrim" onClick={onClose}>
      <div className="priv-modal on-navy" onClick={(e) => e.stopPropagation()}>
        <div className="priv-head">
          <h3 className="t-h4" style={{ color: "var(--cream-500)", margin: 0 }}>Política de Privacidade</h3>
          <button className="wiz-close" onClick={onClose} aria-label="Fechar"><Icon name="close" size={22} color="var(--cream-500)" /></button>
        </div>
        <div className="priv-body t-body-sm">
          <p>A Malex coleta <strong>nome, CPF, e-mail e telefone</strong> com uma única finalidade: identificar você e liberar o seu locker com segurança.</p>
          <p>Não vendemos nem compartilhamos seus dados para fins de marketing. Eles são tratados conforme a <strong>LGPD (Lei nº 13.709/2018)</strong> e guardados só pelo tempo necessário ao serviço.</p>
          <p>Você pode solicitar acesso, correção ou exclusão dos seus dados pelo nosso WhatsApp ou e-mail de contato.</p>
        </div>
        <Btn variant="primary" cta className="btn-block" onClick={onClose}>Entendi</Btn>
      </div>
    </div>
  );
}

/* ---------------- STEP 5 · PAGAMENTO ---------------- */
function StepPay({ s, set, price, touched, copied, setCopied }) {
  const pixCode = useMemo(
    () => buildPixPayload({ key: MALEX_PIX.key, name: MALEX_PIX.name, city: MALEX_PIX.city, amount: price ? price.total : undefined }),
    [price]
  );
  const copyPix = () => {
    navigator.clipboard && navigator.clipboard.writeText(pixCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  };
  const eCard = touched && s.pay === "card";
  return (
    <div>
      <StepHead n="Passo 5" t="Como você prefere pagar?" d="O Pix gera um código real com o valor da reserva. Sua vaga confirma após o pagamento. Cartão ainda é ilustrativo." />
      <div className="pay-toggle">
        <button className={`pay-tab${s.pay === "pix" ? " on" : ""}`} onClick={() => set({ pay: "pix" })}>
          <Icon name="pix" size={20} color="currentColor" /> Pix
        </button>
        <button className={`pay-tab${s.pay === "card" ? " on" : ""}`} onClick={() => set({ pay: "card" })}>
          <Icon name="card" size={20} color="currentColor" /> Cartão
        </button>
      </div>

      <div className="pay-grid">
        <div className="pay-main">
          {s.pay === "pix" ? (
            <div className="pix-box">
              <QRCode seed={pixCode} size={172} />
              <div className="pix-side">
                <div className="t-h4" style={{ color: "var(--cream-500)", margin: 0 }}>Pague com Pix</div>
                <p className="t-body-sm" style={{ color: "var(--navy-200)", margin: "6px 0 14px" }}>Escaneia o QR ou copia o código abaixo no app do seu banco.</p>
                <div className="pix-copy">
                  <input className="field pix-input" readOnly value={pixCode} aria-label="Pix copia e cola" onFocus={(e) => e.target.select()} />
                  <button className="btn btn-secondary pix-btn" onClick={copyPix}>
                    {copied ? <><Icon name="check" size={16} color="var(--cream-500)" /> Copiado</> : "Copiar"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="card-form">
              <Field label="Número do cartão" error={eCard && s.cardNum.replace(/\D/g, "").length < 15 ? "Confere o número." : null}>
                <input className="field" inputMode="numeric" value={s.cardNum} placeholder="0000 0000 0000 0000"
                  onChange={(e) => set({ cardNum: e.target.value.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ") })} />
              </Field>
              <Field label="Nome impresso no cartão" error={eCard && !s.cardName.trim() ? "Confere o nome." : null}>
                <input className="field" value={s.cardName} placeholder="MARIA SILVA" onChange={(e) => set({ cardName: e.target.value.toUpperCase() })} />
              </Field>
              <div className="card-row">
                <Field label="Validade" error={eCard && s.cardExp.length < 4 ? "MM/AA" : null}>
                  <input className="field" inputMode="numeric" value={s.cardExp} placeholder="MM/AA"
                    onChange={(e) => set({ cardExp: e.target.value.replace(/\D/g, "").slice(0, 4).replace(/(\d{2})(?=\d)/, "$1/") })} />
                </Field>
                <Field label="CVV" error={eCard && s.cardCvv.length < 3 ? "3 díg." : null}>
                  <input className="field" inputMode="numeric" value={s.cardCvv} placeholder="000" onChange={(e) => set({ cardCvv: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
                </Field>
              </div>
            </div>
          )}
        </div>

        <ResumoCard s={s} price={price} />
      </div>

      <div className="pay-disclaimer">
        <Icon name="shield" size={16} color="var(--navy-300)" />
        Pix real para a chave Malex. Sua vaga é confirmada após o pagamento — guarde o comprovante.
      </div>
    </div>
  );
}

/* ---------------- STEP 6 · CONFIRMAÇÃO ---------------- */
function StepDone({ s, price, confirmation, onClose }) {
  const code = confirmation ? confirmation.code : "MLX-BR-0000";
  return (
    <div className="done">
      <div className="done-badge"><Icon name="check" size={34} color="var(--cream-500)" /></div>
      <h2 className="t-display done-title">Tudo certo.<br />Pode seguir leve.</h2>
      <p className="t-body-lg done-sub">Mostra o QR Code no totem da unidade pra abrir o seu locker.</p>

      <div className="done-card">
        <div className="done-qr">
          <QRCode seed={code} size={180} />
          <div className="done-code">
            <span className="t-overline" style={{ color: "var(--navy-400)" }}>Código do locker</span>
            <span className="done-code-val tabular">{code}</span>
            <span className="done-unit">{s.unit ? `${s.unit.code} · ${s.unit.name}` : ""}</span>
          </div>
        </div>
        <div className="done-summary">
          <ResumoRows s={s} price={price} />
        </div>
      </div>

      <div className="done-next">
        <div className="done-next-h">O que fazer agora</div>
        <ol>
          <li>Pague o Pix do passo anterior — sua vaga confirma após o pagamento.</li>
          <li>Na unidade, mostre este QR Code no totem pra abrir o seu locker.</li>
          <li>Retire sua bagagem até a data combinada.</li>
          <li>Qualquer dúvida, fale com a gente no WhatsApp.</li>
        </ol>
      </div>

      <div className="done-actions">
        <Btn variant="primary" cta icon="arrow-right" onClick={onClose}>Seguir leve</Btn>
        <a className="btn btn-tertiary" href={MALEX_CONTACT.whatsapp} target="_blank" rel="noopener noreferrer" style={{ color: "var(--cream-500)" }}>
          Precisa de ajuda? WhatsApp
        </a>
      </div>
    </div>
  );
}

/* ---------------- shared ---------------- */
function StepHead({ n, t, d }) {
  return (
    <div className="wf-head">
      <span className="t-overline" style={{ color: "var(--orange-400)" }}>{n}</span>
      <h2 className="t-h1 wf-title">{t}</h2>
      <p className="t-body-lg wf-desc">{d}</p>
    </div>
  );
}

function ResumoRows({ s, price }) {
  const p = s.size ? MALEX_PRICING[s.size] : null;
  const rows = [
    ["Unidade", s.unit ? `${s.unit.code} · ${s.unit.name}` : "—"],
    ["Tamanho", p ? p.name : "—"],
    ["Entrada", `${fmtDate(s.inDate)} · ${s.inTime}`],
    ["Saída", `${fmtDate(s.outDate)} · ${s.outTime}`],
    ["Tarifa", price ? price.mode : "—"],
    ["Pagamento", s.pay === "pix" ? "Pix" : "Cartão"],
    ["Nome", s.name || "—"],
    ["Celular", s.phone || "—"],
  ];
  return (
    <div className="resumo-rows">
      {rows.map(([k, v]) => (
        <div className="resumo-row" key={k}><span className="resumo-k">{k}</span><span className="resumo-v">{v}</span></div>
      ))}
      <div className="resumo-row total"><span>Total</span><span className="price tabular">{price ? `R$ ${price.total}` : "—"}</span></div>
    </div>
  );
}

function ResumoCard({ s, price }) {
  return (
    <aside className="resumo-card">
      <div className="resumo-h t-h4">Resumo</div>
      <ResumoRows s={s} price={price} />
      <div className="resumo-note"><Icon name="check" size={14} color="var(--orange-400)" /> Preço na tela. Sem surpresa.</div>
    </aside>
  );
}
