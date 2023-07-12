import { WebSocketServer } from 'ws';

import { CustomWebSocket } from '../app/utils';
import { roomsDB } from '../db/inMemoryDB';

export class RoomsController {
  roomsCounter = 1;

  sendFreeRooms(wss: WebSocketServer) {
    const freeRooms = roomsDB
      .filter((roomItem) => roomItem.roomUsers.length === 1)
      .map(({ roomId, roomUsers }) => ({
        roomId,
        roomUsers: roomUsers.map(({ ws: { userName }, index }) => ({
          name: userName,
          index,
        })),
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

  getRoomById(roomId: number) {
    return roomsDB.find((roomItem) => roomItem.roomId === roomId);
  }

  createGame(roomId: number) {
    this.getRoomById(roomId)?.roomUsers.forEach(({ ws, index }) =>
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
    roomsDB.push({
      roomId: this.roomsCounter,
      roomUsers: [{ ws, index: 0 }],
    });
    this.roomsCounter++;
  }

  addUserToRoom(roomId: number, ws: CustomWebSocket) {
    this.getRoomById(roomId)?.roomUsers.push({ ws, index: 1 });
  }
}
