// Malex — Painel administrativo (login único + gestão de unidades/lockers/financeiro).
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { MalexLogo, Icon, Btn } from "../components/Primitives.jsx";
import {
  supabaseEnabled, getSession, onAuth, signIn, signOut,
  listUnits, addUnit, deleteUnit,
  listLockers, addLockersBulk, addLocker, deleteLocker,
  occupyLocker, freeLocker, setLockerStatus,
  listReservations, checkInReservation, cancelReservation, setPaymentStatus,
} from "../lib/admin.js";

const UF = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const SIZE_NAME = { P: "Pequeno", M: "Médio", G: "Grande" };
const MONTHS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

export default function AdminApp() {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    if (!supabaseEnabled) { setSession(null); return; }
    getSession().then(setSession);
    return onAuth(setSession);
  }, []);
  if (!supabaseEnabled) return <ConfigMissing />;
  if (session === undefined) return <Splash>Carregando…</Splash>;
  if (!session) return <Login />;
  return <Dashboard session={session} />;
}

/* ============================ LOGIN ============================ */
function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    const { error } = await signIn(email.trim(), pass);
    setBusy(false);
    if (error) setErr(error.message || "Não foi possível entrar.");
  };
  return (
    <div className="adm-login on-navy">
      <form className="adm-login-card" onSubmit={submit}>
        <MalexLogo height={28} />
        <h1 className="t-h3" style={{ color: "var(--cream-500)", margin: "18px 0 4px" }}>Painel do gestor</h1>
        <p className="t-body-sm" style={{ color: "var(--navy-200)", margin: "0 0 22px" }}>Acesso restrito. Entre com seu e-mail e senha.</p>
        <label className="wf-field"><span className="wf-field-lbl">E-mail</span>
          <input className="field" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="gestor@malexpernambuco.com.br" />
        </label>
        <label className="wf-field" style={{ marginTop: 14 }}><span className="wf-field-lbl">Senha</span>
          <input className="field" type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" />
        </label>
        {err && <div className="adm-err" style={{ marginTop: 14 }}>{err}</div>}
        <Btn type="submit" variant="primary" cta className="btn-block" style={{ marginTop: 20 }} disabled={busy}>{busy ? "Entrando…" : "Entrar"}</Btn>
      </form>
    </div>
  );
}

/* ============================ DASHBOARD ============================ */
function Dashboard({ session }) {
  const [units, setUnits] = useState([]);
  const [lockers, setLockers] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [selUnit, setSelUnit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [view, setView] = useState("units");

  const reload = useCallback(async () => {
    setLoading(true);
    const [u, l, r] = await Promise.all([listUnits(), listLockers(), listReservations()]);
    setUnits(u.data); setLockers(l.data); setReservations(r.data);
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const resById = useMemo(() => Object.fromEntries(reservations.map((r) => [r.id, r])), [reservations]);
  const tree = useMemo(() => {
    const t = {};
    for (const u of units) { (t[u.state] ||= {}); (t[u.state][u.city] ||= []).push(u); }
    return t;
  }, [units]);
  const unitLockers = useMemo(() => (selUnit ? lockers.filter((l) => l.unit_id === selUnit.id) : []), [lockers, selUnit]);

  const close = () => setModal(null);
  const afterChange = async () => { close(); await reload(); };

  return (
    <div className="adm on-navy">
      <header className="adm-top">
        <div className="adm-top-l"><MalexLogo height={22} /><span className="adm-badge">Gestor</span></div>
        <nav className="adm-nav">
          <button className={view === "units" ? "on" : ""} onClick={() => setView("units")}>Unidades</button>
          <button className={view === "finance" ? "on" : ""} onClick={() => setView("finance")}>Financeiro</button>
        </nav>
        <div className="adm-top-r">
          <span className="t-body-sm" style={{ color: "var(--navy-200)" }}>{session.user?.email}</span>
          <button className="adm-link" onClick={() => signOut()}><Icon name="arrow-right" size={16} /> Sair</button>
        </div>
      </header>

      {view === "units" && (
      <div className="adm-body">
        <aside className="adm-side">
          <div className="adm-side-head">
            <span className="t-overline" style={{ color: "var(--navy-300)" }}>Unidades do Brasil</span>
            <button className="adm-add-sm" title="Adicionar unidade" onClick={() => setModal({ type: "unit" })}><Icon name="plus" size={16} /></button>
          </div>
          {loading ? <div className="adm-muted">Carregando…</div> :
            Object.keys(tree).length === 0 ? <div className="adm-muted">Nenhuma unidade. Clique em + pra adicionar.</div> :
            Object.keys(tree).sort().map((st) => (
              <StateGroup key={st} state={st} cities={tree[st]} lockers={lockers} selUnit={selUnit} onSelect={setSelUnit} />
            ))}
        </aside>

        <main className="adm-main">
          {!selUnit ? (
            <div className="adm-empty">
              <Icon name="map" size={40} color="var(--navy-400)" />
              <p className="t-body" style={{ color: "var(--navy-200)" }}>Selecione uma unidade na lista pra ver o painel, lockers e agendamentos.</p>
            </div>
          ) : (
            <UnitView unit={selUnit} lockers={unitLockers} reservations={reservations} resById={resById}
              onAddLockers={() => setModal({ type: "lockers", unit: selUnit })}
              onOccupy={(lk) => setModal({ type: "occupy", unit: selUnit, locker: lk, lockers: unitLockers, reservations })}
              onOccupyTop={() => setModal({ type: "occupy", unit: selUnit, locker: null, lockers: unitLockers, reservations })}
              onPickupTop={() => setModal({ type: "pickup", unit: selUnit, lockers: unitLockers })}
              onFree={async (lk) => { await freeLocker(lk); await reload(); }}
              onMaint={async (lk, st) => { await setLockerStatus(lk, st); await reload(); }}
              onCheckIn={(b) => setModal({ type: "checkin", unit: selUnit, reservation: b, lockers: unitLockers })}
              onCancelBooking={async (b) => { if (confirm(`Cancelar o agendamento de ${b.customer_name}?`)) { await cancelReservation(b.id); await reload(); } }}
              onDelLocker={async (lk) => { if (confirm(`Excluir locker ${lk.label}?`)) { await deleteLocker(lk.id); await reload(); } }}
              onDelUnit={async () => { if (confirm(`Excluir a unidade ${selUnit.name} e todos os seus lockers?`)) { await deleteUnit(selUnit.id); setSelUnit(null); await reload(); } }}
            />
          )}
        </main>
      </div>
      )}

      {view === "finance" && (
        <div className="adm-finance">
          <FinanceView reservations={reservations} units={units}
            onSetPaid={async (id, st) => { await setPaymentStatus(id, st); await reload(); }} />
        </div>
      )}

      {modal?.type === "unit" && <UnitModal onClose={close} onDone={afterChange} />}
      {modal?.type === "lockers" && <LockersModal unit={modal.unit} onClose={close} onDone={afterChange} />}
      {modal?.type === "occupy" && <OccupyModal unit={modal.unit} locker={modal.locker} lockers={modal.lockers} reservations={modal.reservations} onClose={close} onDone={afterChange} />}
      {modal?.type === "pickup" && <PickupModal unit={modal.unit} lockers={modal.lockers} resById={resById} onClose={close} onDone={afterChange} />}
      {modal?.type === "checkin" && <CheckInModal unit={modal.unit} reservation={modal.reservation} lockers={modal.lockers} onClose={close} onDone={afterChange} />}
    </div>
  );
}

function StateGroup({ state, cities, lockers, selUnit, onSelect }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="adm-state">
      <button className="adm-state-h" onClick={() => setOpen((o) => !o)}>
        <Icon name="chevron-right" size={14} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
        {state}
      </button>
      {open && Object.keys(cities).sort().map((city) => (
        <div className="adm-city" key={city}>
          <div className="adm-city-h">{city}</div>
          {cities[city].map((u) => {
            const lk = lockers.filter((l) => l.unit_id === u.id);
            const occ = lk.filter((l) => l.status === "occupied").length;
            return (
              <button key={u.id} className={`adm-unit${selUnit?.id === u.id ? " on" : ""}`} onClick={() => onSelect(u)}>
                <span className="adm-unit-code">{u.code}</span>
                <span className="adm-unit-name">{u.name}</span>
                <span className="adm-unit-occ">{lk.length ? `${occ}/${lk.length}` : "—"}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ---------- detalhe da unidade ---------- */
function UnitView({ unit, lockers, reservations, resById, onAddLockers, onOccupy, onFree, onMaint, onDelLocker, onDelUnit, onCheckIn, onCancelBooking, onOccupyTop, onPickupTop }) {
  const [tab, setTab] = useState("metrics");
  const occ = lockers.filter((l) => l.status === "occupied").length;
  const free = lockers.filter((l) => l.status === "free").length;
  const bySize = (sz) => lockers.filter((l) => l.size === sz);
  const unitRes = reservations.filter((r) => r.unit_code === unit.code || r.unit_ref === unit.id);
  const bookings = unitRes.filter((r) => r.status === "reserved");

  return (
    <div>
      <div className="adm-unit-head">
        <div>
          <span className="t-overline" style={{ color: "var(--orange-400)" }}>{unit.state} · {unit.city}</span>
          <h2 className="t-h2" style={{ color: "var(--cream-500)", margin: "4px 0 0" }}>{unit.code} · {unit.name}</h2>
          {unit.address && <p className="t-body-sm" style={{ color: "var(--navy-300)", margin: "6px 0 0" }}>{unit.address}</p>}
        </div>
        <div className="adm-unit-actions">
          <Btn variant="primary" onClick={onOccupyTop}>Ocupar locker</Btn>
          <Btn variant="secondary" onClick={onPickupTop}>Retirar bagagem</Btn>
          <UnitMenu onAddLockers={onAddLockers} onDelUnit={onDelUnit} />
        </div>
      </div>

      <div className="adm-stats">
        <Stat n={lockers.length} l="lockers" />
        <Stat n={occ} l="ocupados" tone="orange" />
        <Stat n={free} l="livres" tone="success" />
        <Stat n={bookings.length} l="agendamentos" tone="muted" />
      </div>

      <div className="adm-tabs">
        <button className={`adm-tab${tab === "metrics" ? " on" : ""}`} onClick={() => setTab("metrics")}>Painel</button>
        <button className={`adm-tab${tab === "lockers" ? " on" : ""}`} onClick={() => setTab("lockers")}>Ocupação</button>
        <button className={`adm-tab${tab === "bookings" ? " on" : ""}`} onClick={() => setTab("bookings")}>Agendamentos{bookings.length ? ` · ${bookings.length}` : ""}</button>
        <button className={`adm-tab${tab === "table" ? " on" : ""}`} onClick={() => setTab("table")}>Visão geral</button>
      </div>

      {tab === "metrics" && <MetricsView reservations={unitRes} />}

      {tab === "lockers" && (
        lockers.length === 0 ? (
          <div className="adm-empty sm"><p className="t-body" style={{ color: "var(--navy-200)" }}>Sem lockers nesta unidade. Clique em “Adicionar lockers” no menu ⋯.</p></div>
        ) : (
          ["P", "G"].map((sz) => bySize(sz).length > 0 && (
            <div className="adm-size-row" key={sz}>
              <div className="adm-size-lbl">{SIZE_NAME[sz]} <span>({sz})</span></div>
              <div className="adm-locker-grid">
                {bySize(sz).map((lk) => (
                  <LockerCard key={lk.id} lk={lk} res={resById[lk.current_reservation_id]}
                    onOccupy={() => onOccupy(lk)} onFree={() => onFree(lk)} onMaint={(st) => onMaint(lk, st)} onDel={() => onDelLocker(lk)} />
                ))}
              </div>
            </div>
          ))
        )
      )}

      {tab === "bookings" && <BookingsList unit={unit} bookings={bookings} lockers={lockers} onCheckIn={onCheckIn} onCancel={onCancelBooking} />}

      {tab === "table" && <TableView reservations={unitRes} lockers={lockers} />}
    </div>
  );
}

function BookingsList({ unit, bookings, lockers, onCheckIn, onCancel }) {
  if (!bookings.length) return (
    <div className="adm-empty sm"><Icon name="calendar-check" size={32} color="var(--navy-400)" /><p className="t-body" style={{ color: "var(--navy-200)" }}>Nenhum agendamento pendente nesta unidade.</p></div>
  );
  return (
    <div className="adm-bookings">
      {bookings.map((b) => {
        const freeForSize = lockers.filter((l) => l.status === "free" && l.size === b.size).length;
        return (
          <div className="adm-booking" key={b.id}>
            <div className="adm-booking-main">
              <div className="adm-booking-name">{b.customer_name}</div>
              <div className="adm-booking-sub">{b.customer_phone || "—"} · {b.size_name || b.size}</div>
              <div className="adm-booking-dates">
                <span><Icon name="calendar-check" size={13} color="var(--orange-400)" /> Entrada {fmtDateTime(b.check_in)}</span>
                <span><Icon name="clock" size={13} color="var(--navy-300)" /> Retirada {fmtDateTime(b.check_out)}</span>
              </div>
              <div className="adm-booking-code mono">{b.locker_code}</div>
            </div>
            <div className="adm-booking-actions">
              <button className="adm-mini primary" disabled={!freeForSize} title={freeForSize ? "" : "Sem locker livre desse tamanho"} onClick={() => onCheckIn(b)}>
                {freeForSize ? "Cliente entregou a mala" : `Sem vaga ${b.size}`}
              </button>
              <button className="adm-mini ghost" onClick={() => onCancel(b)}>Cancelar</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- painel de métricas ---------- */
function MetricsView({ reservations }) {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startWeek = (() => { const d = new Date(startToday); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return d; })();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const resDate = (r) => r.created_at;
  const doneDate = (r) => r.closed_at || r.check_out || r.created_at;
  const notCancelled = reservations.filter((r) => r.status !== "cancelled");
  const done = reservations.filter((r) => r.status === "done");
  const countSince = (list, gd, start) => list.reduce((a, r) => (new Date(gd(r)) >= start ? a + 1 : a), 0);
  const sumSince = (list, gd, start, val) => list.reduce((a, r) => (new Date(gd(r)) >= start ? a + (val(r) || 0) : a), 0);
  const monthSeries = (list, gd, val) => {
    const arr = Array.from({ length: daysInMonth }, (_, i) => ({ k: i + 1, v: 0 }));
    for (const r of list) { const d = new Date(gd(r)); if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) arr[d.getDate() - 1].v += val ? val(r) : 1; }
    return arr;
  };
  const price = (r) => r.price_total || 0;
  const monthLbl = `${MONTHS[now.getMonth()]}/${String(now.getFullYear()).slice(2)}`;
  const blocks = [
    { title: "Reservas", color: "var(--orange-500)", d: countSince(notCancelled, resDate, startToday), w: countSince(notCancelled, resDate, startWeek), m: countSince(notCancelled, resDate, startMonth), series: monthSeries(notCancelled, resDate) },
    { title: "Fluxos concluídos", color: "#4ADE80", d: countSince(done, doneDate, startToday), w: countSince(done, doneDate, startWeek), m: countSince(done, doneDate, startMonth), series: monthSeries(done, doneDate) },
    { title: "Faturamento", color: "var(--royal-400)", money: true, d: sumSince(notCancelled, resDate, startToday, price), w: sumSince(notCancelled, resDate, startWeek, price), m: sumSince(notCancelled, resDate, startMonth, price), series: monthSeries(notCancelled, resDate, price) },
  ];
  const fmt = (v, money) => (money ? `R$ ${Number(v).toLocaleString("pt-BR")}` : v);
  return (
    <div className="adm-metrics">
      {blocks.map((b) => (
        <section className="adm-msec" key={b.title}>
          <h3 className="adm-msec-h">{b.title}</h3>
          <div className="adm-mcards">
            <MCard n={fmt(b.d, b.money)} l="hoje" />
            <MCard n={fmt(b.w, b.money)} l="esta semana" />
            <MCard n={fmt(b.m, b.money)} l="este mês" accent />
          </div>
          <div className="adm-chart-cap">Por dia · {monthLbl}</div>
          <BarChart data={b.series} color={b.color} money={b.money} />
        </section>
      ))}
      <p className="adm-metrics-note">Reservas e faturamento contam pela data da compra (inclui as do site, vinculadas a esta unidade); cancelados são excluídos. Concluídos contam pela data de liberação.</p>
    </div>
  );
}
function MCard({ n, l, accent }) {
  return <div className={`adm-mcard${accent ? " accent" : ""}`}><div className="adm-mcard-n tabular">{n}</div><div className="adm-mcard-l">{l}</div></div>;
}
function BarChart({ data, color = "var(--orange-500)", money }) {
  const max = Math.max(1, ...data.map((d) => d.v));
  const today = new Date().getDate();
  return (
    <div className="adm-chart">
      {data.map((d) => (
        <div className="adm-bar-col" key={d.k} title={`Dia ${d.k}: ${money ? "R$ " + Number(d.v).toLocaleString("pt-BR") : d.v}`}>
          <div className="adm-bar" style={{ height: `${(d.v / max) * 100}%`, background: color, opacity: d.k === today ? 1 : 0.78 }} />
          {(d.k === 1 || d.k % 5 === 0) && <span className="adm-bar-lbl">{d.k}</span>}
        </div>
      ))}
    </div>
  );
}

/* ============================ FINANCEIRO ============================ */
const PAYMENT_META = {
  pending:  { label: "Pendente",  cls: "pay-pending" },
  paid:     { label: "Pago",      cls: "pay-paid" },
  failed:   { label: "Falhou",    cls: "pay-failed" },
  refunded: { label: "Estornado", cls: "pay-refunded" },
};
const money = (v) => `R$ ${Number(v || 0).toLocaleString("pt-BR")}`;

function FinanceView({ reservations, units, onSetPaid }) {
  const unitByCode = useMemo(() => Object.fromEntries(units.map((u) => [u.code, u])), [units]);
  const unitById = useMemo(() => Object.fromEntries(units.map((u) => [u.id, u])), [units]);
  const unitOf = (r) => unitById[r.unit_ref] || unitByCode[r.unit_code] || null;
  const [estado, setEstado] = useState("all");
  const [unitId, setUnitId] = useState("all");
  const [method, setMethod] = useState("all");
  const [pstatus, setPstatus] = useState("all");
  const [period, setPeriod] = useState("month");
  const [q, setQ] = useState("");
  const states = useMemo(() => [...new Set(units.map((u) => u.state))].sort(), [units]);
  const unitOptions = useMemo(() => (estado === "all" ? units : units.filter((u) => u.state === estado)), [units, estado]);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start7 = new Date(startToday); start7.setDate(start7.getDate() - 6);
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodStart = period === "today" ? startToday : period === "7d" ? start7 : period === "month" ? startMonth : null;
  const amount = (r) => r.price_total || 0;
  const base = reservations.filter((r) => r.price_total != null);
  const filtered = useMemo(() => base.filter((r) => {
    const u = unitOf(r);
    if (estado !== "all" && (!u || u.state !== estado)) return false;
    if (unitId !== "all" && (!u || u.id !== unitId)) return false;
    if (method !== "all" && (r.pay_method || "") !== method) return false;
    if (pstatus !== "all" && (r.payment_status || "pending") !== pstatus) return false;
    if (periodStart && new Date(r.created_at) < periodStart) return false;
    if (q) { const s = q.toLowerCase(); if (!((r.customer_name || "").toLowerCase().includes(s) || (r.locker_code || "").toLowerCase().includes(s))) return false; }
    return true;
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)), [reservations, estado, unitId, method, pstatus, period, q]);
  const sum = (list) => list.reduce((a, r) => a + amount(r), 0);
  const total = sum(filtered);
  const received = sum(filtered.filter((r) => r.payment_status === "paid"));
  const pending = sum(filtered.filter((r) => (r.payment_status || "pending") === "pending"));
  const ticket = filtered.length ? Math.round(total / filtered.length) : 0;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daySeries = Array.from({ length: daysInMonth }, (_, i) => ({ k: i + 1, v: 0 }));
  for (const r of filtered) { const d = new Date(r.created_at); if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) daySeries[d.getDate() - 1].v += amount(r); }
  const byUnit = {};
  for (const r of filtered) { const u = unitOf(r); const key = u ? u.code : (r.unit_code || "—"); byUnit[key] = (byUnit[key] || 0) + amount(r); }
  const unitBars = Object.entries(byUnit).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v).slice(0, 8);
  const unitMax = Math.max(1, ...unitBars.map((b) => b.v));
  const pix = sum(filtered.filter((r) => r.pay_method === "pix"));
  const card = sum(filtered.filter((r) => r.pay_method === "card"));
  return (
    <div>
      <div className="adm-unit-head">
        <div>
          <span className="t-overline" style={{ color: "var(--orange-400)" }}>Visão nacional</span>
          <h2 className="t-h2" style={{ color: "var(--cream-500)", margin: "4px 0 0" }}>Gestão financeira</h2>
        </div>
      </div>
      <div className="adm-kpis">
        <Kpi n={money(total)} l="Faturamento" accent />
        <Kpi n={money(received)} l="Recebido" tone="success" />
        <Kpi n={money(pending)} l="A receber" tone="orange" />
        <Kpi n={filtered.length} l="Pagamentos" />
        <Kpi n={money(ticket)} l="Ticket médio" />
      </div>
      <div className="adm-fin-grid">
        <div className="adm-msec">
          <h3 className="adm-msec-h">Faturamento por dia · {MONTHS[now.getMonth()]}/{String(now.getFullYear()).slice(2)}</h3>
          <BarChart data={daySeries} color="var(--royal-400)" money />
        </div>
        <div className="adm-msec">
          <h3 className="adm-msec-h">Por unidade</h3>
          {unitBars.length === 0 ? <div className="adm-muted">Sem dados.</div> : (
            <div className="adm-hbars">
              {unitBars.map((b) => (
                <div className="adm-hbar" key={b.k}>
                  <span className="adm-hbar-lbl">{b.k}</span>
                  <span className="adm-hbar-track"><span className="adm-hbar-fill" style={{ width: `${(b.v / unitMax) * 100}%` }} /></span>
                  <span className="adm-hbar-val tabular">{money(b.v)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="adm-fin-split">
            <div><span className="adm-fin-split-l">Pix</span><span className="adm-fin-split-v tabular">{money(pix)}</span></div>
            <div><span className="adm-fin-split-l">Cartão</span><span className="adm-fin-split-v tabular">{money(card)}</span></div>
          </div>
        </div>
      </div>
      <div className="adm-fin-filters">
        <select className="field" value={estado} onChange={(e) => { setEstado(e.target.value); setUnitId("all"); }}>
          <option value="all">Todos os estados</option>
          {states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="field" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
          <option value="all">Todas as unidades</option>
          {unitOptions.map((u) => <option key={u.id} value={u.id}>{u.code} · {u.name}</option>)}
        </select>
        <select className="field" value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="all">Todos os métodos</option><option value="pix">Pix</option><option value="card">Cartão</option>
        </select>
        <select className="field" value={pstatus} onChange={(e) => setPstatus(e.target.value)}>
          <option value="all">Qualquer pagamento</option><option value="pending">Pendente</option><option value="paid">Pago</option><option value="failed">Falhou</option><option value="refunded">Estornado</option>
        </select>
        <select className="field" value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="today">Hoje</option><option value="7d">7 dias</option><option value="month">Este mês</option><option value="all">Tudo</option>
        </select>
        <input className="field" value={q} placeholder="Buscar cliente ou código…" onChange={(e) => setQ(e.target.value)} />
      </div>
      {filtered.length === 0 ? (
        <div className="adm-empty sm"><p className="t-body" style={{ color: "var(--navy-200)" }}>Nenhum pagamento com esses filtros.</p></div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Data</th><th>Estado</th><th>Unidade</th><th>Cliente</th><th>Valor</th><th>Método</th><th>Pagamento</th><th>Código</th><th></th></tr></thead>
            <tbody>
              {filtered.map((r) => {
                const u = unitOf(r);
                const ps = r.payment_status || "pending";
                const pm = PAYMENT_META[ps] || { label: ps, cls: "" };
                const paid = ps === "paid";
                return (
                  <tr key={r.id}>
                    <td>{fmtDateTime(r.created_at)}</td>
                    <td>{u ? u.state : "—"}</td>
                    <td className="adm-td-strong">{u ? u.code : (r.unit_code || "—")}</td>
                    <td>{r.customer_name || "—"}</td>
                    <td className="tabular">{money(amount(r))}</td>
                    <td>{r.pay_method === "card" ? "Cartão" : r.pay_method === "pix" ? "Pix" : "—"}</td>
                    <td><span className={`adm-pay ${pm.cls}`}>{pm.label}</span></td>
                    <td className="adm-td-mono">{r.locker_code || "—"}</td>
                    <td><button className="adm-mini ghost" onClick={() => onSetPaid(r.id, paid ? "pending" : "paid")}>{paid ? "Marcar pendente" : "Marcar pago"}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="adm-metrics-note" style={{ marginTop: 16 }}>Pronto pro gateway: hoje o status de pagamento é manual (Pix recebido na chave). Ao conectar um PSP, o webhook preenche payment_status/paid_at automaticamente.</p>
    </div>
  );
}
function Kpi({ n, l, tone, accent }) {
  return <div className={`adm-kpi${accent ? " accent" : ""} adm-kpi-${tone || "base"}`}><div className="adm-kpi-n tabular">{n}</div><div className="adm-kpi-l">{l}</div></div>;
}

/* ---------- visão geral em tabela ---------- */
const STATUS_META = {
  reserved:  { label: "Agendado",  cls: "st-reserved" },
  active:    { label: "Ocupado",   cls: "st-active" },
  done:      { label: "Concluído", cls: "st-done" },
  cancelled: { label: "Cancelado", cls: "st-cancelled" },
};
function TableView({ reservations, lockers }) {
  const [f, setF] = useState("all");
  const lockerById = useMemo(() => Object.fromEntries(lockers.map((l) => [l.id, l])), [lockers]);
  const rows = useMemo(() => {
    const list = f === "all" ? reservations : reservations.filter((r) => r.status === f);
    return [...list].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [reservations, f]);
  const count = (st) => reservations.filter((r) => r.status === st).length;
  const filters = [
    ["all", `Todos · ${reservations.length}`],
    ["reserved", `Agendados · ${count("reserved")}`],
    ["active", `Ocupados · ${count("active")}`],
    ["done", `Concluídos · ${count("done")}`],
    ["cancelled", `Cancelados · ${count("cancelled")}`],
  ];
  return (
    <div>
      <div className="adm-filters">
        {filters.map(([k, lbl]) => <button key={k} className={`adm-chip${f === k ? " on" : ""}`} onClick={() => setF(k)}>{lbl}</button>)}
      </div>
      {rows.length === 0 ? (
        <div className="adm-empty sm"><p className="t-body" style={{ color: "var(--navy-200)" }}>Nada por aqui ainda.</p></div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Status</th><th>Cliente</th><th>Contato</th><th>Tam.</th><th>Locker</th><th>Entrada</th><th>Retirada</th><th>Total</th><th>Origem</th><th>Código</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const m = STATUS_META[r.status] || { label: r.status, cls: "" };
                const lk = r.locker_id && lockerById[r.locker_id];
                return (
                  <tr key={r.id}>
                    <td><span className={`adm-st ${m.cls}`}>{m.label}</span></td>
                    <td className="adm-td-strong">{r.customer_name || "—"}</td>
                    <td>{r.customer_phone || "—"}</td>
                    <td>{r.size || "—"}</td>
                    <td>{lk ? lk.label : "—"}</td>
                    <td>{fmtDateTime(r.check_in)}</td>
                    <td>{fmtDateTime(r.check_out)}</td>
                    <td className="tabular">{r.price_total != null ? `R$ ${r.price_total}` : "—"}</td>
                    <td>{r.source === "admin" ? "Manual" : "Site"}</td>
                    <td className="adm-td-mono">{r.locker_code || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ n, l, tone }) {
  return <div className={`adm-stat adm-stat-${tone || "base"}`}><div className="adm-stat-n tabular">{n}</div><div className="adm-stat-l">{l}</div></div>;
}

function LockerCard({ lk, res, onOccupy, onFree, onMaint, onDel }) {
  const occupied = lk.status === "occupied";
  const maint = lk.status === "maintenance";
  return (
    <div className={`adm-locker ${lk.status}`}>
      <div className="adm-locker-top">
        <span className="adm-locker-label">{lk.label}</span>
        <button className="adm-locker-del" title="Excluir locker" onClick={onDel}><Icon name="close" size={13} /></button>
      </div>
      <div className="adm-locker-status">{occupied ? "Ocupado" : maint ? "Manutenção" : "Livre"}</div>
      {occupied && res && (
        <div className="adm-locker-cust">
          <div className="adm-locker-name">{res.customer_name}</div>
          {res.customer_phone && <div className="adm-locker-sub">{res.customer_phone}</div>}
          {res.check_out && <div className="adm-locker-pickup"><Icon name="clock" size={12} color="var(--orange-400)" /> Retirar até {fmtDateTime(res.check_out)}</div>}
          <div className="adm-locker-sub mono">{res.locker_code}</div>
        </div>
      )}
      <div className="adm-locker-actions">
        {occupied ? <button className="adm-mini" onClick={onFree}>Liberar</button> : <button className="adm-mini primary" onClick={onOccupy}>Ocupar</button>}
        {!occupied && <button className="adm-mini ghost" onClick={() => onMaint(maint ? "free" : "maintenance")}>{maint ? "Reativar" : "Manutenção"}</button>}
      </div>
    </div>
  );
}

/* ============================ MODAIS ============================ */
function ModalShell({ title, children, onClose }) {
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="adm-modal-scrim" onClick={onClose}>
      <div className="adm-modal on-navy" onClick={(e) => e.stopPropagation()}>
        <div className="adm-modal-head">
          <h3 className="t-h4" style={{ color: "var(--cream-500)", margin: 0 }}>{title}</h3>
          <button className="adm-link" onClick={onClose}><Icon name="close" size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function UnitModal({ onClose, onDone }) {
  const [f, setF] = useState({ code: "", name: "", state: "PE", city: "", address: "", kind: "plane", P: "", G: "" });
  const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    if (!f.code.trim() || !f.name.trim() || !f.city.trim()) { setErr("Preencha código, nome e cidade."); return; }
    setBusy(true); setErr(null);
    const { data, error } = await addUnit(f);
    if (error) { setBusy(false); setErr(error.message); return; }
    if (f.P || f.G) await addLockersBulk(data.id, { P: f.P, G: f.G });
    setBusy(false); onDone();
  };
  return (
    <ModalShell title="Adicionar unidade" onClose={onClose}>
      <div className="adm-form">
        <div className="adm-form-row">
          <Fld label="Código"><input className="field" value={f.code} placeholder="REC" onChange={(e) => set("code", e.target.value.toUpperCase())} /></Fld>
          <Fld label="Tipo">
            <select className="field" value={f.kind} onChange={(e) => set("kind", e.target.value)}>
              <option value="plane">Aeroporto</option><option value="train">Rodo/Ferroviária</option><option value="other">Outro</option>
            </select>
          </Fld>
        </div>
        <Fld label="Nome"><input className="field" value={f.name} placeholder="Aeroporto de Recife" onChange={(e) => set("name", e.target.value)} /></Fld>
        <div className="adm-form-row">
          <Fld label="Estado (UF)"><select className="field" value={f.state} onChange={(e) => set("state", e.target.value)}>{UF.map((u) => <option key={u}>{u}</option>)}</select></Fld>
          <Fld label="Cidade"><input className="field" value={f.city} placeholder="Recife" onChange={(e) => set("city", e.target.value)} /></Fld>
        </div>
        <Fld label="Endereço (opcional)"><input className="field" value={f.address} onChange={(e) => set("address", e.target.value)} /></Fld>
        <div className="adm-form-sub">Lockers iniciais (opcional)</div>
        <div className="adm-form-row">
          <Fld label="Pequenos"><input className="field" type="number" min="0" value={f.P} placeholder="0" onChange={(e) => set("P", e.target.value)} /></Fld>
          <Fld label="Grandes"><input className="field" type="number" min="0" value={f.G} placeholder="0" onChange={(e) => set("G", e.target.value)} /></Fld>
        </div>
        {err && <div className="adm-err">{err}</div>}
        <Btn variant="primary" cta className="btn-block" onClick={save} disabled={busy}>{busy ? "Salvando…" : "Criar unidade"}</Btn>
      </div>
    </ModalShell>
  );
}

function LockersModal({ unit, onClose, onDone }) {
  const [c, setC] = useState({ P: "", G: "" });
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); await addLockersBulk(unit.id, c); setBusy(false); onDone(); };
  return (
    <ModalShell title={`Adicionar lockers · ${unit.code}`} onClose={onClose}>
      <div className="adm-form">
        <p className="t-body-sm" style={{ color: "var(--navy-200)", margin: 0 }}>Quantos lockers de cada tamanho? São numerados automaticamente (P-01, G-01…).</p>
        <div className="adm-form-row">
          <Fld label="Pequenos"><input className="field" type="number" min="0" value={c.P} placeholder="0" onChange={(e) => setC({ ...c, P: e.target.value })} /></Fld>
          <Fld label="Grandes"><input className="field" type="number" min="0" value={c.G} placeholder="0" onChange={(e) => setC({ ...c, G: e.target.value })} /></Fld>
        </div>
        <Btn variant="primary" cta className="btn-block" onClick={save} disabled={busy}>{busy ? "Criando…" : "Adicionar"}</Btn>
      </div>
    </ModalShell>
  );
}

function OccupyModal({ unit, locker, lockers, reservations, onClose, onDone }) {
  const freeLockers = (lockers || []).filter((l) => l.status === "free");
  const [lockerId, setLockerId] = useState(locker?.id || freeLockers[0]?.id || "");
  const lk = locker || freeLockers.find((l) => l.id === lockerId) || null;
  const size = lk?.size;
  const pendings = (reservations || []).filter((r) => r.status === "reserved" && (r.unit_code === unit.code || r.unit_ref === unit.id) && (!size || r.size === size));
  const canBooking = pendings.length > 0;
  const [mode, setMode] = useState("booking");
  const m = canBooking ? mode : "manual";
  const [bookingId, setBookingId] = useState("");
  const effBookingId = pendings.some((p) => p.id === bookingId) ? bookingId : (pendings[0]?.id || "");
  const [f, setF] = useState({ name: "", phone: "", cpf: "", email: "", checkout: "" });
  const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    if (!lk) { setErr("Selecione um locker livre."); return; }
    setBusy(true); setErr(null);
    let error;
    if (m === "booking") {
      const b = pendings.find((r) => r.id === effBookingId);
      if (!b) { setBusy(false); setErr("Selecione um agendamento."); return; }
      ({ error } = await checkInReservation(b, lk, f.checkout || b.check_out || null));
    } else {
      if (!f.name.trim()) { setBusy(false); setErr("Informe o nome do cliente."); return; }
      ({ error } = await occupyLocker(lk, { ...f, unitCode: unit.code, unitName: unit.name }));
    }
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onDone();
  };
  return (
    <ModalShell title={locker ? `Ocupar locker ${locker.label}` : "Ocupar locker"} onClose={onClose}>
      <div className="adm-form">
        {!locker && (
          <Fld label="Locker livre">
            <select className="field" value={lockerId} onChange={(e) => setLockerId(e.target.value)}>
              {freeLockers.length ? freeLockers.map((l) => <option key={l.id} value={l.id}>{l.label} · {SIZE_NAME[l.size]}</option>) : <option value="">Nenhum locker livre</option>}
            </select>
          </Fld>
        )}
        {lk && (
          <>
            <div className="adm-seg">
              <button className={`adm-seg-btn${m === "booking" ? " on" : ""}`} disabled={!canBooking} onClick={() => setMode("booking")}>De um agendamento{canBooking ? ` · ${pendings.length}` : ""}</button>
              <button className={`adm-seg-btn${m === "manual" ? " on" : ""}`} onClick={() => setMode("manual")}>Cadastro manual</button>
            </div>
            {m === "booking" ? (
              <>
                <p className="t-body-sm" style={{ color: "var(--navy-200)", margin: 0 }}>Confirme a entrega da mala de um agendamento ({SIZE_NAME[lk.size]}).</p>
                <Fld label="Agendamento">
                  <select className="field" value={effBookingId} onChange={(e) => setBookingId(e.target.value)}>
                    {pendings.map((b) => <option key={b.id} value={b.id}>{b.customer_name} — {b.customer_phone || "sem telefone"} · entrada {fmtDateTime(b.check_in)}</option>)}
                  </select>
                </Fld>
                <Fld label="Retirar até (opcional)"><input className="field" type="date" value={f.checkout} onChange={(e) => set("checkout", e.target.value)} /></Fld>
              </>
            ) : (
              <>
                <p className="t-body-sm" style={{ color: "var(--navy-200)", margin: 0 }}>Adição manual — vincula o locker {lk.label} ({SIZE_NAME[lk.size]}) ao registro do cliente.</p>
                <Fld label="Nome do cliente"><input className="field" value={f.name} placeholder="Maria Silva" onChange={(e) => set("name", e.target.value)} /></Fld>
                <div className="adm-form-row">
                  <Fld label="Celular"><input className="field" value={f.phone} placeholder="(81) 90000-0000" onChange={(e) => set("phone", e.target.value)} /></Fld>
                  <Fld label="CPF"><input className="field" value={f.cpf} placeholder="000.000.000-00" onChange={(e) => set("cpf", e.target.value)} /></Fld>
                </div>
                <div className="adm-form-row">
                  <Fld label="E-mail (opcional)"><input className="field" value={f.email} placeholder="cliente@email.com" onChange={(e) => set("email", e.target.value)} /></Fld>
                  <Fld label="Retirar até (opcional)"><input className="field" type="date" value={f.checkout} onChange={(e) => set("checkout", e.target.value)} /></Fld>
                </div>
              </>
            )}
          </>
        )}
        {err && <div className="adm-err">{err}</div>}
        <Btn variant="primary" cta className="btn-block" onClick={save} disabled={busy || !lk}>{busy ? "Salvando…" : m === "booking" ? "Confirmar entrega da mala" : "Confirmar ocupação"}</Btn>
      </div>
    </ModalShell>
  );
}

function PickupModal({ unit, lockers, resById, onClose, onDone }) {
  const occupied = (lockers || []).filter((l) => l.status === "occupied");
  const [lockerId, setLockerId] = useState(occupied[0]?.id || "");
  const lk = occupied.find((l) => l.id === lockerId);
  const res = lk ? resById[lk.current_reservation_id] : null;
  const [busy, setBusy] = useState(false);
  const save = async () => { if (!lk) return; setBusy(true); await freeLocker(lk); setBusy(false); onDone(); };
  return (
    <ModalShell title="Retirar bagagem" onClose={onClose}>
      <div className="adm-form">
        {occupied.length === 0 ? (
          <p className="t-body-sm" style={{ color: "var(--navy-200)", margin: 0 }}>Nenhum locker ocupado nesta unidade.</p>
        ) : (
          <>
            <p className="t-body-sm" style={{ color: "var(--navy-200)", margin: 0 }}>Cliente buscou a bagagem? Conclua o fluxo e libere a vaga.</p>
            <Fld label="Locker ocupado">
              <select className="field" value={lockerId} onChange={(e) => setLockerId(e.target.value)}>
                {occupied.map((l) => { const r = resById[l.current_reservation_id]; return <option key={l.id} value={l.id}>{l.label} — {r ? r.customer_name : "—"}</option>; })}
              </select>
            </Fld>
            {res && (
              <div className="adm-pickup-info">
                <div className="adm-booking-name">{res.customer_name}</div>
                <div className="t-body-sm" style={{ color: "var(--navy-300)" }}>{res.customer_phone || "—"} · {res.locker_code}</div>
                {res.check_out && <div className="t-body-sm" style={{ color: "var(--orange-300)" }}>Retirada prevista: {fmtDateTime(res.check_out)}</div>}
              </div>
            )}
            <Btn variant="primary" cta className="btn-block" onClick={save} disabled={busy || !lk}>{busy ? "Concluindo…" : "Confirmar retirada e liberar"}</Btn>
          </>
        )}
      </div>
    </ModalShell>
  );
}

function CheckInModal({ unit, reservation, lockers, onClose, onDone }) {
  const free = (lockers || []).filter((l) => l.status === "free" && l.size === reservation.size);
  const [lockerId, setLockerId] = useState(free[0]?.id || "");
  const [checkout, setCheckout] = useState(reservation.check_out ? String(reservation.check_out).slice(0, 10) : "");
  const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  const save = async () => {
    const lk = free.find((l) => l.id === lockerId);
    if (!lk) { setErr("Selecione um locker livre."); return; }
    setBusy(true); setErr(null);
    const { error } = await checkInReservation(reservation, lk, checkout || null);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onDone();
  };
  return (
    <ModalShell title={`Entrada de mala · ${reservation.customer_name}`} onClose={onClose}>
      <div className="adm-form">
        <p className="t-body-sm" style={{ color: "var(--navy-200)", margin: 0 }}>Cliente entregou a mala. Vincule o agendamento ({SIZE_NAME[reservation.size]}) a um locker livre.</p>
        <Fld label="Locker livre">
          <select className="field" value={lockerId} onChange={(e) => setLockerId(e.target.value)}>
            {free.length ? free.map((l) => <option key={l.id} value={l.id}>{l.label}</option>) : <option value="">Sem locker livre desse tamanho</option>}
          </select>
        </Fld>
        <Fld label="Retirar até"><input className="field" type="date" value={checkout} onChange={(e) => setCheckout(e.target.value)} /></Fld>
        {err && <div className="adm-err">{err}</div>}
        <Btn variant="primary" cta className="btn-block" onClick={save} disabled={busy || !free.length}>{busy ? "Salvando…" : "Confirmar entrada"}</Btn>
      </div>
    </ModalShell>
  );
}

function UnitMenu({ onAddLockers, onDelUnit }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const h = () => setOpen(false);
    window.addEventListener("click", h);
    return () => window.removeEventListener("click", h);
  }, [open]);
  return (
    <div className="adm-menu" onClick={(e) => e.stopPropagation()}>
      <button className="adm-menu-btn" aria-label="Mais ações" onClick={() => setOpen((o) => !o)}>⋯</button>
      {open && (
        <div className="adm-menu-pop">
          <button onClick={() => { setOpen(false); onAddLockers(); }}><Icon name="plus" size={15} /> Adicionar lockers</button>
          <button className="danger" onClick={() => { setOpen(false); onDelUnit(); }}><Icon name="close" size={15} /> Excluir unidade</button>
        </div>
      )}
    </div>
  );
}

/* ---------- helpers ---------- */
function fmtDateTime(v) {
  if (!v) return "—";
  const str = String(v);
  const hasTime = str.includes("T") || str.includes(":");
  const d = new Date(hasTime ? str : str + "T12:00");
  if (isNaN(d)) return str;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  if (!hasTime) return `${dd}/${mm}`;
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${mi}`;
}
function Fld({ label, children }) {
  return <label className="wf-field"><span className="wf-field-lbl">{label}</span>{children}</label>;
}
function Splash({ children }) {
  return <div className="adm-splash on-navy"><MalexLogo height={26} /><span>{children}</span></div>;
}
function ConfigMissing() {
  return (
    <div className="adm-splash on-navy" style={{ flexDirection: "column", gap: 12, textAlign: "center", padding: 24 }}>
      <MalexLogo height={26} />
      <p className="t-body" style={{ color: "var(--navy-200)", maxWidth: 420 }}>Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY e crie a conta do gestor.</p>
    </div>
  );
}
