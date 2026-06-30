/* Label helpers for order states — used by area-cliente pages.
 * La fuente única (es|fr) vive en lib/i18n/area-cliente.ts. Aquí solo se
 * reexporta para no romper los imports existentes (p. ej. GuestOrderLookup).
 * Sin `locale` → español, igual que antes. */

export {
  getPaymentStateLabel,
  getDeliveryStateLabel,
  getDeliveryTypeLabel,
  getWorkflowStateLabel,
} from "@/lib/i18n/area-cliente";
