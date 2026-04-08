export function resolveJwtSecurityConfig():
  | { mode: 'symmetric'; secret: string; keyId: string }
  | { mode: 'asymmetric'; privateKey: string; publicKey: string; keyId: string } {
  const keyId = process.env.JWT_KEY_ID || 'accesschat-default';
  const privateKey = resolveInlineKey(process.env.JWT_PRIVATE_KEY, process.env.JWT_PRIVATE_KEY_BASE64);
  const publicKey = resolveInlineKey(process.env.JWT_PUBLIC_KEY, process.env.JWT_PUBLIC_KEY_BASE64);

  if (privateKey && publicKey) {
    return {
      mode: 'asymmetric',
      privateKey,
      publicKey,
      keyId,
    };
  }

  return {
    mode: 'symmetric',
    secret: process.env.JWT_SECRET || 'change-me',
    keyId,
  };
}

function resolveInlineKey(pemValue?: string, base64Value?: string): string | null {
  if (pemValue) {
    return normalizePem(pemValue);
  }

  if (base64Value) {
    return normalizePem(Buffer.from(base64Value, 'base64').toString('utf-8'));
  }

  return null;
}

function normalizePem(value: string): string {
  return value.replace(/\\n/g, '\n').trim();
}
