import { WebSocketServer } from 'ws';

import { CustomWebSocket, SocketMessage } from '../app/utils';
import { User } from '../models/User';
import { usersDB } from '../db/inMemoryDB';

export class UsersController {
  usersCounter = 1;

  registerUser({ data, ...rest }: SocketMessage, ws: CustomWebSocket) {
    const user = JSON.parse(data) as User;

    const { name } = user;

    if (!usersDB.find(({ user }) => user.name === name)) {
      usersDB.push({ user, wins: 0 });

      ws.userName = name;

      ws.send(
        JSON.stringify({
          ...rest,
          data: JSON.stringify({
            name,
            index: this.usersCounter++,
            error: false,
            errorText: '',
          }),
        }),
      );
    } else {
      ws.send(
        JSON.stringify({
          ...rest,
          data: JSON.stringify({
            name,
            index: -1,
            error: true,
            errorText: 'The user with this name already exists',
          }),
        }),
      );
    }
  }

  sendWinners(wss: WebSocketServer) {
    const winnersList = usersDB
      .filter(({ wins }) => wins > 0)
      .map(({ user: { name }, wins }) => ({
        name,
        wins,
      }));

    wss.clients.forEach((client) =>
      client.send(
        JSON.stringify({
          type: 'update_winners',
          data: JSON.stringify(winnersList),
          id: 0,
        }),
      ),
    );
  }
}
