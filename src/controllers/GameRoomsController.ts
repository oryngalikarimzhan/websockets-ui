import { SocketMessage } from './../app/utils';
import { WebSocketServer } from 'ws';

import { CustomWebSocket } from '../app/utils';
import { gameRoomsDB } from '../db/inMemoryDB';

export class GameRoomsController {
  roomsCounter = 1;

  sendFreeRooms(wss: WebSocketServer) {
    const freeRooms: {
      roomId: number;
      roomUsers: { name: string; index: number }[];
    }[] = [];
    gameRoomsDB.forEach((players, gameRoomId) => {
      if (players.length === 1) {
        freeRooms.push({
          roomId: gameRoomId,
          roomUsers: players.map(({ ws: { userName }, index }) => ({
            name: userName,
            index,
          })),
        });
      }
    });

    wss.clients.forEach((client) =>
      client.send(
        JSON.stringify({
          type: 'update_room',
          data: JSON.stringify(freeRooms),
          id: 0,
        }),
      ),
    );
  }

  createGame(roomId: number) {
    gameRoomsDB.get(roomId)?.forEach(({ ws, index }) =>
      ws.send(
        JSON.stringify({
          type: 'create_game',
          data: JSON.stringify({
            idGame: roomId,
            idPlayer: index,
          }),
          id: 0,
        }),
      ),
    );
  }

  createNewRoom(ws: CustomWebSocket) {
    gameRoomsDB.set(this.roomsCounter, [
      { ws, index: 0, gameRoomId: this.roomsCounter },
    ]);

    this.roomsCounter++;
  }

  addUserToRoom(roomId: number, ws: CustomWebSocket) {
    const players = gameRoomsDB.get(roomId);

    if (players && players[0]) {
      gameRoomsDB.set(roomId, [
        players[0],
        { ws, index: 1, gameRoomId: roomId },
      ]);
    }
  }

  addPlayerShips(message: SocketMessage) {
    const data = JSON.parse(message.data);

    const players = gameRoomsDB.get(data.gameId);

    const player = players?.find((player) => player.index === data.indexPlayer);

    if (players && player) {
      player.ships = data.ships;

      if (players.every((player) => player.ships)) {
        players.forEach(({ ws, ships }) =>
          ws.send(
            JSON.stringify({
              type: 'start_game',
              data: JSON.stringify({
                currentPlayerIndex: player.index,
                ships,
              }),
              id: 0,
            }),
          ),
        );
      }
    }
  }
}
