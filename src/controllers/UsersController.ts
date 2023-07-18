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
    const { name, password } = userDto;
    const user = usersDB[name];

    if (!user) {
      const index = this.usersCounter++;
      usersDB[name] = { ...userDto, ws, wins: 0, index };

      ws.userName = name;

      ws.send(
        generateMessageText(type, {
          name,
          index,
          error: false,
          errorText: '',
        }),
      );
    } else {
      if (user.ws.isAlive) {
        return ws.send(
          generateMessageText(type, {
            name,
            index: -1,
            error: true,
            errorText: 'User with this username is already exists',
          }),
        );
      }

      if (user.password !== password) {
        return ws.send(
          generateMessageText(type, {
            name,
            index: -1,
            error: true,
            errorText: 'Password is incorrect',
          }),
        );
      }

      ws.userName = name;
      user.ws = ws;

      ws.send(
        generateMessageText(type, {
          name,
          index: user.index,
          error: false,
          errorText: '',
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
