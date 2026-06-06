// Malex admin — auth + CRUD de unidades, lockers, ocupação e financeiro (Supabase).
import { supabase, supabaseEnabled } from "./supabase.js";

export { supabaseEnabled };

const SIZE_LABEL = { P: "Pequeno", M: "Médio", G: "Grande" };

/* ---------------- AUTH (login único do gestor) ---------------- */
export async function getSession() {
  if (!supabaseEnabled) return null;
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}
export function onAuth(cb) {
  if (!supabaseEnabled) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session));
  return () => data.subscription.unsubscribe();
}
export async function signIn(email, password) {
  if (!supabaseEnabled) return { error: { message: "Supabase não configurado." } };
  return supabase.auth.signInWithPassword({ email, password });
}
export async function signOut() {
  if (supabaseEnabled) await supabase.auth.signOut();
}

/* ---------------- UNIDADES ---------------- */
export async function listUnits() {
  const { data, error } = await supabase.from("units").select("*").order("state").order("city").order("name");
  return { data: data || [], error };
}
export async function addUnit(u) {
  return supabase.from("units").insert({
    code: u.code.trim().toUpperCase(), name: u.name.trim(),
    state: u.state.trim().toUpperCase(), city: u.city.trim(),
    address: u.address?.trim() || null, kind: u.kind || "other",
  }).select().single();
}
export async function deleteUnit(id) {
  return supabase.from("units").delete().eq("id", id);
}

/* ---------------- LOCKERS ---------------- */
export async function listLockers(unitId) {
  let q = supabase.from("lockers").select("*").order("label");
  if (unitId) q = q.eq("unit_id", unitId);
  const { data, error } = await q;
  return { data: data || [], error };
}
export async function addLocker(unitId, label, size) {
  return supabase.from("lockers").insert({ unit_id: unitId, label: label.trim().toUpperCase(), size }).select().single();
}
export async function addLockersBulk(unitId, counts) {
  const rows = [];
  for (const size of ["P", "G"]) {
    const n = parseInt(counts[size] || 0, 10);
    for (let i = 1; i <= n; i++) rows.push({ unit_id: unitId, label: `${size}-${String(i).padStart(2, "0")}`, size });
  }
  if (!rows.length) return { data: [], error: null };
  return supabase.from("lockers").insert(rows).select();
}
export async function deleteLocker(id) {
  return supabase.from("lockers").delete().eq("id", id);
}

/* ---------------- OCUPAÇÃO (locker ↔ cliente) ---------------- */
export async function occupyLocker(locker, customer) {
  const code = `MLX-${customer.unitCode || "BR"}-${Math.floor(1000 + Math.random() * 8999)}`;
  const { data: res, error: e1 } = await supabase.from("reservations").insert({
    locker_code: code,
    unit_ref: locker.unit_id,
    unit_code: customer.unitCode || null,
    unit_name: customer.unitName || null,
    locker_id: locker.id,
    size: locker.size,
    size_name: SIZE_LABEL[locker.size],
    check_out: customer.checkout || null,
    customer_name: customer.name.trim(),
    customer_email: customer.email?.trim() || "",
    customer_phone: customer.phone?.trim() || "",
    customer_cpf: customer.cpf?.trim() || "",
    pay_method: customer.pay || "pix",
    status: "active",
    source: "admin",
  }).select().single();
  if (e1) return { error: e1 };
  const { error: e2 } = await supabase.from("lockers")
    .update({ status: "occupied", current_reservation_id: res.id }).eq("id", locker.id);
  if (!e2) logAudit({ action: "occupy", entity: "locker", entityId: locker.id, unitCode: customer.unitCode, details: { locker: locker.label, customer: customer.name } });
  return { data: res, error: e2 };
}
export async function freeLocker(locker, unitCode) {
  if (locker.current_reservation_id) {
    await supabase.from("reservations").update({ status: "done", closed_at: new Date().toISOString() }).eq("id", locker.current_reservation_id);
  }
  const result = await supabase.from("lockers").update({ status: "free", current_reservation_id: null }).eq("id", locker.id);
  if (!result.error) logAudit({ action: "free", entity: "locker", entityId: locker.id, unitCode, details: { locker: locker.label } });
  return result;
}
export async function setLockerStatus(locker, status, unitCode) {
  const result = await supabase.from("lockers").update({ status }).eq("id", locker.id);
  if (!result.error) logAudit({ action: `status_${status}`, entity: "locker", entityId: locker.id, unitCode, details: { locker: locker.label } });
  return result;
}

// Check-in: cliente entregou a mala. Vincula um agendamento a um locker livre.
export async function checkInReservation(reservation, locker, checkout) {
  const patch = { status: "active", locker_id: locker.id, unit_ref: locker.unit_id };
  if (checkout) patch.check_out = checkout;
  const { error: e1 } = await supabase.from("reservations").update(patch).eq("id", reservation.id);
  if (e1) return { error: e1 };
  const { error: e2 } = await supabase.from("lockers")
    .update({ status: "occupied", current_reservation_id: reservation.id }).eq("id", locker.id);
  if (!e2) logAudit({ action: "checkin", entity: "reservation", entityId: reservation.id, unitCode: reservation.unit_code, details: { locker: locker.label, customer: reservation.customer_name } });
  return { error: e2 };
}
export async function cancelReservation(id, unitCode) {
  const result = await supabase.from("reservations").update({ status: "cancelled" }).eq("id", id);
  if (!result.error) logAudit({ action: "cancel", entity: "reservation", entityId: id, unitCode });
  return result;
}
export async function setPaymentStatus(id, status) {
  return supabase.from("reservations")
    .update({ payment_status: status, paid_at: status === "paid" ? new Date().toISOString() : null })
    .eq("id", id);
}

/* ---------------- RESERVAS ---------------- */
export async function listReservations(filter = {}) {
  let q = supabase.from("reservations").select("*").order("created_at", { ascending: false });
  if (filter.unit_ref) q = q.eq("unit_ref", filter.unit_ref);
  const { data, error } = await q;
  return { data: data || [], error };
}
export async function getReservation(id) {
  if (!id) return { data: null, error: null };
  return supabase.from("reservations").select("*").eq("id", id).single();
}

/* ---------------- AUDITORIA ---------------- */
async function currentEmail() {
  if (!supabaseEnabled) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user?.email || null;
}
export async function logAudit({ action, entity, entityId, unitCode, details }) {
  if (!supabaseEnabled) return;
  const userEmail = await currentEmail();
  await supabase.from("audit_logs").insert({
    action, entity, entity_id: entityId,
    unit_code: unitCode || null,
    user_email: userEmail,
    details: details ? details : null,
  });
}
export async function listAuditLogs(unitCode, limit = 100) {
  if (!supabaseEnabled) return { data: [], error: null };
  let q = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(limit);
  if (unitCode) q = q.eq("unit_code", unitCode);
  const { data, error } = await q;
  return { data: data || [], error };
}
