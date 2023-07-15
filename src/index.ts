import 'dotenv/config';
import WebSocket, { WebSocketServer } from 'ws';

import { httpServer } from './http_server/index';
import { MessageHandler } from './app/MessageHandler';
import {
  CustomWebSocket,
  SocketMessage,
  identifyRequestAndLog,
  interval,
} from './app/utils';

const HTTP_PORT = +(process.env.HTTP_PORT || 3000);
export const wss = new WebSocketServer({ server: httpServer });
const messageHandler = new MessageHandler(wss);

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

  ws.on('close', (code) => {
    console.log(code);
  });

  ws.on('message', (rawMessage: WebSocket.RawData) => {
    const message: SocketMessage = JSON.parse(rawMessage.toString());

    switch (message.type) {
      case 'reg': {
        messageHandler.handleReg(ws, message);
        break;
      }

      case 'create_room': {
        messageHandler.handleCreateRoom(ws);
        break;
      }

      case 'add_user_to_room': {
        messageHandler.handleAddUserToRoom(ws, message);
        break;
      }

      case 'add_ships': {
        messageHandler.handleAddShips(message);
        break;
      }

      case 'attack': {
        messageHandler.handleAttack(message);
        break;
      }

      case 'randomAttack': {
        messageHandler.handleRandomAttack(message);
        break;
      }

      case 'single_play': {
        messageHandler.handleSinglePlay(ws);
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
