# Phoenix Messenger Calling

Phoenix Messenger uses WebRTC for browser calling.

## Current mode

Firestore is used for signaling only:

- `calls/{callId}`
- `calls/{callId}/signals/{signalId}`

Audio does not travel through Firestore.

## Discord-like reliability

Discord routes voice through voice servers. For Phoenix Messenger, the closest practical step is a TURN relay server. TURN carries media when direct peer-to-peer audio cannot connect.

Set these environment variables in Netlify:

```text
VITE_TURN_URL=turn:your-turn-server.example.com:3478
VITE_TURN_USERNAME=your-turn-username
VITE_TURN_CREDENTIAL=your-turn-password
VITE_FORCE_TURN=false
```

Use `VITE_FORCE_TURN=true` for testing if you want to force all call audio through the relay.

## Netlify

After changing environment variables:

1. Go to Netlify site settings.
2. Open Environment variables.
3. Add the `VITE_*` values.
4. Redeploy the site.

## TURN server options

You can use:

- a managed TURN provider
- a self-hosted `coturn` server
- a future dedicated voice/media server for group voice

For one-to-one calls, TURN is enough to make calls much more reliable. For Discord-style group voice, add an SFU/media server later.
