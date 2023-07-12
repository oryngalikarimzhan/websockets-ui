import { WebSocketServer } from 'ws';

import { UsersController } from '../controllers/UsersController';
import { GameRoomsController } from '../controllers/GameRoomsController';
import { CustomWebSocket, SocketMessage } from './utils';
// import { GameController } from '../controllers/GameController';

export class MessageHandler {
  usersController = new UsersController();
  gameRoomsController = new GameRoomsController();
  // gameController = new GameController();

  constructor(public wss: WebSocketServer) {}

  respondAll() {
    this.gameRoomsController.sendFreeRooms(this.wss);
    this.usersController.sendWinners(this.wss);
  }

  handleReg(ws: CustomWebSocket, message: SocketMessage) {
    this.usersController.registerUser(message, ws);
    this.respondAll();
  }

  handleCreateRoom(ws: CustomWebSocket) {
    this.gameRoomsController.createNewRoom(ws);
    this.respondAll();
  }

  handleAddUserToRoom(ws: CustomWebSocket, message: SocketMessage) {
    const roomId = JSON.parse(message.data).indexRoom;
    this.gameRoomsController.addUserToRoom(roomId, ws);
    this.respondAll();
    this.gameRoomsController.createGame(roomId);
  }

  handleAddShips(message: SocketMessage) {
    this.gameRoomsController.addPlayerShips(message);
  }
}
