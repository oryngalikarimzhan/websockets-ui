import { WebSocketServer } from 'ws';

import { CustomWebSocket, SocketMessage } from '../app/utils';
import { User } from '../models/User';
import { usersDB } from '../db/inMemoryDB';

export class PlayersController {
  registerUser({ data, ...rest }: SocketMessage, ws: CustomWebSocket) {
    const user = JSON.parse(data) as User;

    const { name } = user;

    if (!usersDB.find((userItem) => userItem.name === name)) {
      usersDB.push({ name, user, wins: 0 });

      ws.userName = name;

      const index = usersDB.findIndex(
        (userItem) => userItem.user.name === name,
      );

      ws.send(
        JSON.stringify({
          ...rest,
          data: JSON.stringify({
            name,
            index,
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
      .map(({ name, wins }) => ({
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
