// Calcolo client-side dei prossimi slot liberi, dato il piano (giorni+orari) del progetto
// e gli orari già occupati. Tutto in ora locale del browser → poi convertito in ISO/UTC.

export interface Slots {
  days: number[]; // 0=domenica .. 6=sabato
  times: string[]; // "09:00"
}

export function nextSlots(slots: Slots, takenISO: string[], count: number, from: Date = new Date()): Date[] {
  const taken = new Set(takenISO.map((s) => new Date(s).toISOString()));
  const times = [...slots.times].sort();
  const out: Date[] = [];
  const start = from.getTime();

  for (let dayOffset = 0; dayOffset < 180 && out.length < count; dayOffset++) {
    const day = new Date(from);
    day.setDate(day.getDate() + dayOffset);
    if (!slots.days.includes(day.getDay())) continue;
    for (const t of times) {
      if (out.length >= count) break;
      const [h, m] = t.split(":").map(Number);
      const dt = new Date(day);
      dt.setHours(h, m, 0, 0);
      if (dt.getTime() <= start) continue; // orario già passato
      if (taken.has(dt.toISOString())) continue; // slot già occupato
      out.push(dt);
    }
  }
  return out;
}

export function fmtSlot(d: Date): string {
  return d.toLocaleString("it-IT", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
