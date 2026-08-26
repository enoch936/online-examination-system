const DEFAULT_STUN_SERVERS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
  'stun:stun.services.mozilla.com',
];

/**
 * ICE servers for the live-proctoring WebRTC connections.
 * STUN is enough for most home networks; a TURN server (env-configured)
 * is required behind symmetric NATs / strict firewalls.
 */
export function getIceServers(): RTCIceServer[] {
  const stunList = (process.env.NEXT_PUBLIC_STUN_SERVERS ?? DEFAULT_STUN_SERVERS.join(','))
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  const iceServers: RTCIceServer[] = [{ urls: stunList }];

  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL?.trim();
  if (turnUrl) {
    iceServers.push({
      urls: turnUrl.split(',').map((url) => url.trim()),
      username: process.env.NEXT_PUBLIC_TURN_USERNAME || undefined,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || undefined,
    });
  }

  return iceServers;
}
