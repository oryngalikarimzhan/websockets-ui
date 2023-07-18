import 'dotenv/config';
import WebSocket, { WebSocketServer } from 'ws';

import { httpServer } from './http_server/index';
import { WebSocketServerManager } from './app/WebSocketServerManager';
import {
  CustomWebSocket,
  SocketMessage,
  identifyRequestAndLog,
  interval,
} from './app/utils';

const HTTP_PORT = +(process.env.HTTP_PORT || 3000);
export const wss = new WebSocketServer({ server: httpServer });
const serverManager = new WebSocketServerManager(wss);

httpServer.listen(HTTP_PORT, () =>
  console.log(`Start static http server on the ${HTTP_PORT} port!`),
);

wss.on('connection', function connection(ws: CustomWebSocket, req) {
  ws.isAlive = true;

  identifyRequestAndLog(req);

  ws.on('error', console.error);

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('close', () => {
    serverManager.cleanUp(ws);
  });

  ws.on('message', (rawMessage: WebSocket.RawData) => {
    const message: SocketMessage = JSON.parse(rawMessage.toString());

    switch (message.type) {
      case 'reg': {
        serverManager.handleReg(ws, message);
        break;
      }

      case 'create_room': {
        serverManager.handleCreateRoom(ws);
        break;
      }

      case 'add_user_to_room': {
        serverManager.handleAddUserToRoom(ws, message);
        break;
      }

      case 'add_ships': {
        serverManager.handleAddShips(message);
        break;
      }

      case 'attack': {
        serverManager.handleAttack(message);
        break;
      }

      case 'randomAttack': {
        serverManager.handleRandomAttack(message);
        break;
      }

      case 'single_play': {
        serverManager.handleSinglePlay(ws);
        break;
      }
    }
  });
});

process.on('SIGINT', () => {
  clearInterval(interval);

  wss.clients.forEach((client: WebSocket) => {
    if (client.readyState === WebSocket.OPEN) {
      client.close();
    }
  });

  wss.close();
  httpServer.close();
  process.exit();
});
