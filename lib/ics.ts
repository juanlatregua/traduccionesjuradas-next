// lib/ics.ts - minimal iCalendar (.ics) builder for UGE-CE deadlines.
// Pure string generation (RFC 5545 subset): all-day VEVENTs with a DISPLAY
// VALARM so the user's own calendar app reminds them. This delivers the
// "recordatorios" value with no backend; email/SMS reminders come at the port.

export interface IcsEvent {
  uid: string;
  title: string;
  date: Date;
  description?: string;
  alarmDaysBefore?: number;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// All-day events use a date-only value (YYYYMMDD).
function dateValue(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function stamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

// Escape per RFC 5545 (commas, semicolons, backslashes, newlines).
function esc(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function nextDay(d: Date): Date {
  const r = new Date(d.getTime());
  r.setDate(r.getDate() + 1);
  return r;
}

export function buildIcs(events: IcsEvent[]): string {
  const now = stamp(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//traduccionesjuradas.net//Diagnostic fiscal FR-ES//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const ev of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${dateValue(ev.date)}`,
      `DTEND;VALUE=DATE:${dateValue(nextDay(ev.date))}`,
      `SUMMARY:${esc(ev.title)}`,
    );
    if (ev.description) {
      lines.push(`DESCRIPTION:${esc(ev.description)}`);
    }
    if (ev.alarmDaysBefore && ev.alarmDaysBefore > 0) {
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${esc(ev.title)}`,
        `TRIGGER:-P${ev.alarmDaysBefore}D`,
        "END:VALARM",
      );
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
