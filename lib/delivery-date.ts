/**
 * Calcula la fecha estimada de entrega: 1 día laborable completo
 * sin contar el día de contratación.
 * Sáb/dom no cuentan. Festivos no incluidos (simplificación).
 */
export function getEstimatedDeliveryDate(fromDate: Date = new Date()): Date {
  const date = new Date(fromDate);
  // Avanzar al siguiente día (no contar día de contratación)
  date.setDate(date.getDate() + 1);
  // Saltar fines de semana
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  // Contar 1 día laborable completo
  let daysLeft = 1;
  while (daysLeft > 0) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0 && date.getDay() !== 6) {
      daysLeft--;
    }
  }
  return date;
}

export function addBusinessDays(from: Date, days: number): Date {
  const date = new Date(from);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0 && date.getDay() !== 6) added++;
  }
  return date;
}

/** Viernes ≥15:00, sábado o domingo → lunes siguiente 09:00 */
export function getBusinessStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  if (day === 0) {
    now.setDate(now.getDate() + 1);
    now.setHours(9, 0, 0, 0);
  } else if (day === 6) {
    now.setDate(now.getDate() + 2);
    now.setHours(9, 0, 0, 0);
  } else if (day === 5 && hour >= 15) {
    now.setDate(now.getDate() + 3);
    now.setHours(9, 0, 0, 0);
  }
  return now;
}

export function isWeekendOrFridayEvening(): boolean {
  const now = new Date();
  const day = now.getDay();
  return day === 0 || day === 6 || (day === 5 && now.getHours() >= 15);
}

export function getDeliveryRange(
  minDays: number,
  maxDays: number
): { from: string; to: string } {
  const start = getBusinessStart();
  return {
    from: formatDeliveryDate(addBusinessDays(start, minDays)),
    to: formatDeliveryDate(addBusinessDays(start, maxDays)),
  };
}

export function formatDeliveryDate(date: Date): string {
  return date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function formatDateForInput(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function isUrgent(requestedDate: string, estimatedDate: Date): boolean {
  const requested = new Date(requestedDate);
  requested.setHours(23, 59, 59);
  return requested < estimatedDate;
}
