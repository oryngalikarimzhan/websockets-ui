import { WebSocketServer } from 'ws';

import { UsersController } from '../controllers/UsersController';
import { GameRoomsController } from '../controllers/GameRoomsController';
import { CustomWebSocket, SocketMessage } from './utils';

export class WebSocketServerManager {
  usersController = new UsersController();
  gameRoomsController = new GameRoomsController();

  constructor(public wss: WebSocketServer) {}

  handleReg(ws: CustomWebSocket, message: SocketMessage) {
    this.usersController.registerUser(message, ws);
    this.respondAll();
  }

  handleCreateRoom(ws: CustomWebSocket) {
    const roomId = this.gameRoomsController.createNewRoom(ws);

    if (roomId) {
      this.respondAll();
    }
  }

  handleAddUserToRoom(ws: CustomWebSocket, message: SocketMessage) {
    const roomId = this.gameRoomsController.addUserToRoom(message.data, ws);

    if (roomId) {
      this.respondAll();
      this.gameRoomsController.createGame(roomId);
    }
  }

  handleAddShips(message: SocketMessage) {
    this.gameRoomsController.addPlayerShips(message.data);
  }

  handleAttack(message: SocketMessage) {
    const winnerUserName = this.gameRoomsController.makeAttack(message.data);

    if (winnerUserName) {
      this.usersController.addWinner(winnerUserName);
      this.respondAll();
    }
  }

  handleRandomAttack(message: SocketMessage) {
    this.gameRoomsController.makeRandomAttack(message.data);
  }

  handleSinglePlay(ws: CustomWebSocket) {
    this.gameRoomsController.createSinglePlayGame(ws);
  }

  cleanUp(ws: CustomWebSocket) {
    this.gameRoomsController.deleteRoom(ws);
  }

  private respondAll() {
    this.gameRoomsController.sendFreeRooms(this.wss);
    this.usersController.sendWinnersListMessage(this.wss);
  }
}
