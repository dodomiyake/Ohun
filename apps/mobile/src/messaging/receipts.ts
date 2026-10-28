import type { Message, ReceiptRequest } from '@ohun/contracts';
export function receiptCandidates(messages: Message[], userId: string, state: ReceiptRequest['state'], active: boolean, focused: boolean, visible: Set<string>): string[] {
 if (!active || !focused) return [];
 return messages.filter(message => message.senderId !== userId && (state === 'read' ? visible.has(message.id) && message.deliveryStatus !== 'read' : !message.deliveryStatus || message.deliveryStatus === 'sent')).map(message => message.id);
}
