import test from 'node:test';
import assert from 'node:assert/strict';

import { buildWhatsappReply, extractIncomingTextMessage } from '../src/whatsapp/whatsapp.util.ts';

test('extractIncomingTextMessage returns normalized inbound Twilio WhatsApp message', () => {
  const message = extractIncomingTextMessage({
    MessageSid: 'SM123',
    From: 'whatsapp:+5561999999999',
    Body: 'Quais requisitos de acessibilidade devo seguir?',
    ProfileName: 'Kelson',
  });

  assert.deepEqual(message, {
    messageId: 'SM123',
    from: 'whatsapp:+5561999999999',
    profileName: 'Kelson',
    text: 'Quais requisitos de acessibilidade devo seguir?',
  });
});

test('buildWhatsappReply truncates oversized answers safely', () => {
  const reply = buildWhatsappReply('a'.repeat(1700));

  assert.equal(reply.length, 1500);
  assert.equal(reply.endsWith('...'), true);
});
