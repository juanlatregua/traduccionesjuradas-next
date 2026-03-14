# Email — SendGrid, templates y retry

## Proveedor: SendGrid (@sendgrid/mail 8.1.6)

**Variables de entorno:**
- `SENDGRID_API_KEY` — autenticación API
- `SENDGRID_FROM` — dirección remitente por defecto
- `PRESUPUESTO_TO` — email staff para notificaciones internas
- `PM_NOTIFICATION_TO` — email PM para finanzas (opcional)

## Archivos clave
- `lib/email.ts` — 18 funciones de email (1191 líneas)
- `lib/collaborator-emails.ts` — 6 emails del módulo colaborador
- `lib/email-retry.ts` — retry con backoff exponencial (2s, 4s, 8s; max 3 intentos)
- `lib/quote-email.ts` — envío de emails de presupuestos formales
- `lib/emails/quote-followup.ts` — followup IA tras análisis

## Template wrapper
`wrapClientEmailHtml(content)` — HTML wrapper reutilizable con:
- Logo SVG inline, estilos consistentes (Slate palette)
- Footer con contacto (email, teléfono, horario)
- Click tracking deshabilitado (`NO_CLICK_TRACKING`)

## Emails por categoría

### Presupuesto (3)
| Función | Destinatario | Trigger |
|---------|-------------|---------|
| `sendPresupuestoEmail()` | Staff | Formulario de presupuesto enviado |
| `sendPresupuestoConfirmationEmail()` | Cliente | Confirmación tras enviar formulario |
| `sendQuoteFollowupEmail()` | Cliente | Análisis IA completado (requiere `price` + `totalPrice`) |

### Pedidos (4)
| Función | Destinatario | Trigger |
|---------|-------------|---------|
| `sendOrderCreatedEmail()` | Cliente | Pedido creado |
| `sendNewOrderStaffEmail()` | Staff | Pedido creado (notificación interna) |
| `sendOrderUnderReviewClientEmail()` | Cliente | Pedido en revisión |
| `sendOrderReviewRoutingEmail()` | Review team | Pedido listo para revisión |

### Pagos (4)
| Función | Destinatario | Trigger |
|---------|-------------|---------|
| `sendPaymentConfirmedEmail()` | Cliente | Pago recibido |
| `sendPaymentProofUploadedStaffEmail()` | Staff | Justificante subido |
| `sendPaymentProofReceivedClientEmail()` | Cliente | Justificante recibido |
| `sendPaymentReminderEmail()` | Cliente | Cron (pago pendiente) |

### Traducción (4)
| Función | Destinatario | Trigger |
|---------|-------------|---------|
| `sendTranslationEtaEmail()` | Cliente | ETA establecido |
| `sendTranslationStartedAssignedEmail()` | Cliente | Traductor asignado |
| `sendTranslationReadyEmail()` | Cliente | Traducción entregada |
| `sendDocumentResubmissionRequestEmail()` | Cliente | Documento requiere reenvío |

### Staff/Admin (2)
| Función | Destinatario | Trigger |
|---------|-------------|---------|
| `sendInvoiceRequestEmail()` | Staff | Factura solicitada |
| `sendProjectManagerFinanceUpdateEmail()` | PM | Pago a proveedor confirmado |

### Colaboradores (6 — en `collaborator-emails.ts`)
| Función | Destinatario | Trigger |
|---------|-------------|---------|
| `sendAssignmentToCollaborator()` | Colaborador | Admin asigna traducción |
| `sendQuoteNotificationToAdmin()` | Admin | Colaborador envía presupuesto |
| `sendRevisionRequestToCollaborator()` | Colaborador | Admin pide revisión precio |
| `sendAcceptanceToCollaborator()` | Colaborador | Admin acepta presupuesto |
| `sendRejectionToCollaborator()` | Colaborador | Admin rechaza presupuesto |
| `sendDeliveryNotificationToAdmin()` | Admin | Colaborador entrega traducción |

## Cómo crear un nuevo email

1. Añadir función en `lib/email.ts` (o `collaborator-emails.ts` si es del módulo colaborador)
2. Usar `wrapClientEmailHtml()` para emails a cliente
3. Aplicar `NO_CLICK_TRACKING` en `trackingSettings`
4. Escapar contenido de usuario con `escapeHtml()`
5. URLs: sanitizar con `sanitizeUrl()` (debe empezar con http/https)
6. Para emails críticos: usar `sendEmailWithRetry()` del `lib/email-retry.ts`
7. En caso de fallo final, se crea registro en tabla `FailedEmail`

## Patrón de llamada
```typescript
import sgMail from "@sendgrid/mail";
sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

await sgMail.send({
  to: email,
  from: { email: process.env.SENDGRID_FROM!, name: "Traducciones Juradas" },
  subject: "...",
  html: wrapClientEmailHtml(content),
  trackingSettings: NO_CLICK_TRACKING,
});
```

## Estilos HTML
- Font: Arial, sans-serif | Texto: #0f172a, 15px, line-height 1.45
- Links: #2563eb | Botones: padding 10px 24px, border-radius 8px
- Tablas: border 1px solid #e2e8f0 | Footer: #64748b, 12px
