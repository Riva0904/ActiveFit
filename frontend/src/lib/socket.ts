import { io, Socket } from 'socket.io-client';
import { authApi } from './api';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    // The httpOnly ab_token cookie is scoped to the Vercel proxy origin (REST calls go
    // through it — see next.config.js rewrites) and never reaches Render's socket origin
    // cross-domain. So instead of relying on the cookie, fetch a short-lived token over
    // the cookie-authenticated REST proxy and pass it explicitly in the handshake.
    // `auth` as a function re-runs on every (re)connection attempt, since the token
    // expires in 60s and a dropped connection may reconnect well after that.
    const backendOrigin = process.env.NEXT_PUBLIC_BACKEND_ORIGIN
      ?? process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '')
      ?? 'http://localhost:3001';
    socket = io(backendOrigin, {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: (cb) => {
        authApi.getSocketToken()
          .then((res: any) => cb({ token: res.token }))
          .catch(() => cb({}));
      },
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
