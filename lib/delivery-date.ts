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
