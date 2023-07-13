import { SocketMessage } from './../app/utils';
import { WebSocketServer } from 'ws';

import { CustomWebSocket } from '../app/utils';
import { gameRoomsDB } from '../db/inMemoryDB';
import { Ship } from '../models/Ship';

export class GameRoomsController {
  roomsCounter = 1;

  sendFreeRooms(wss: WebSocketServer) {
    const freeRooms = Object.keys(gameRoomsDB)
      .filter((id) => gameRoomsDB[+id]?.players.length === 1)
      .map((id) => ({
        roomId: id,
        roomUsers: gameRoomsDB[+id]?.players.map(
          ({ ws: { userName }, index }) => ({
            name: userName,
            index,
          }),
        ),
      }));

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
    gameRoomsDB[roomId]?.players?.forEach(({ ws, index }) =>
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
    gameRoomsDB[this.roomsCounter] = {
      isStarted: false,
      currentPlayerId: -1,
      players: [{ ws, index: 0, gameRoomId: this.roomsCounter }],
    };

    this.roomsCounter++;
  }

  addUserToRoom(roomId: number, ws: CustomWebSocket) {
    const roomData = gameRoomsDB[roomId];

    if (!roomData || !roomData.players[0] || roomData.players.length !== 1)
      return;

    gameRoomsDB[roomId] = {
      ...roomData,
      players: [roomData.players[0], { ws, index: 1, gameRoomId: roomId }],
    };
  }

  addPlayerShips(message: SocketMessage) {
    const data = JSON.parse(message.data);

    const roomData = gameRoomsDB[data.gameId];

    if (!roomData || !roomData.players) return;

    const player = roomData.players[data.indexPlayer];

    if (!player) return;

    player.ships = data.ships;
    player.map = this.buildMap(player.ships);

    if (roomData.players.every((player) => player.ships)) {
      roomData.isStarted = true;
      roomData.currentPlayerId = player.index;

      roomData.players.forEach(({ ws, ships }) =>
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

  sendTurn(gameId: number) {
    const roomData = gameRoomsDB[gameId];

    if (!roomData || !roomData.players) return;

    roomData.players.forEach(({ ws }) =>
      ws.send(
        JSON.stringify({
          type: 'turn',
          data: JSON.stringify({
            currentPlayer: roomData.currentPlayerId,
          }),
          id: 0,
        }),
      ),
    );
  }

  private buildMap(ships: Ship[] | undefined) {
    if (!ships) return;

    const map = Array.from({ length: 10 }, () =>
      Array.from({ length: 10 }, () => ({
        ...{ shipIndex: -1, isAttacked: false },
      })),
    );

    ships.forEach((ship, index) => {
      ship.hp = ship.length;

      const { x, y } = ship.position;

      for (let i = 0; i < ship.length; i++) {
        const cell = ship.direction ? map[x]?.[y + i] : map[x + i]?.[y];

        if (cell && cell.shipIndex === -1) {
          cell.shipIndex = index;
        }
      }
    });

    return map;
  }
}
