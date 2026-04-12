export interface WhatsappInboundTextMessage {
  messageId: string;
  from: string;
  text: string;
  profileName?: string;
}

export function extractIncomingTextMessage(payload: unknown): WhatsappInboundTextMessage | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as Record<string, unknown>;
  const messageId = typeof candidate.MessageSid === 'string' ? candidate.MessageSid : '';
  const from = typeof candidate.From === 'string' ? candidate.From : '';
  const text = typeof candidate.Body === 'string' ? candidate.Body.trim() : '';
  const profileName = typeof candidate.ProfileName === 'string' ? candidate.ProfileName.trim() : undefined;

  if (!messageId || !from || !text) {
    return null;
  }

  return {
    messageId,
    from,
    text,
    profileName: profileName || undefined,
  };
}

export function buildWhatsappReply(answer: string): string {
  const normalized = answer.replace(/\s+\n/g, '\n').trim();
  return normalized.length > 1500 ? `${normalized.slice(0, 1497).trim()}...` : normalized;
}
