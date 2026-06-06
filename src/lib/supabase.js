// Supabase client + helper to persist a reservation.
// Reads credentials from Vite env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
// If they're absent, the app still runs as a demo (nothing is persisted).
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// true only when both env vars are set — lets the wizard degrade gracefully.
export const supabaseEnabled = Boolean(url && anonKey);

export const supabase = supabaseEnabled ? createClient(url, anonKey) : null;

/* Combine the wizard's separate date + time fields into one ISO timestamp. */
function toISO(date, time) {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}`);
  return isNaN(d) ? null : d.toISOString();
}

/**
 * Persist a reservation. Card data (number/name/exp/cvv) is intentionally
 * NEVER sent — only the chosen pay method is stored (PCI-safe, option 1).
 * Returns { data, error }. When Supabase isn't configured, it's a no-op success.
 */
export async function saveReservation({ s, price, code }) {
  if (!supabaseEnabled) return { data: null, error: null };

  const payload = {
    locker_code: code,
    unit_id: s.unit?.id ?? null,
    unit_ref: /^[0-9a-f-]{36}$/i.test(s.unit?.id || "") ? s.unit.id : null,
    unit_code: s.unit?.code ?? null,
    unit_name: s.unit?.name ?? null,
    unit_city: s.unit?.city ?? null,
    size: s.size,
    size_name: s.size ? ({ P: "Pequeno", M: "Médio", G: "Grande" }[s.size]) : null,
    check_in: toISO(s.inDate, s.inTime),
    check_out: toISO(s.outDate, s.outTime),
    price_total: price?.total ?? null,
    price_mode: price?.mode ?? null,
    customer_name: s.name.trim(),
    customer_email: s.email.trim(),
    customer_phone: s.phone,
    customer_cpf: s.cpf,
    pay_method: s.pay,          // 'pix' | 'card' — no card numbers, ever
    status: "reserved",
  };

  // Insert only — we don't read the row back, so no SELECT RLS policy is needed.
  const { error } = await supabase.from("reservations").insert(payload);
  return { data: null, error };
}
