import { WebSocketServer } from 'ws';

import { PlayersController } from '../controllers/PlayersController';
import { RoomsController } from '../controllers/RoomsController';
import { CustomWebSocket, SocketMessage } from './utils';

export class MessageHandler {
  playersController = new PlayersController();
  roomsController = new RoomsController();

  constructor(public wss: WebSocketServer) {}

  respondAll() {
    this.roomsController.sendFreeRooms(this.wss);
    this.playersController.sendWinners(this.wss);
  }

  handleReg(ws: CustomWebSocket, message: SocketMessage) {
    this.playersController.registerUser(message, ws);
    this.respondAll();
  }

  handleCreateRoom(ws: CustomWebSocket) {
    this.roomsController.createNewRoom(ws);
    this.respondAll();
  }

  handleAddUserToRoom(ws: CustomWebSocket, message: SocketMessage) {
    const roomId = JSON.parse(message.data).indexRoom;
    this.roomsController.addUserToRoom(roomId, ws);
    this.respondAll();
    this.roomsController.createGame(roomId);
  }
}
