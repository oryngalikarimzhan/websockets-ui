import { WebSocketServer } from 'ws';

import {
  CustomWebSocket,
  SocketMessage,
  generateMessageText,
} from '../app/utils';
import { usersDB } from '../db/inMemoryDB';

export class UsersController {
  usersCounter = 1;

  registerUser({ data, type }: SocketMessage, ws: CustomWebSocket) {
    const userDto = JSON.parse(data);
    const { name } = userDto;

    if (!usersDB[name]) {
      usersDB[name] = { ...userDto, ws, wins: 0 };

      ws.userName = name;

      ws.send(
        generateMessageText(type, {
          name,
          index: this.usersCounter++,
          error: false,
          errorText: '',
        }),
      );
    } else {
      ws.send(
        generateMessageText(type, {
          name,
          index: -1,
          error: true,
          errorText: 'The user with this name already exists',
        }),
      );
    }
  }

  sendWinnersListMessage(wss: WebSocketServer) {
    const winnersList = Object.entries(usersDB)
      .filter(([, user]) => user.wins > 0)
      .map(([name, user]) => ({
        name,
        wins: user.wins,
      }));

    wss.clients.forEach((client) =>
      client.send(generateMessageText('update_winners', winnersList)),
    );
  }

  addWinner(userName: string) {
    const user = usersDB[userName];

    if (user) user.wins += 1;
  }
}
