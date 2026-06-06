// Malex site — Reservar: 6-step reservation wizard (fullscreen overlay).
const { MalexLogo, MalexIcon, Icon, Btn, Pill } = window;
const { useState, useEffect, useRef, useMemo } = React;

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
  if (hours <= 4) return { mode: "até 4h", days: 0, hours, total: p.h4 };
  const days = Math.max(1, Math.ceil(hours / 24));
  return { mode: days === 1 ? "1 diária" : `${days} diárias`, days, hours, total: days * p.day };
}
function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function maskCPF(v) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}
function validCPF(v) { return v.replace(/\D/g, "").length === 11; }
function maskPhone(v) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}
function lockerCode(unit) {
  const n = Math.floor(1000 + Math.random() * 8999);
  return `MLX-${(unit && unit.code) || "BR"}-${n}`;
}

/* deterministic pseudo-QR matrix from a seed string */
function qrMatrix(seed, size = 25) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const rng = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
  const m = Array.from({ length: size }, () => Array(size).fill(false));
  const finder = (r, c) => {
    for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
      const rr = r + i, cc = c + j;
      if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
      const edge = i === 0 || i === 6 || j === 0 || j === 6;
      const core = i >= 2 && i <= 4 && j >= 2 && j <= 4;
      m[rr][cc] = edge || core;
    }
  };
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    const inFinder = (r < 8 && c < 8) || (r < 8 && c >= size - 8) || (r >= size - 8 && c < 8);
    if (!inFinder) m[r][c] = rng() > 0.52;
  }
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
  return m;
}

function QRCode({ seed, size = 168 }) {
  const m = useMemo(() => qrMatrix(seed, 25), [seed]);
  const n = m.length;
  const cell = size / n;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="QR Code do locker" style={{ display: "block", background: "#fff", borderRadius: 8 }}>
      {m.map((row, r) => row.map((on, c) => on ? (
        <rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell + 0.5} height={cell + 0.5} fill="var(--navy-900)" />
      ) : null))}
    </svg>
  );
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
function Reservar({ open, initialSize, onClose }) {
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const panelRef = useRef(null);

  const [s, setS] = useState(() => ({
    unit: null, size: null,
    inDate: todayISO(), inTime: "14:00",
    outDate: todayISO(), outTime: "17:30",
    name: "", email: "", phone: "", cpf: "",
    pay: "pix",
    cardNum: "", cardName: "", cardExp: "", cardCvv: "",
  }));
  const set = (patch) => setS((prev) => ({ ...prev, ...patch }));

  // open / reset
  useEffect(() => {
    if (open) {
      setStep(0); setTouched(false); setConfirmation(null); setCopied(false);
      setS((prev) => ({ ...prev, size: initialSize || prev.size }));
      document.body.style.overflow = "hidden";
      setTimeout(() => panelRef.current && panelRef.current.focus(), 30);
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, initialSize]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const price = calcPrice(s);

  // per-step validity
  const valid = (() => {
    switch (step) {
      case 0: return !!s.unit;
      case 1: return !!s.size;
      case 2: return !!price;
      case 3: return s.name.trim().length > 1 && validEmail(s.email) && s.phone.replace(/\D/g, "").length >= 10 && validCPF(s.cpf);
      case 4: return s.pay === "pix" || (s.cardNum.replace(/\D/g, "").length >= 15 && s.cardName.trim() && s.cardExp.length >= 4 && s.cardCvv.length >= 3);
      default: return true;
    }
  })();

  const next = () => {
    if (!valid) { setTouched(true); return; }
    if (step === 4) {
      setConfirmation({ code: lockerCode(s.unit), at: new Date() });
      setStep(5); setTouched(false);
      if (panelRef.current) panelRef.current.scrollTop = 0;
      return;
    }
    setStep((v) => Math.min(5, v + 1)); setTouched(false);
    if (panelRef.current) panelRef.current.scrollTop = 0;
  };
  const back = () => { setStep((v) => Math.max(0, v - 1)); setTouched(false); };

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
          {step === 0 && <StepUnit s={s} set={set} />}
          {step === 1 && <StepSize s={s} set={set} />}
          {step === 2 && <StepPeriod s={s} set={set} price={price} touched={touched} />}
          {step === 3 && <StepData s={s} set={set} touched={touched} />}
          {step === 4 && <StepPay s={s} set={set} price={price} touched={touched} copied={copied} setCopied={setCopied} />}
          {step === 5 && <StepDone s={s} price={price} confirmation={confirmation} onClose={onClose} />}
        </div>
      </div>

      {/* footer */}
      {step < 5 && (
        <div className="wiz-foot">
          <button className="wiz-back" onClick={back} disabled={step === 0}>
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
          <Btn variant="primary" cta icon="arrow-right" onClick={next} disabled={!valid}>
            {step === 4 ? "Confirmar reserva" : "Continuar"}
          </Btn>
        </div>
      )}
    </div>
  );
}

/* ---------------- STEP 1 · UNIDADE ---------------- */
function StepUnit({ s, set }) {
  return (
    <div>
      <StepHead n="Passo 1" t="Onde você quer largar a mala?" d="Escolhe a unidade Malex mais perto de você. Todas abrem 24h." />
      <div className="unit-grid">
        {UNITS.map((u) => {
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
    </div>
  );
}

/* ---------------- STEP 2 · TAMANHO ---------------- */
function StepSize({ s, set }) {
  const order = ["P", "M", "G"];
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
                <span className="price tabular size-h4"><span className="price-cur">R$</span>{p.h4}<span className="size-unit">/4h</span></span>
                <span className="size-day tabular">R$ {p.day} / diária</span>
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
      <StepHead n="Passo 3" t="Por quanto tempo?" d="Marca a entrada e a saída. A gente calcula se é tarifa até 4h ou diária." />
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
  const eName = touched && s.name.trim().length <= 1;
  const eMail = touched && !validEmail(s.email);
  const ePhone = touched && s.phone.replace(/\D/g, "").length < 10;
  const eCpf = touched && !validCPF(s.cpf);
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
      <div className="data-reassure"><Icon name="lock" size={16} color="var(--navy-300)" /> Seus dados ficam com a gente, só pra liberar o locker.</div>
    </div>
  );
}

/* ---------------- STEP 5 · PAGAMENTO ---------------- */
function StepPay({ s, set, price, touched, copied, setCopied }) {
  const pixCode = useMemo(() => "00020126360014BR.GOV.BCB.PIX0114+5511990000000520400005303986540" + (price ? (price.total + ".00").padStart(7, "0") : "0000") + "5802BR5905MALEX6009SAO PAULO62070503***6304AB12", [price]);
  const copyPix = () => {
    navigator.clipboard && navigator.clipboard.writeText(pixCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  };
  const eCard = touched && s.pay === "card";
  return (
    <div>
      <StepHead n="Passo 5" t="Como você prefere pagar?" d="Pix na hora ou cartão. Nada é cobrado neste protótipo." />
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
        Protótipo de demonstração — nenhum valor é cobrado e nenhum dado é enviado.
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

Object.assign(window, { Reservar });
