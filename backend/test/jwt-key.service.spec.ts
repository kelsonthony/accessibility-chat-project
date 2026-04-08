import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveJwtSecurityConfig } from '../src/auth/jwt-key.util.ts';

test('resolveJwtSecurityConfig prefers asymmetric PEM material from env', () => {
  const previousPrivateKey = process.env.JWT_PRIVATE_KEY;
  const previousPublicKey = process.env.JWT_PUBLIC_KEY;
  const previousSecret = process.env.JWT_SECRET;
  const previousKeyId = process.env.JWT_KEY_ID;

  process.env.JWT_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nprivate\\n-----END PRIVATE KEY-----';
  process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\\npublic\\n-----END PUBLIC KEY-----';
  process.env.JWT_SECRET = 'legacy-secret';
  process.env.JWT_KEY_ID = 'rotating-key-1';

  const resolved = resolveJwtSecurityConfig();

  assert.equal(resolved.mode, 'asymmetric');
  if (resolved.mode !== 'asymmetric') {
    throw new Error('Expected asymmetric config.');
  }
  assert.equal(resolved.keyId, 'rotating-key-1');
  assert.equal(resolved.privateKey.includes('\n'), true);
  assert.equal(resolved.publicKey.includes('\n'), true);

  restoreEnv('JWT_PRIVATE_KEY', previousPrivateKey);
  restoreEnv('JWT_PUBLIC_KEY', previousPublicKey);
  restoreEnv('JWT_SECRET', previousSecret);
  restoreEnv('JWT_KEY_ID', previousKeyId);
});

test('resolveJwtSecurityConfig falls back to symmetric secret when PEM is absent', () => {
  const previousPrivateKey = process.env.JWT_PRIVATE_KEY;
  const previousPublicKey = process.env.JWT_PUBLIC_KEY;
  const previousSecret = process.env.JWT_SECRET;

  delete process.env.JWT_PRIVATE_KEY;
  delete process.env.JWT_PUBLIC_KEY;
  process.env.JWT_SECRET = 'fallback-secret';

  const resolved = resolveJwtSecurityConfig();

  assert.equal(resolved.mode, 'symmetric');
  if (resolved.mode !== 'symmetric') {
    throw new Error('Expected symmetric config.');
  }
  assert.equal(resolved.secret, 'fallback-secret');

  restoreEnv('JWT_PRIVATE_KEY', previousPrivateKey);
  restoreEnv('JWT_PUBLIC_KEY', previousPublicKey);
  restoreEnv('JWT_SECRET', previousSecret);
});

function restoreEnv(key: string, value: string | undefined) {
  if (typeof value === 'undefined') {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
