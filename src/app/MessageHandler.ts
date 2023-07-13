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

  respondTurn(gameId: number) {
    this.gameRoomsController.sendTurn(gameId);
  }

  handleReg(ws: CustomWebSocket, message: SocketMessage) {
    this.usersController.registerUser(message, ws);
    this.respondAll();
  }

  handleCreateRoom(ws: CustomWebSocket) {
    const isSuccess = this.gameRoomsController.createNewRoom(ws);
    isSuccess && this.respondAll();
  }

  handleAddUserToRoom(ws: CustomWebSocket, message: SocketMessage) {
    const roomId = JSON.parse(message.data).indexRoom;
    const isSuccess = this.gameRoomsController.addUserToRoom(roomId, ws);
    if (isSuccess) {
      this.respondAll();
      this.gameRoomsController.createGame(roomId);
    }
  }

  handleAddShips(message: SocketMessage) {
    const gameId = JSON.parse(message.data).gameId;
    this.gameRoomsController.addPlayerShips(message);
    this.respondTurn(gameId);
  }
}
