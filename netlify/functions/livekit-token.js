import { AccessToken } from 'livekit-server-sdk';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const FIREBASE_PROJECT_ID = 'phoenix-messenger-c2f5f';
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const firebaseKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type'
  },
  body: JSON.stringify(body)
});

const clean = (value, fallback = '') => String(value || fallback).trim().slice(0, 160);
const cleanEnv = value => String(value || '').trim().replace(/^['"]|['"]$/g, '');

async function verifyFirebaseUser(event) {
  const header = event.headers?.authorization || event.headers?.Authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new Error('Missing Firebase auth token');
  const { payload } = await jwtVerify(token, firebaseKeys, {
    issuer: FIREBASE_ISSUER,
    audience: FIREBASE_PROJECT_ID
  });
  if (!payload.sub) throw new Error('Invalid Firebase auth token');
  return {
    uid: String(payload.sub),
    name: clean(payload.name || payload.email || payload.sub, payload.sub)
  };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod === 'GET') return json(200, { ok: true, service: 'livekit-token' });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const LIVEKIT_URL = cleanEnv(process.env.LIVEKIT_URL);
  const LIVEKIT_API_KEY = cleanEnv(process.env.LIVEKIT_API_KEY);
  const LIVEKIT_API_SECRET = cleanEnv(process.env.LIVEKIT_API_SECRET);
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return json(500, {
      error: 'LiveKit environment is not configured for Netlify Functions.',
      missing: {
        LIVEKIT_URL: !LIVEKIT_URL,
        LIVEKIT_API_KEY: !LIVEKIT_API_KEY,
        LIVEKIT_API_SECRET: !LIVEKIT_API_SECRET
      }
    });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const room = clean(payload.room);
  let user;
  try {
    user = await verifyFirebaseUser(event);
  } catch (error) {
    return json(401, { error: error?.message || 'Unauthorized' });
  }

  const identity = user.uid;
  const name = clean(payload.name, user.name || identity);
  const metadata = clean(payload.metadata);
  if (!room) return json(400, { error: 'Missing room' });

  try {
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name,
      metadata,
      ttl: '2h'
    });

    token.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    });

    return json(200, {
      url: LIVEKIT_URL,
      token: await token.toJwt()
    });
  } catch (error) {
    return json(500, {
      error: 'LiveKit token generation failed.',
      detail: error?.message || String(error)
    });
  }
}
