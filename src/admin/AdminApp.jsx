// Malex — Painel administrativo (login único + gestão de unidades/lockers/financeiro).
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { MalexLogo, Icon, Btn, MALEX_PRICING } from "../components/Primitives.jsx";
import {
  supabaseEnabled, getSession, onAuth, signIn, signOut, getMyRole,
  listUnits, addUnit, deleteUnit,
  listLockers, addLockersBulk, addLocker, deleteLocker,
  occupyLocker, freeLocker, setLockerStatus,
  listReservations, checkInReservation, cancelReservation, setPaymentStatus,
  addReservationCharge, listAuditLogs,
} from "../lib/admin.js";
import { supabase } from "../lib/supabase.js";
import { BLOG_CATEGORIES, slugify, calcReadTime, adminListPosts, adminGetPost, adminSavePost, adminDeletePost, uploadCoverImage } from "../lib/blog.js";

/* ============================ CONSTANTS ============================ */
const UF = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const SIZE_NAME = { P: "Pequeno", M: "Médio", G: "Grande" };
const MONTHS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

/* ============================ HELPERS ============================ */
function isOverstay(lk, res) {
  return lk.status === "occupied" && res?.check_out && new Date(res.check_out) < new Date();
}

// Exporta CSV com separador ";" (padrão Excel pt-BR), aspas escapadas.
function downloadCSV(rows, columns, filename) {
  const SEP = ";";
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = columns.map((c) => cell(c.label)).join(SEP);
  const body = rows.map((r) => columns.map((c) => cell(r[c.key])).join(SEP));
  const csv = [header, ...body].join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

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

/* ============================ TOAST SYSTEM ============================ */
let _toastId = 0;
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((msg, type = "info") => {
    const id = ++_toastId;
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);
  const dismiss = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);
  return { toasts, show, dismiss };
}

function ToastArea({ toasts, dismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="adm-toast-area">
      {toasts.map((t) => (
        <div key={t.id} className={`adm-toast adm-toast-${t.type}`} onClick={() => dismiss(t.id)}>
          <span>{t.msg}</span>
          <button className="adm-toast-close" onClick={(e) => { e.stopPropagation(); dismiss(t.id); }}>×</button>
        </div>
      ))}
    </div>
  );
}

/* ============================ CONFIRM SYSTEM ============================ */
function useConfirm() {
  const [state, setState] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback((msg, title = "Confirmar") => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ msg, title });
    });
  }, []);

  const handle = (result) => {
    setState(null);
    resolveRef.current?.(result);
    resolveRef.current = null;
  };

  const ConfirmUI = state ? (
    <div className="adm-modal-scrim" onClick={() => handle(false)}>
      <div className="adm-modal on-navy" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className="adm-modal-head">
          <h3 className="t-h4" style={{ color: "var(--cream-500)", margin: 0 }}>{state.title}</h3>
        </div>
        <div style={{ padding: "16px 20px 20px" }}>
          <p className="t-body" style={{ color: "var(--navy-200)", margin: "0 0 20px" }}>{state.msg}</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => handle(false)}>Cancelar</Btn>
            <Btn variant="primary" onClick={() => handle(true)}>Confirmar</Btn>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, ConfirmUI };
}

/* ============================ SKELETON ============================ */
function SkeletonList({ rows = 4 }) {
  return (
    <div className="adm-skeleton-list">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton adm-skeleton-row" style={{ animationDelay: `${i * 0.1}s` }} />
      ))}
    </div>
  );
}

/* ============================ PAGINATION ============================ */
function usePagination(items, perPage = 25) {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [items]);
  const total = Math.max(1, Math.ceil(items.length / perPage));
  const slice = items.slice((page - 1) * perPage, page * perPage);
  return { page, total, setPage, slice, count: items.length };
}

function Paginator({ page, total, setPage, count, perPage = 25 }) {
  if (total <= 1) return null;
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, count);
  return (
    <div className="adm-paginator">
      <span className="adm-pag-info">{from}–{to} de {count}</span>
      <button className="adm-pag-btn" disabled={page === 1} onClick={() => setPage(1)}>«</button>
      <button className="adm-pag-btn" disabled={page === 1} onClick={() => setPage(page - 1)}>‹</button>
      {Array.from({ length: Math.min(5, total) }, (_, i) => {
        const p = Math.max(1, Math.min(total - 4, page - 2)) + i;
        return (
          <button key={p} className={`adm-pag-btn${p === page ? " on" : ""}`} onClick={() => setPage(p)}>{p}</button>
        );
      })}
      <button className="adm-pag-btn" disabled={page === total} onClick={() => setPage(page + 1)}>›</button>
      <button className="adm-pag-btn" disabled={page === total} onClick={() => setPage(total)}>»</button>
    </div>
  );
}

/* ============================ MAIN APP ============================ */
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
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState(null);
  const [forgotErr, setForgotErr] = useState(null);
  const [forgotBusy, setForgotBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    const { error } = await signIn(email.trim(), pass);
    setBusy(false);
    if (error) setErr(error.message || "Não foi possível entrar.");
  };

  const sendReset = async (e) => {
    e.preventDefault();
    setForgotErr(null); setForgotMsg(null); setForgotBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: window.location.origin + "/admin",
      });
      if (error) setForgotErr(error.message || "Erro ao enviar link.");
      else setForgotMsg("Link enviado! Verifique seu e-mail.");
    } catch (ex) {
      setForgotErr("Erro ao enviar link.");
    }
    setForgotBusy(false);
  };

  return (
    <div className="adm-login on-navy">
      <form className="adm-login-card" onSubmit={forgotMode ? sendReset : submit}>
        <MalexLogo height={28} />
        <h1 className="t-h3" style={{ color: "var(--cream-500)", margin: "18px 0 4px" }}>
          {forgotMode ? "Recuperar senha" : "Painel do gestor"}
        </h1>
        <p className="t-body-sm" style={{ color: "var(--navy-200)", margin: "0 0 22px" }}>
          {forgotMode ? "Informe seu e-mail para receber o link." : "Acesso restrito. Entre com seu e-mail e senha."}
        </p>

        {forgotMode ? (
          <>
            <label className="wf-field"><span className="wf-field-lbl">E-mail</span>
              <input className="field" type="email" autoComplete="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="gestor@malexpernambuco.com.br" />
            </label>
            {forgotErr && <div className="adm-err" style={{ marginTop: 14 }}>{forgotErr}</div>}
            {forgotMsg && <div style={{ marginTop: 14, color: "var(--green-400)", fontSize: 14 }}>{forgotMsg}</div>}
            <Btn type="submit" variant="primary" cta className="btn-block" style={{ marginTop: 20 }} disabled={forgotBusy}>{forgotBusy ? "Enviando…" : "Enviar link"}</Btn>
            <button type="button" className="adm-link" style={{ marginTop: 12, fontSize: 13 }} onClick={() => setForgotMode(false)}>← Voltar ao login</button>
          </>
        ) : (
          <>
            <label className="wf-field"><span className="wf-field-lbl">E-mail</span>
              <input className="field" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="gestor@malexpernambuco.com.br" />
            </label>
            <label className="wf-field" style={{ marginTop: 14 }}><span className="wf-field-lbl">Senha</span>
              <input className="field" type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" />
            </label>
            <button type="button" className="adm-link" style={{ fontSize: 12, marginTop: 8, textAlign: "right", display: "block" }} onClick={() => setForgotMode(true)}>Esqueceu a senha?</button>
            {err && <div className="adm-err" style={{ marginTop: 14 }}>{err}</div>}
            <Btn type="submit" variant="primary" cta className="btn-block" style={{ marginTop: 20 }} disabled={busy}>{busy ? "Entrando…" : "Entrar"}</Btn>
          </>
        )}
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
  const { toasts, show: showToast, dismiss } = useToasts();
  const { confirm, ConfirmUI } = useConfirm();

  const [role, setRole] = useState(null);
  const [unitCodeFilter, setUnitCodeFilter] = useState(null);
  useEffect(() => {
    let alive = true;
    getMyRole().then((r) => { if (alive) { setRole(r.role); setUnitCodeFilter(r.unitCode); } });
    return () => { alive = false; };
  }, [session]);

  const reload = useCallback(async () => {
    setLoading(true);
    const [u, l, r] = await Promise.all([listUnits(), listLockers(), listReservations()]);
    setUnits(u.data); setLockers(l.data); setReservations(r.data);
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  // Auto-select unit for unit_manager role
  useEffect(() => {
    if (role === "unit_manager" && unitCodeFilter && units.length && !selUnit) {
      const found = units.find((u) => u.code === unitCodeFilter);
      if (found) setSelUnit(found);
    }
  }, [role, unitCodeFilter, units, selUnit]);

  const resById = useMemo(() => Object.fromEntries(reservations.map((r) => [r.id, r])), [reservations]);
  const tree = useMemo(() => {
    const t = {};
    for (const u of units) { (t[u.state] ||= {}); (t[u.state][u.city] ||= []).push(u); }
    return t;
  }, [units]);
  const unitLockers = useMemo(() => (selUnit ? lockers.filter((l) => l.unit_id === selUnit.id) : []), [lockers, selUnit]);

  const close = () => setModal(null);
  const afterChange = async (msg) => { close(); if (msg) showToast(msg, "success"); await reload(); };

  if (!role) return <Splash>Carregando painel…</Splash>;

  return (
    <div className="adm on-navy">
      <header className="adm-top">
        <div className="adm-top-l">
          <MalexLogo height={22} />
          <span className="adm-badge">Gestor</span>
          {role === "unit_manager" && unitCodeFilter && (
            <span className="adm-badge" style={{ background: "var(--royal-600)", marginLeft: 4 }}>Sua unidade: {unitCodeFilter}</span>
          )}
        </div>
        <nav className="adm-nav">
          <button className={view === "units" ? "on" : ""} onClick={() => setView("units")}>Unidades</button>
          {role !== "unit_manager" && (
            <button className={view === "national" ? "on" : ""} onClick={() => setView("national")}>Nacional</button>
          )}
          {role !== "unit_manager" && (
            <button className={view === "finance" ? "on" : ""} onClick={() => setView("finance")}>Financeiro</button>
          )}
          <button className={view === "marketing" ? "on" : ""} onClick={() => setView("marketing")}>Marketing</button>
          <button className={view === "table" ? "on" : ""} onClick={() => setView("table")}>Reservas</button>
          {role !== "unit_manager" && (
            <button className={view === "blog" ? "on" : ""} onClick={() => setView("blog")}>Blog</button>
          )}
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
              {role !== "unit_manager" && (
                <button className="adm-add-sm" title="Adicionar unidade" onClick={() => setModal({ type: "unit" })}><Icon name="plus" size={16} /></button>
              )}
            </div>
            {loading ? <SkeletonList rows={4} /> :
              Object.keys(tree).length === 0 ? <div className="adm-muted">Nenhuma unidade. Clique em + pra adicionar.</div> :
              Object.keys(tree).sort().map((st) => (
                <StateGroup key={st} state={st} cities={tree[st]} lockers={lockers} resById={resById} selUnit={selUnit} onSelect={setSelUnit} />
              ))}
          </aside>

          <main className="adm-main">
            {!selUnit ? (
              <div className="adm-empty">
                <Icon name="map" size={40} color="var(--navy-400)" />
                <p className="t-body" style={{ color: "var(--navy-200)" }}>Selecione uma unidade na lista pra ver o painel, lockers e agendamentos.</p>
              </div>
            ) : (
              <UnitView
                unit={selUnit} lockers={unitLockers} reservations={reservations} resById={resById}
                role={role}
                onAddLockers={() => setModal({ type: "lockers", unit: selUnit })}
                onOccupy={(lk) => setModal({ type: "occupy", unit: selUnit, locker: lk, lockers: unitLockers, reservations })}
                onOccupyTop={() => setModal({ type: "occupy", unit: selUnit, locker: null, lockers: unitLockers, reservations })}
                onPickupTop={() => setModal({ type: "pickup", unit: selUnit, lockers: unitLockers })}
                onFree={async (lk) => { await freeLocker(lk, selUnit.code); showToast(`Locker ${lk.label} liberado.`, "success"); await reload(); }}
                onMaint={async (lk, st) => { await setLockerStatus(lk, st, selUnit.code); await reload(); }}
                onCheckIn={(b) => setModal({ type: "checkin", unit: selUnit, reservation: b, lockers: unitLockers })}
                onCancelBooking={async (b) => {
                  const ok = await confirm(`Cancelar o agendamento de ${b.customer_name}?`, "Cancelar agendamento");
                  if (ok) { await cancelReservation(b.id, selUnit.code); showToast("Agendamento cancelado.", "info"); await reload(); }
                }}
                onMarkPaid={async (b) => {
                  await setPaymentStatus(b.id, "paid");
                  showToast(`Pagamento de ${b.customer_name} confirmado.`, "success");
                  await reload();
                }}
                onDelLocker={async (lk) => {
                  const ok = await confirm(`Excluir locker ${lk.label}?`, "Excluir locker");
                  if (ok) { await deleteLocker(lk.id); showToast(`Locker ${lk.label} excluído.`, "info"); await reload(); }
                }}
                onDelUnit={async () => {
                  const ok = await confirm(`Excluir a unidade ${selUnit.name} e todos os seus lockers?`, "Excluir unidade");
                  if (ok) { await deleteUnit(selUnit.id); setSelUnit(null); showToast("Unidade excluída.", "info"); await reload(); }
                }}
              />
            )}
          </main>
        </div>
      )}

      {view === "national" && role !== "unit_manager" && (
        <div className="adm-finance">
          <NationalView units={units} lockers={lockers} reservations={reservations} loading={loading} />
        </div>
      )}

      {view === "finance" && role !== "unit_manager" && (
        <div className="adm-finance">
          <FinanceView reservations={reservations} units={units} loading={loading}
            onSetPaid={async (id, st) => { await setPaymentStatus(id, st); showToast(st === "paid" ? "Marcado como pago." : "Marcado como pendente.", "success"); await reload(); }} />
        </div>
      )}

      {view === "marketing" && (
        <div className="adm-finance">
          <MarketingView reservations={reservations} units={units} />
        </div>
      )}

      {view === "table" && (
        <div className="adm-finance">
          <TableView reservations={reservations} lockers={lockers} />
        </div>
      )}

      {view === "blog" && role !== "unit_manager" && (
        <div className="adm-finance">
          <BlogCmsView />
        </div>
      )}

      {modal?.type === "unit" && <UnitModal onClose={close} onDone={() => afterChange("Unidade criada com sucesso!")} />}
      {modal?.type === "lockers" && <LockersModal unit={modal.unit} onClose={close} onDone={() => afterChange("Lockers adicionados!")} />}
      {modal?.type === "occupy" && <OccupyModal unit={modal.unit} locker={modal.locker} lockers={modal.lockers} reservations={modal.reservations} onClose={close} onDone={() => afterChange("Locker ocupado com sucesso!")} />}
      {modal?.type === "pickup" && <PickupModal unit={modal.unit} lockers={modal.lockers} resById={resById} onClose={close} onDone={() => afterChange("Bagagem retirada. Locker liberado!")} />}
      {modal?.type === "checkin" && <CheckInModal unit={modal.unit} reservation={modal.reservation} lockers={modal.lockers} onClose={close} onDone={() => afterChange("Check-in realizado!")} />}

      {ConfirmUI}
      <ToastArea toasts={toasts} dismiss={dismiss} />
    </div>
  );
}

/* ============================ STATE GROUP ============================ */
function StateGroup({ state, cities, lockers, resById, selUnit, onSelect }) {
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
            const overstayCount = lk.filter((l) => isOverstay(l, resById[l.current_reservation_id])).length;
            return (
              <button key={u.id} className={`adm-unit${selUnit?.id === u.id ? " on" : ""}`} onClick={() => onSelect(u)}>
                <span className="adm-unit-code">{u.code}</span>
                <span className="adm-unit-name">{u.name}</span>
                <span className="adm-unit-occ">{lk.length ? `${occ}/${lk.length}` : "—"}</span>
                {overstayCount > 0 && <span className="adm-overstay-badge">{overstayCount}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ============================ UNIT VIEW ============================ */
function UnitView({ unit, lockers, reservations, resById, onAddLockers, onOccupy, onFree, onMaint, onDelLocker, onDelUnit, onCheckIn, onCancelBooking, onMarkPaid, onOccupyTop, onPickupTop, role }) {
  const [tab, setTab] = useState("metrics");
  const occ = lockers.filter((l) => l.status === "occupied").length;
  const free = lockers.filter((l) => l.status === "free").length;
  const bySize = (sz) => lockers.filter((l) => l.size === sz);
  const unitRes = reservations.filter((r) => r.unit_code === unit.code || r.unit_ref === unit.id);
  const bookings = unitRes.filter((r) => r.status === "reserved");
  const overstayCount = lockers.filter((l) => isOverstay(l, resById[l.current_reservation_id])).length;

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
          <UnitMenu onAddLockers={onAddLockers} onDelUnit={role !== "unit_manager" ? onDelUnit : null} />
        </div>
      </div>

      <div className="adm-stats">
        <Stat n={lockers.length} l="lockers" />
        <Stat n={occ} l="ocupados" tone="orange" />
        <Stat n={free} l="livres" tone="success" />
        <Stat n={bookings.length} l="agendamentos" tone="muted" />
        <Stat n={overstayCount} l="Atrasados" tone="danger" />
      </div>

      <div className="adm-tabs">
        <button className={`adm-tab${tab === "metrics" ? " on" : ""}`} onClick={() => setTab("metrics")}>Painel</button>
        <button className={`adm-tab${tab === "lockers" ? " on" : ""}`} onClick={() => setTab("lockers")}>Ocupação</button>
        <button className={`adm-tab${tab === "bookings" ? " on" : ""}`} onClick={() => setTab("bookings")}>Agendamentos{bookings.length ? ` · ${bookings.length}` : ""}</button>
        <button className={`adm-tab${tab === "table" ? " on" : ""}`} onClick={() => setTab("table")}>Visão geral</button>
        <button className={`adm-tab${tab === "audit" ? " on" : ""}`} onClick={() => setTab("audit")}>Histórico</button>
      </div>

      {tab === "metrics" && <MetricsView reservations={unitRes} />}

      {tab === "lockers" && (
        lockers.length === 0 ? (
          <div className="adm-empty sm"><p className="t-body" style={{ color: "var(--navy-200)" }}>Sem lockers nesta unidade. Clique em "Adicionar lockers" no menu ⋯.</p></div>
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

      {tab === "bookings" && <BookingsList unit={unit} bookings={bookings} lockers={lockers} onCheckIn={onCheckIn} onCancel={onCancelBooking} onMarkPaid={onMarkPaid} />}

      {tab === "table" && <TableView reservations={unitRes} lockers={lockers} />}

      {tab === "audit" && <AuditView unitCode={unit.code} />}
    </div>
  );
}

/* ============================ BOOKINGS LIST ============================ */
function BookingsList({ unit, bookings, lockers, onCheckIn, onCancel, onMarkPaid }) {
  if (!bookings.length) return (
    <div className="adm-empty sm"><Icon name="calendar-check" size={32} color="var(--navy-400)" /><p className="t-body" style={{ color: "var(--navy-200)" }}>Nenhum agendamento pendente nesta unidade.</p></div>
  );
  return (
    <div className="adm-bookings">
      {bookings.map((b) => {
        const freeForSize = lockers.filter((l) => l.status === "free" && l.size === b.size).length;
        const paid = b.payment_status === "paid";
        const canCheckIn = freeForSize > 0 && paid;
        let checkInTitle = "";
        if (!paid) checkInTitle = "Confirme o pagamento antes de liberar a entrega da mala";
        else if (!freeForSize) checkInTitle = `Sem locker livre desse tamanho`;
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
              {!paid && <span className="adm-pay-warn">⚠ Aguardando pagamento</span>}
            </div>
            <div className="adm-booking-actions">
              <button
                className="adm-mini primary"
                disabled={!canCheckIn}
                title={checkInTitle}
                onClick={() => onCheckIn(b)}
              >
                {!paid ? "Aguardando pagamento" : !freeForSize ? `Sem vaga ${b.size}` : "Cliente entregou a mala"}
              </button>
              {!paid && <button className="adm-mini ghost" onClick={() => onMarkPaid(b)}>Marcar como pago</button>}
              <button className="adm-mini ghost" onClick={() => onCancel(b)}>Cancelar</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ============================ METRICS VIEW ============================ */
function MetricsView({ reservations }) {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startWeek = (() => { const d = new Date(startToday); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return d; })();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  // Previous month bounds
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const resDate = (r) => r.created_at;
  const doneDate = (r) => r.closed_at || r.check_out || r.created_at;
  const paidDate = (r) => r.paid_at || r.created_at;
  const notCancelled = reservations.filter((r) => r.status !== "cancelled");
  const done = reservations.filter((r) => r.status === "done");
  const paid = reservations.filter((r) => r.payment_status === "paid");
  const countSince = (list, gd, start) => list.reduce((a, r) => (new Date(gd(r)) >= start ? a + 1 : a), 0);
  const sumSince = (list, gd, start, val) => list.reduce((a, r) => (new Date(gd(r)) >= start ? a + (val(r) || 0) : a), 0);
  const countBetween = (list, gd, start, end) => list.reduce((a, r) => { const d = new Date(gd(r)); return d >= start && d <= end ? a + 1 : a; }, 0);
  const sumBetween = (list, gd, start, end, val) => list.reduce((a, r) => { const d = new Date(gd(r)); return d >= start && d <= end ? a + (val(r) || 0) : a; }, 0);
  const monthSeries = (list, gd, val) => {
    const arr = Array.from({ length: daysInMonth }, (_, i) => ({ k: i + 1, v: 0 }));
    for (const r of list) { const d = new Date(gd(r)); if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) arr[d.getDate() - 1].v += val ? val(r) : 1; }
    return arr;
  };
  const price = (r) => r.price_total || 0;
  const monthLbl = `${MONTHS[now.getMonth()]}/${String(now.getFullYear()).slice(2)}`;

  // Day in month so far for fair comparison
  const dayOfMonth = now.getDate();
  const prevSamePeriodEnd = new Date(now.getFullYear(), now.getMonth() - 1, dayOfMonth, 23, 59, 59);

  const pctChange = (curr, prev) => {
    if (prev === 0 && curr === 0) return null;
    if (prev === 0) return null;
    const p = Math.round(((curr - prev) / prev) * 100);
    return p;
  };

  const blocks = [
    {
      title: "Reservas", color: "var(--orange-500)",
      d: countSince(notCancelled, resDate, startToday),
      w: countSince(notCancelled, resDate, startWeek),
      m: countSince(notCancelled, resDate, startMonth),
      mPrev: countBetween(notCancelled, resDate, prevMonthStart, prevSamePeriodEnd),
      series: monthSeries(notCancelled, resDate),
    },
    {
      title: "Fluxos concluídos", color: "#4ADE80",
      d: countSince(done, doneDate, startToday),
      w: countSince(done, doneDate, startWeek),
      m: countSince(done, doneDate, startMonth),
      mPrev: countBetween(done, doneDate, prevMonthStart, prevSamePeriodEnd),
      series: monthSeries(done, doneDate),
    },
    {
      title: "Faturamento", color: "var(--royal-400)", money: true,
      d: sumSince(notCancelled, resDate, startToday, price),
      w: sumSince(notCancelled, resDate, startWeek, price),
      m: sumSince(notCancelled, resDate, startMonth, price),
      mPrev: sumBetween(notCancelled, resDate, prevMonthStart, prevSamePeriodEnd, price),
      series: monthSeries(notCancelled, resDate, price),
    },
    {
      title: "Recebido", color: "#4ADE80", money: true,
      d: sumSince(paid, paidDate, startToday, price),
      w: sumSince(paid, paidDate, startWeek, price),
      m: sumSince(paid, paidDate, startMonth, price),
      mPrev: sumBetween(paid, paidDate, prevMonthStart, prevSamePeriodEnd, price),
      series: monthSeries(paid, paidDate, price),
    },
  ];
  const fmt = (v, money) => (money ? `R$ ${Number(v).toLocaleString("pt-BR")}` : v);
  return (
    <div className="adm-metrics">
      {blocks.map((b) => {
        const chg = pctChange(b.m, b.mPrev);
        return (
          <section className="adm-msec" key={b.title}>
            <h3 className="adm-msec-h">{b.title}</h3>
            <div className="adm-mcards">
              <MCard n={fmt(b.d, b.money)} l="hoje" />
              <MCard n={fmt(b.w, b.money)} l="esta semana" />
              <MCard n={fmt(b.m, b.money)} l="este mês" accent
                badge={chg !== null ? (
                  <span className={`adm-chg-badge ${chg >= 0 ? "up" : "down"}`}>
                    {chg >= 0 ? "▲" : "▼"} {Math.abs(chg)}%
                  </span>
                ) : null}
              />
            </div>
            <div className="adm-chart-cap">Por dia · {monthLbl}</div>
            <BarChart data={b.series} color={b.color} money={b.money} />
          </section>
        );
      })}
      <p className="adm-metrics-note">Reservas e faturamento contam pela data da compra (inclui as do site, vinculadas a esta unidade); cancelados são excluídos. Concluídos contam pela data de liberação. Recebido conta só o que está pago, pela data de confirmação do pagamento.</p>
    </div>
  );
}

function MCard({ n, l, accent, badge }) {
  return (
    <div className={`adm-mcard${accent ? " accent" : ""}`}>
      <div className="adm-mcard-n tabular">{n}{badge && <>{" "}{badge}</>}</div>
      <div className="adm-mcard-l">{l}</div>
    </div>
  );
}

function BarChart({ data, color = "var(--orange-500)", money }) {
  const max = Math.max(1, ...data.map((d) => d.v));
  const today = new Date().getDate();
  const maxLabel = money ? `R$ ${Number(max).toLocaleString("pt-BR")}` : String(max);
  const fmt = (v) => money ? `R$ ${Number(v).toLocaleString("pt-BR")}` : String(v);
  return (
    <div className="adm-chart-wrap" style={{ position: "relative" }}>
      <span className="adm-chart-max-lbl">{maxLabel}</span>
      <div className="adm-chart">
        {data.map((d) => (
          <div className="adm-bar-col" key={d.k}>
            <div className="adm-bar" style={{ height: `${(d.v / max) * 100}%`, background: color, opacity: d.k === today ? 1 : 0.78 }} />
            <div className="adm-bar-tt">Dia {d.k}<br />{fmt(d.v)}</div>
            {(d.k === 1 || d.k % 5 === 0) && <span className="adm-bar-lbl">{d.k}</span>}
          </div>
        ))}
      </div>
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

const FINANCE_COLS = [
  { key: "id", label: "ID" },
  { key: "_date", label: "Data" },
  { key: "_state", label: "Estado" },
  { key: "_unit", label: "Unidade" },
  { key: "customer_name", label: "Cliente" },
  { key: "price_total", label: "Valor" },
  { key: "pay_method", label: "Método" },
  { key: "payment_status", label: "Pagamento" },
  { key: "locker_code", label: "Código" },
];

function FinanceView({ reservations, units, onSetPaid, loading }) {
  if (loading) return <div style={{ padding: 32 }}><SkeletonList rows={8} /></div>;
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

  const { page, total: totalPages, setPage, slice: pageRows, count } = usePagination(filtered, 25);

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

  const handleExport = () => {
    const rows = filtered.map((r) => {
      const u = unitOf(r);
      return {
        ...r,
        _date: fmtDateTime(r.created_at),
        _state: u ? u.state : (r.unit_code || "—"),
        _unit: u ? u.code : (r.unit_code || "—"),
      };
    });
    downloadCSV(rows, FINANCE_COLS, `financeiro-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div>
      <div className="adm-unit-head">
        <div>
          <span className="t-overline" style={{ color: "var(--orange-400)" }}>Visão nacional</span>
          <h2 className="t-h2" style={{ color: "var(--cream-500)", margin: "4px 0 0" }}>Gestão financeira</h2>
        </div>
        <button className="adm-export-btn" onClick={handleExport} title="Exportar CSV">
          <Icon name="download" size={15} /> Exportar CSV
        </button>
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
        <>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Data</th><th>Estado</th><th>Unidade</th><th>Cliente</th><th>Valor</th><th>Método</th><th>Pagamento</th><th>Código</th><th></th></tr></thead>
              <tbody>
                {pageRows.map((r) => {
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
          <Paginator page={page} total={totalPages} setPage={setPage} count={count} perPage={25} />
        </>
      )}
      <p className="adm-metrics-note" style={{ marginTop: 16 }}>Pronto pro gateway: hoje o status de pagamento é manual (Pix recebido na chave). Ao conectar um PSP, o webhook preenche payment_status/paid_at automaticamente.</p>
    </div>
  );
}
function Kpi({ n, l, tone, accent }) {
  return <div className={`adm-kpi${accent ? " accent" : ""} adm-kpi-${tone || "base"}`}><div className="adm-kpi-n tabular">{n}</div><div className="adm-kpi-l">{l}</div></div>;
}

/* ============================ TABLE VIEW ============================ */
const STATUS_META = {
  reserved:  { label: "Agendado",  cls: "st-reserved" },
  active:    { label: "Ocupado",   cls: "st-active" },
  done:      { label: "Concluído", cls: "st-done" },
  cancelled: { label: "Cancelado", cls: "st-cancelled" },
};

const TABLE_COLS = [
  { key: "_status", label: "Status" },
  { key: "customer_name", label: "Cliente" },
  { key: "customer_phone", label: "Contato" },
  { key: "size", label: "Tam." },
  { key: "_locker_label", label: "Locker" },
  { key: "check_in", label: "Entrada" },
  { key: "check_out", label: "Retirada" },
  { key: "price_total", label: "Total" },
  { key: "source", label: "Origem" },
  { key: "locker_code", label: "Código" },
];

function TableView({ reservations, lockers }) {
  const [f, setF] = useState("all");
  const lockerById = useMemo(() => Object.fromEntries(lockers.map((l) => [l.id, l])), [lockers]);
  const rows = useMemo(() => {
    const list = f === "all" ? reservations : reservations.filter((r) => r.status === f);
    return [...list].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [reservations, f]);
  const { page, total: totalPages, setPage, slice: pageRows, count } = usePagination(rows, 25);
  const count2 = (st) => reservations.filter((r) => r.status === st).length;
  const filters = [
    ["all", `Todos · ${reservations.length}`],
    ["reserved", `Agendados · ${count2("reserved")}`],
    ["active", `Ocupados · ${count2("active")}`],
    ["done", `Concluídos · ${count2("done")}`],
    ["cancelled", `Cancelados · ${count2("cancelled")}`],
  ];

  const handleExport = () => {
    const exportRows = rows.map((r) => {
      const lk = r.locker_id && lockerById[r.locker_id];
      return {
        ...r,
        _status: STATUS_META[r.status]?.label || r.status,
        _locker_label: lk ? lk.label : "—",
      };
    });
    downloadCSV(exportRows, TABLE_COLS, `reservas-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div className="adm-filters">
          {filters.map(([k, lbl]) => <button key={k} className={`adm-chip${f === k ? " on" : ""}`} onClick={() => setF(k)}>{lbl}</button>)}
        </div>
        <button className="adm-export-btn" onClick={handleExport} title="Exportar CSV">
          <Icon name="download" size={15} /> Exportar CSV
        </button>
      </div>
      {rows.length === 0 ? (
        <div className="adm-empty sm"><p className="t-body" style={{ color: "var(--navy-200)" }}>Nada por aqui ainda.</p></div>
      ) : (
        <>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Status</th><th>Cliente</th><th>Contato</th><th>Tam.</th><th>Locker</th><th>Entrada</th><th>Retirada</th><th>Total</th><th>Origem</th><th>Código</th></tr></thead>
              <tbody>
                {pageRows.map((r) => {
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
          <Paginator page={page} total={totalPages} setPage={setPage} count={count} perPage={25} />
        </>
      )}
    </div>
  );
}

/* ============================ MARKETING VIEW ============================ */
function MarketingView({ reservations, units }) {
  const [period, setPeriod] = useState("month");
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start7 = new Date(startToday); start7.setDate(start7.getDate() - 6);
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodStart = period === "today" ? startToday : period === "7d" ? start7 : period === "month" ? startMonth : null;

  const filtered = useMemo(() => {
    if (!periodStart) return reservations;
    return reservations.filter((r) => new Date(r.created_at) >= periodStart);
  }, [reservations, period]);

  const fromSite = filtered.filter((r) => r.source !== "admin").length;
  const fromAdmin = filtered.filter((r) => r.source === "admin").length;
  const total = filtered.length;

  const agendadas = filtered.filter((r) => r.status === "reserved").length;
  const ativas = filtered.filter((r) => r.status === "active").length;
  const concluidas = filtered.filter((r) => r.status === "done").length;
  const canceladas = filtered.filter((r) => r.status === "cancelled").length;
  const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);

  // Top 5 units by completed reservations
  const byUnit = {};
  for (const r of filtered.filter((rv) => rv.status === "done")) {
    const key = r.unit_code || r.unit_ref || "—";
    byUnit[key] = (byUnit[key] || 0) + 1;
  }
  const topUnits = Object.entries(byUnit).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v).slice(0, 5);
  const topMax = Math.max(1, ...topUnits.map((b) => b.v));

  return (
    <div>
      <div className="adm-unit-head">
        <div>
          <span className="t-overline" style={{ color: "var(--orange-400)" }}>Visão nacional</span>
          <h2 className="t-h2" style={{ color: "var(--cream-500)", margin: "4px 0 0" }}>Marketing</h2>
        </div>
        <select className="field" style={{ width: "auto" }} value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="today">Hoje</option><option value="7d">7 dias</option><option value="month">Este mês</option><option value="all">Tudo</option>
        </select>
      </div>

      <div className="adm-kpis" style={{ marginBottom: 24 }}>
        <Kpi n={fromSite} l="Do site" accent />
        <Kpi n={fromAdmin} l="Manual (admin)" />
        <Kpi n={total} l="Total" />
      </div>

      <div className="adm-fin-grid">
        <div className="adm-msec">
          <h3 className="adm-msec-h">Funil de conversão</h3>
          <div className="adm-funnel">
            {[
              { label: "Agendadas", n: agendadas, cls: "st-reserved" },
              { label: "Ativas", n: ativas, cls: "st-active" },
              { label: "Concluídas", n: concluidas, cls: "st-done" },
              { label: "Canceladas", n: canceladas, cls: "st-cancelled" },
            ].map((step) => (
              <div className="adm-funnel-step" key={step.label}>
                <span className={`adm-st ${step.cls}`}>{step.label}</span>
                <span className="adm-funnel-n tabular">{step.n}</span>
                <span className="adm-funnel-pct">{pct(step.n)}%</span>
                <div className="adm-funnel-bar">
                  <div className="adm-funnel-fill" style={{ width: `${pct(step.n)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="adm-msec">
          <h3 className="adm-msec-h">Top 5 unidades (concluídas)</h3>
          {topUnits.length === 0 ? (
            <div className="adm-muted">Sem dados.</div>
          ) : (
            <div className="adm-hbars">
              {topUnits.map((b) => (
                <div className="adm-hbar" key={b.k}>
                  <span className="adm-hbar-lbl">{b.k}</span>
                  <span className="adm-hbar-track"><span className="adm-hbar-fill" style={{ width: `${(b.v / topMax) * 100}%` }} /></span>
                  <span className="adm-hbar-val tabular">{b.v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================ NATIONAL VIEW (2.11) ============================ */
function NationalView({ units, lockers, reservations, loading }) {
  if (loading) return <div style={{ padding: 32 }}><SkeletonList rows={8} /></div>;

  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Ocupação global
  const totalLockers = lockers.length;
  const occupied = lockers.filter((l) => l.status === "occupied").length;
  const free = lockers.filter((l) => l.status === "free").length;
  const maint = lockers.filter((l) => l.status === "maintenance").length;
  const resById = Object.fromEntries(reservations.map((r) => [r.id, r]));
  const overstayCount = lockers.filter((l) => isOverstay(l, resById[l.current_reservation_id])).length;
  const occPct = totalLockers ? Math.round((occupied / totalLockers) * 100) : 0;

  // Reservas do mês
  const monthRes = reservations.filter((r) => r.status !== "cancelled" && new Date(r.created_at) >= startMonth);
  const monthRevenue = monthRes.reduce((a, r) => a + (r.price_total || 0), 0);
  const monthReceived = reservations.filter((r) => r.payment_status === "paid" && new Date(r.created_at) >= startMonth)
    .reduce((a, r) => a + (r.price_total || 0), 0);

  // Ranking de unidades por ocupação (%)
  const unitOccRank = units.map((u) => {
    const ul = lockers.filter((l) => l.unit_id === u.id);
    const occ = ul.filter((l) => l.status === "occupied").length;
    const pct = ul.length ? Math.round((occ / ul.length) * 100) : 0;
    return { code: u.code, name: u.name, total: ul.length, occ, pct };
  }).filter((u) => u.total > 0).sort((a, b) => b.pct - a.pct);

  // Ranking por faturamento no mês
  const byRevenue = {};
  for (const r of monthRes) {
    const key = r.unit_code || "—";
    byRevenue[key] = (byRevenue[key] || 0) + (r.price_total || 0);
  }
  const revenueRank = Object.entries(byRevenue).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v).slice(0, 8);
  const revenueMax = Math.max(1, ...revenueRank.map((b) => b.v));

  const occMax = Math.max(1, ...unitOccRank.map((u) => u.pct));
  const MONTHS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

  return (
    <div>
      <div className="adm-unit-head">
        <div>
          <span className="t-overline" style={{ color: "var(--orange-400)" }}>Consolidado</span>
          <h2 className="t-h2" style={{ color: "var(--cream-500)", margin: "4px 0 0" }}>Visão nacional</h2>
        </div>
      </div>

      <div className="adm-kpis">
        <Kpi n={totalLockers} l="Lockers totais" />
        <Kpi n={`${occupied} (${occPct}%)`} l="Ocupados" tone="orange" accent />
        <Kpi n={free} l="Livres" tone="success" />
        <Kpi n={maint} l="Manutenção" tone="base" />
        <Kpi n={overstayCount} l="Atrasados" tone="danger" />
      </div>
      <div className="adm-kpis" style={{ marginTop: 12 }}>
        <Kpi n={money(monthRevenue)} l={`Faturamento · ${MONTHS[now.getMonth()]}`} accent />
        <Kpi n={money(monthReceived)} l="Recebido · mês" tone="success" />
        <Kpi n={units.length} l="Unidades ativas" />
        <Kpi n={monthRes.length} l="Reservas no mês" />
      </div>

      <div className="adm-fin-grid" style={{ marginTop: 24 }}>
        <div className="adm-msec">
          <h3 className="adm-msec-h">Ranking por ocupação (%)</h3>
          {unitOccRank.length === 0 ? <div className="adm-muted">Sem dados.</div> : (
            <div className="adm-hbars">
              {unitOccRank.slice(0, 10).map((u) => (
                <div className="adm-hbar" key={u.code}>
                  <span className="adm-hbar-lbl" title={u.name}>{u.code}</span>
                  <span className="adm-hbar-track"><span className="adm-hbar-fill" style={{ width: `${(u.pct / occMax) * 100}%` }} /></span>
                  <span className="adm-hbar-val tabular">{u.pct}% <span style={{ color: "var(--navy-400)", fontSize: 11 }}>({u.occ}/{u.total})</span></span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="adm-msec">
          <h3 className="adm-msec-h">Ranking por faturamento · mês</h3>
          {revenueRank.length === 0 ? <div className="adm-muted">Sem dados.</div> : (
            <div className="adm-hbars">
              {revenueRank.map((b) => (
                <div className="adm-hbar" key={b.k}>
                  <span className="adm-hbar-lbl">{b.k}</span>
                  <span className="adm-hbar-track"><span className="adm-hbar-fill" style={{ width: `${(b.v / revenueMax) * 100}%` }} /></span>
                  <span className="adm-hbar-val tabular">{money(b.v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================ AUDIT VIEW ============================ */
function AuditView({ unitCode }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listAuditLogs(unitCode, 50).then(({ data }) => {
      setLogs(data || []);
      setLoading(false);
    });
  }, [unitCode]);

  if (loading) return <SkeletonList rows={6} />;

  if (!logs.length) return (
    <div className="adm-empty sm"><p className="t-body" style={{ color: "var(--navy-200)" }}>Nenhum evento registrado para esta unidade.</p></div>
  );

  const ACTION_LABEL = {
    occupy: "Ocupou locker",
    free: "Liberou locker",
    checkin: "Check-in",
    cancel: "Cancelou reserva",
    status_maintenance: "Colocou em manutenção",
    status_free: "Reativou locker",
    delete_locker: "Excluiu locker",
    delete_unit: "Excluiu unidade",
    extra_charge: "Cobrou diárias extras",
  };

  return (
    <div className="adm-table-wrap" style={{ marginTop: 12 }}>
      <table className="adm-table">
        <thead>
          <tr><th>Data/hora</th><th>Ação</th><th>Entidade</th><th>Usuário</th><th>Detalhes</th></tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td className="adm-td-mono">{fmtDateTime(log.created_at)}</td>
              <td>{ACTION_LABEL[log.action] || log.action}</td>
              <td>{log.entity}{log.entity_id ? ` · ${String(log.entity_id).slice(0, 8)}…` : ""}</td>
              <td>{log.user_email || "—"}</td>
              <td>{log.details ? JSON.stringify(log.details) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================ STAT ============================ */
function Stat({ n, l, tone }) {
  return <div className={`adm-stat adm-stat-${tone || "base"}`}><div className="adm-stat-n tabular">{n}</div><div className="adm-stat-l">{l}</div></div>;
}

/* ============================ LOCKER CARD ============================ */
function LockerCard({ lk, res, onOccupy, onFree, onMaint, onDel }) {
  const occupied = lk.status === "occupied";
  const maint = lk.status === "maintenance";
  const overstay = isOverstay(lk, res);
  return (
    <div className={`adm-locker ${lk.status}${overstay ? " overstay" : ""}`}>
      <div className="adm-locker-top">
        <span className="adm-locker-label">{lk.label}</span>
        <button className="adm-locker-del" title="Excluir locker" onClick={onDel}><Icon name="close" size={13} /></button>
      </div>
      <div className="adm-locker-status">{occupied ? "Ocupado" : maint ? "Manutenção" : "Livre"}</div>
      {overstay && <span className="adm-overstay-badge">Atrasado</span>}
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
  const [paidIds, setPaidIds] = useState(() => new Set()); const [paying, setPaying] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const selBooking = pendings.find((r) => r.id === effBookingId) || null;
  const bookingPaid = !!selBooking && (selBooking.payment_status === "paid" || paidIds.has(selBooking.id));
  const markPaid = async () => {
    if (!selBooking) return;
    setPaying(true);
    const { error } = await setPaymentStatus(selBooking.id, "paid");
    setPaying(false);
    if (error) { setErr(error.message); return; }
    setPaidIds((prev) => new Set(prev).add(selBooking.id));
  };
  const save = async () => {
    if (!lk) { setErr("Selecione um locker livre."); return; }
    setBusy(true); setErr(null);
    let error;
    if (m === "booking") {
      const b = pendings.find((r) => r.id === effBookingId);
      if (!b) { setBusy(false); setErr("Selecione um agendamento."); return; }
      if (!(b.payment_status === "paid" || paidIds.has(b.id))) { setBusy(false); setErr("Confirme o pagamento antes de liberar a entrega da mala."); return; }
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
                {selBooking && !bookingPaid && (
                  <div className="adm-pay-gate">
                    <span className="adm-pay-warn">⚠ Aguardando pagamento</span>
                    <button className="adm-mini ghost" onClick={markPaid} disabled={paying}>{paying ? "Confirmando…" : "Marcar como pago"}</button>
                  </div>
                )}
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
        <Btn variant="primary" cta className="btn-block" onClick={save} disabled={busy || !lk || (m === "booking" && !bookingPaid)}>{busy ? "Salvando…" : m === "booking" ? (bookingPaid ? "Confirmar entrega da mala" : "Aguardando pagamento") : "Confirmar ocupação"}</Btn>
      </div>
    </ModalShell>
  );
}

// Calcula diárias extras quando a retirada ocorre após o check_out previsto.
function overstayCharge(res) {
  if (!res?.check_out) return { extraDays: 0, extra: 0 };
  const str = String(res.check_out);
  const co = new Date(str.length <= 10 ? str + "T12:00" : str);
  if (isNaN(co)) return { extraDays: 0, extra: 0 };
  const diffMs = Date.now() - co.getTime();
  if (diffMs <= 0) return { extraDays: 0, extra: 0 };
  const extraDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  const daily = MALEX_PRICING[res.size]?.day || 0;
  return { extraDays, extra: extraDays * daily };
}

function PickupModal({ unit, lockers, resById, onClose, onDone }) {
  const occupied = (lockers || []).filter((l) => l.status === "occupied");
  const [lockerId, setLockerId] = useState(occupied[0]?.id || "");
  const lk = occupied.find((l) => l.id === lockerId);
  const res = lk ? resById[lk.current_reservation_id] : null;
  const [busy, setBusy] = useState(false);
  const { extraDays, extra } = res ? overstayCharge(res) : { extraDays: 0, extra: 0 };
  const save = async () => {
    if (!lk) return;
    setBusy(true);
    if (extra > 0 && res) await addReservationCharge(res.id, res.price_total, extra);
    await freeLocker(lk, unit.code);
    setBusy(false);
    onDone();
  };
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
            {extra > 0 && (
              <div className="adm-overstay-charge">
                <span className="adm-pay-warn">⚠ Retirada atrasada</span>
                <div className="t-body-sm" style={{ color: "var(--cream-500)", marginTop: 4 }}>
                  {extraDays} diária(s) extra = <strong className="tabular">{money(extra)}</strong>
                </div>
                <div className="t-body-sm" style={{ color: "var(--navy-300)" }}>
                  Total atualizado: {money(res.price_total)} → <strong className="tabular">{money((Number(res.price_total) || 0) + extra)}</strong>
                </div>
              </div>
            )}
            <Btn variant="primary" cta className="btn-block" onClick={save} disabled={busy || !lk}>{busy ? "Concluindo…" : extra > 0 ? `Cobrar extra e liberar` : "Confirmar retirada e liberar"}</Btn>
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
  const [localPaid, setLocalPaid] = useState(false);
  const [err, setErr] = useState(null); const [busy, setBusy] = useState(false); const [paying, setPaying] = useState(false);
  const paid = reservation.payment_status === "paid" || localPaid;
  const markPaid = async () => {
    setPaying(true);
    const { error } = await setPaymentStatus(reservation.id, "paid");
    setPaying(false);
    if (error) { setErr(error.message); return; }
    setLocalPaid(true);
  };
  const save = async () => {
    const lk = free.find((l) => l.id === lockerId);
    if (!lk) { setErr("Selecione um locker livre."); return; }
    if (!paid) { setErr("Confirme o pagamento antes de registrar a entrada."); return; }
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
        {!paid && (
          <div className="adm-pay-gate">
            <span className="adm-pay-warn">⚠ Aguardando pagamento</span>
            <button className="adm-mini ghost" onClick={markPaid} disabled={paying}>{paying ? "Confirmando…" : "Marcar como pago"}</button>
          </div>
        )}
        <Fld label="Locker livre">
          <select className="field" value={lockerId} onChange={(e) => setLockerId(e.target.value)}>
            {free.length ? free.map((l) => <option key={l.id} value={l.id}>{l.label}</option>) : <option value="">Sem locker livre desse tamanho</option>}
          </select>
        </Fld>
        <Fld label="Retirar até"><input className="field" type="date" value={checkout} onChange={(e) => setCheckout(e.target.value)} /></Fld>
        {err && <div className="adm-err">{err}</div>}
        <Btn variant="primary" cta className="btn-block" onClick={save} disabled={busy || !free.length || !paid}>{busy ? "Salvando…" : !paid ? "Aguardando pagamento" : "Confirmar entrada"}</Btn>
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
          {onDelUnit && (
            <button className="danger" onClick={() => { setOpen(false); onDelUnit(); }}><Icon name="close" size={15} /> Excluir unidade</button>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   BLOG CMS — list, create, edit, delete posts
   ============================================================ */

function fmtDateShort(v) {
  if (!v) return "—";
  const d = new Date(v);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function linePrefix(type) {
  if (type === "ul") return "- ";
  if (type === "ol") return "1. ";
  if (type === "blockquote") return "> ";
  if (type === "h1") return "# ";
  if (type === "h2") return "## ";
  if (type === "h3") return "### ";
  return "";
}

function insertMd(ta, before, after = "") {
  if (!ta) return "";
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const val = ta.value;
  const sel = val.slice(start, end);
  const replacement = before + sel + after;
  const newVal = val.slice(0, start) + replacement + val.slice(end);
  const cursor = sel ? start + replacement.length : start + before.length;
  return { newVal, cursor };
}

function insertLinePrefix(ta, prefix) {
  if (!ta) return "";
  const start = ta.selectionStart;
  const val = ta.value;
  const lineStart = val.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = val.indexOf("\n", start);
  const line = val.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
  const newLine = prefix + line.replace(/^(#{1,6}\s|[-*]\s|>\s|\d+\.\s)/, "");
  const newVal = val.slice(0, lineStart) + newLine + (lineEnd === -1 ? "" : val.slice(lineEnd));
  return { newVal, cursor: lineStart + prefix.length + (start - lineStart) };
}

function MdToolbar({ onAction }) {
  const btn = (label, action) => (
    <button key={label} type="button" className="blog-md-toolbar-btn" onMouseDown={(e) => { e.preventDefault(); onAction(action); }}>{label}</button>
  );
  const sep = (k) => <div key={k} className="blog-md-toolbar-sep" />;
  return (
    <div className="blog-md-toolbar">
      {btn("B", { type: "wrap", before: "**", after: "**" })}
      {btn("I", { type: "wrap", before: "_", after: "_" })}
      {btn("~~", { type: "wrap", before: "~~", after: "~~" })}
      {sep("s1")}
      {btn("H1", { type: "line", prefix: "# " })}
      {btn("H2", { type: "line", prefix: "## " })}
      {btn("H3", { type: "line", prefix: "### " })}
      {sep("s2")}
      {btn("— lista", { type: "line", prefix: "- " })}
      {btn("1. lista", { type: "line", prefix: "1. " })}
      {btn('" cit.', { type: "line", prefix: "> " })}
      {sep("s3")}
      {btn("[ link ]", { type: "wrap", before: "[", after: "](url)" })}
      {btn("[ img ]", { type: "insert", text: "![alt](url)" })}
      {btn("<código>", { type: "wrap", before: "`", after: "`" })}
      {btn("```bloco```", { type: "wrap", before: "```\n", after: "\n```" })}
      {sep("s4")}
      {btn("---", { type: "insert", text: "\n---\n" })}
    </div>
  );
}

const BLANK_POST = {
  title: "", slug: "", seo_title: "", summary: "", body: "",
  meta_description: "", category: BLOG_CATEGORIES[0], tags: "",
  main_keyword: "", secondary_keywords: "", schema_type: "Article",
  cover_image_url: "", cover_image_alt: "", status: "draft",
};

function PostEditor({ postId, onBack, onSaved }) {
  const [form, setForm] = useState(BLANK_POST);
  const [loading, setLoading] = useState(!!postId);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [uploading, setUploading] = useState(false);
  const taRef = useRef(null);

  useEffect(() => {
    if (!postId) return;
    adminGetPost(postId).then(({ data }) => {
      if (data) setForm({
        ...BLANK_POST, ...data,
        tags: (data.tags || []).join(", "),
        secondary_keywords: (data.secondary_keywords || []).join(", "),
      });
      setLoading(false);
    });
  }, [postId]);

  const set = (k, v) => setForm((f) => {
    const next = { ...f, [k]: v };
    if (k === "title" && !postId) next.slug = slugify(v);
    return next;
  });

  const handleMdAction = useCallback((action) => {
    const ta = taRef.current;
    if (!ta) return;
    let result;
    if (action.type === "wrap") result = insertMd(ta, action.before, action.after);
    else if (action.type === "line") result = insertLinePrefix(ta, action.prefix);
    else if (action.type === "insert") result = insertMd(ta, action.text);
    if (!result) return;
    setForm((f) => ({ ...f, body: result.newVal }));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(result.cursor, result.cursor);
    });
  }, []);

  const handleCover = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setErr(null);
    const { url, error } = await uploadCoverImage(file, form.slug || "post");
    setUploading(false);
    if (error) { setErr("Erro no upload: " + error.message); return; }
    set("cover_image_url", url);
  };

  const save = async (status) => {
    setSaving(true); setErr(null);
    const payload = {
      ...form,
      id: postId,
      status,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      secondary_keywords: form.secondary_keywords ? form.secondary_keywords.split(",").map((t) => t.trim()).filter(Boolean) : [],
      read_time_min: calcReadTime(form.body),
    };
    const { data, error } = await adminSavePost(payload);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved(data);
  };

  if (loading) return <div className="blog-cms-empty">Carregando…</div>;

  return (
    <div className="blog-editor-wrap">
      <button className="blog-editor-back" onClick={onBack}><Icon name="arrow-left" size={15} /> Voltar à lista</button>
      <div className="blog-editor-title">{postId ? "Editar artigo" : "Novo artigo"}</div>

      {err && <div className="blog-editor-err">{err}</div>}

      <div className="blog-editor-grid">
        <div className="blog-editor-full">
          <label className="wf-field"><span className="wf-field-lbl">Título *</span>
            <input className="field" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Título do artigo" />
          </label>
        </div>
        <label className="wf-field"><span className="wf-field-lbl">Slug (URL)</span>
          <input className="field" value={form.slug} onChange={(e) => set("slug", slugify(e.target.value))} placeholder="url-do-artigo" />
        </label>
        <label className="wf-field"><span className="wf-field-lbl">Categoria</span>
          <select className="field" value={form.category} onChange={(e) => set("category", e.target.value)}>
            {BLOG_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <div className="blog-editor-full">
          <label className="wf-field"><span className="wf-field-lbl">Resumo</span>
            <textarea className="field" rows={2} value={form.summary} onChange={(e) => set("summary", e.target.value)} placeholder="Resumo curto exibido nos cards" />
          </label>
        </div>
      </div>

      <div className="blog-editor-section-label">SEO</div>
      <div className="blog-editor-grid">
        <div className="blog-editor-full">
          <label className="wf-field"><span className="wf-field-lbl">Título SEO</span>
            <input className="field" value={form.seo_title} onChange={(e) => set("seo_title", e.target.value)} placeholder="Título para Google (deixe vazio p/ usar o título acima)" />
          </label>
        </div>
        <div className="blog-editor-full">
          <label className="wf-field"><span className="wf-field-lbl">Meta description</span>
            <input className="field" value={form.meta_description} onChange={(e) => set("meta_description", e.target.value)} placeholder="Max ~160 caracteres" />
          </label>
        </div>
        <label className="wf-field"><span className="wf-field-lbl">Palavra-chave principal</span>
          <input className="field" value={form.main_keyword} onChange={(e) => set("main_keyword", e.target.value)} placeholder="ex: guarda-volumes aeroporto" />
        </label>
        <label className="wf-field"><span className="wf-field-lbl">Palavras-chave secundárias (vírgula)</span>
          <input className="field" value={form.secondary_keywords} onChange={(e) => set("secondary_keywords", e.target.value)} placeholder="ex: locker, bagagem" />
        </label>
        <label className="wf-field"><span className="wf-field-lbl">Schema JSON-LD</span>
          <select className="field" value={form.schema_type} onChange={(e) => set("schema_type", e.target.value)}>
            <option value="Article">Article</option>
            <option value="FAQ">FAQ</option>
            <option value="LocalBusiness">LocalBusiness</option>
          </select>
        </label>
        <label className="wf-field"><span className="wf-field-lbl">Tags (vírgula)</span>
          <input className="field" value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="ex: aeroporto, mochila" />
        </label>
      </div>

      <div className="blog-editor-section-label">Imagem de capa</div>
      <div className="blog-editor-cover-row">
        {form.cover_image_url
          ? <img src={form.cover_image_url} alt="" className="blog-editor-cover-img" />
          : <div className="blog-editor-cover-placeholder"><Icon name="image" size={22} color="var(--navy-500)" /></div>
        }
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
            {uploading ? "Enviando…" : "Escolher imagem"}
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleCover} disabled={uploading} />
          </label>
          {form.cover_image_url && (
            <label className="wf-field" style={{ margin: 0 }}><span className="wf-field-lbl">Alt text</span>
              <input className="field" value={form.cover_image_alt} onChange={(e) => set("cover_image_alt", e.target.value)} placeholder="Descrição da imagem" />
            </label>
          )}
        </div>
      </div>

      <div className="blog-editor-section-label">Conteúdo (Markdown)</div>
      <MdToolbar onAction={handleMdAction} />
      <textarea
        ref={taRef}
        className="blog-md-textarea field"
        value={form.body}
        onChange={(e) => set("body", e.target.value)}
        placeholder="Escreva o artigo em Markdown…"
        spellCheck
      />
      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
        <Btn variant="primary" cta onClick={() => save("published")} disabled={saving || !form.title}>
          {saving ? "Salvando…" : "Publicar"}
        </Btn>
        <Btn variant="ghost" onClick={() => save("draft")} disabled={saving || !form.title}>
          Salvar rascunho
        </Btn>
        {saving && <span className="blog-editor-saving"><Icon name="clock" size={14} color="var(--navy-400)" /> Salvando…</span>}
      </div>
    </div>
  );
}

function BlogCmsView() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const taRef = useRef(null);
  const { confirm: confirmBlog, ConfirmUI: BlogConfirmUI } = useConfirm();

  const load = useCallback(() => {
    setLoading(true);
    adminListPosts().then(({ data }) => { setPosts(data || []); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const del = useCallback(async (id, title) => {
    const ok = await confirmBlog(`Excluir "${title}"? Isso não pode ser desfeito.`, "Excluir artigo");
    if (!ok) return;
    await adminDeletePost(id);
    load();
  }, [load, confirmBlog]);

  if (creating) return <PostEditor postId={null} onBack={() => { setCreating(false); load(); }} onSaved={() => { setCreating(false); load(); }} />;
  if (editing !== null) return <PostEditor postId={editing} onBack={() => { setEditing(null); load(); }} onSaved={() => { setEditing(null); load(); }} />;

  return (
    <div className="blog-cms-wrap">
      <div className="blog-cms-header">
        <h2>Artigos do Blog</h2>
        <Btn variant="primary" size="sm" onClick={() => setCreating(true)}>+ Novo artigo</Btn>
      </div>
      {loading ? (
        <div className="blog-cms-empty">Carregando…</div>
      ) : posts.length === 0 ? (
        <div className="blog-cms-empty">Nenhum artigo ainda. Clique em "Novo artigo" para começar.</div>
      ) : (
        <div className="blog-cms-table-wrap">
          <table className="blog-cms-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Categoria</th>
                <th>Status</th>
                <th>Publicado</th>
                <th>Leitura</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id}>
                  <td>{p.title}</td>
                  <td style={{ color: "var(--navy-300)", whiteSpace: "nowrap" }}>{p.category}</td>
                  <td><span className={`blog-cms-status ${p.status}`}>{p.status === "published" ? "Publicado" : "Rascunho"}</span></td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDateShort(p.published_at)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{p.read_time_min ?? "—"} min</td>
                  <td>
                    <div className="blog-cms-actions">
                      <Btn variant="ghost" size="sm" onClick={() => setEditing(p.id)}>Editar</Btn>
                      <Btn variant="ghost" size="sm" onClick={() => del(p.id, p.title)} style={{ color: "#f87171" }}>Excluir</Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {BlogConfirmUI}
    </div>
  );
}
