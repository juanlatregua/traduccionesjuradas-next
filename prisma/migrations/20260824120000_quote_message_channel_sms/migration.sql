-- Canal SMS en el rastro de mensajes del presupuesto: los clientes solo-WhatsApp
-- (email-marcador) reciben recordatorio y aviso de caducidad por SMS, y ese envio
-- debe constar como SENT (hasta ahora solo habia borradores WHATSAPP nunca enviados).
ALTER TYPE "QuoteMessageChannel" ADD VALUE 'SMS';
