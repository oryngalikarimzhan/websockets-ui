import WebSocket from 'ws';
import { IncomingMessage } from 'http';

import { wss } from '..';

export type SocketMessage = {
  type: string;
  data: string;
  id: 0;
};

export interface CustomWebSocket extends WebSocket {
  userName: string;
  isAlive: boolean;
}

export const interval = setInterval(function ping() {
  wss.clients.forEach(function each(wsClient: WebSocket) {
    const ws = wsClient as CustomWebSocket;

    if (ws.isAlive === false) {
      return ws.terminate();
    }

    ws.isAlive = false;
    ws.ping();
  });
}, 15000);

export function identifyRequestAndLog({ headers }: IncomingMessage) {
  if (headers.upgrade === 'websocket' && headers.connection === 'Upgrade') {
    const webSocketKey = headers['sec-websocket-key'];

    return console.log('WebSocket connection established. Key:', webSocketKey);
  }

  console.log('HTTP Request received');
}

export function generateMessageText(type: string, data: unknown) {
  return JSON.stringify({
    type,
    data: JSON.stringify(data),
    id: 0,
  });
}
