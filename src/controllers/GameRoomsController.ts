import { WebSocketServer } from 'ws';

import { CustomWebSocket } from '../app/utils';
import { gameRoomsDB } from '../db/inMemoryDB';
import { Ship } from '../models/Ship';
import { Player } from '../models/Player';

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
    const hasRoom = Object.entries(gameRoomsDB).find(
      ([, value]) => value.adminUserName === ws.userName,
    );

    if (hasRoom) return;

    gameRoomsDB[this.roomsCounter] = {
      gameRoomId: this.roomsCounter,
      adminUserName: ws.userName,
      currentPlayerId: -1,
      players: [{ ws, index: 0, gameRoomId: this.roomsCounter }],
    };

    this.roomsCounter++;
    return true;
  }

  addUserToRoom(roomId: number, ws: CustomWebSocket) {
    const roomData = gameRoomsDB[roomId];

    const players = roomData?.players;
    const firstPlayer = players?.[0];

    if (
      !roomData ||
      !firstPlayer ||
      players.length !== 1 ||
      roomData?.adminUserName === ws.userName
    )
      return;

    gameRoomsDB[roomId] = {
      ...roomData,
      players: [firstPlayer, { ws, index: 1, gameRoomId: roomId }],
    };

    return true;
  }

  addPlayerShips(dataString: string) {
    const { gameId, indexPlayer, ships } = JSON.parse(dataString);

    const roomData = gameRoomsDB[gameId];
    const players = roomData?.players;
    const player = players?.[indexPlayer];

    if (!roomData || !player) return;

    player.ships = ships;
    player.gameBoard = this.buildGameBoard(player.ships);

    if (players.every((player) => !!player.ships)) {
      roomData.currentPlayerId = player.index;

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

      this.sendTurn(gameId, player.index === 1 ? 0 : 1);
    }
  }

  private sendTurn(gameId: number, nextPlayerId?: number) {
    const roomData = gameRoomsDB[gameId];

    if (!roomData || !roomData.players) return;

    if (nextPlayerId !== undefined) {
      roomData.currentPlayerId = nextPlayerId;
    }

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

  makeAttack(dataString: string) {
    const { gameId, indexPlayer, x, y } = JSON.parse(dataString);
    const dataRoom = gameRoomsDB[gameId];
    const opponentPlayerId = indexPlayer === 1 ? 0 : 1;
    const players = dataRoom?.players;
    const opponent = players?.[opponentPlayerId];

    if (!dataRoom || dataRoom.currentPlayerId !== indexPlayer || !opponent)
      return;

    const attackResult = this.getAttackResult(opponent, x, y);

    if (!attackResult) return;

    const { status, shipIndex } = attackResult;

    if (status === 'killed') {
      this.markKilledShipAround(dataRoom, opponent, shipIndex);
    }

    players.forEach(({ ws }) =>
      ws.send(
        JSON.stringify({
          type: 'attack',
          data: JSON.stringify({
            position: {
              x,
              y,
            },
            currentPlayer: indexPlayer,
            status,
          }),
          id: 0,
        }),
      ),
    );

    this.sendTurn(gameId, status === 'miss' ? opponentPlayerId : undefined);
  }

  private markKilledShipAround(
    dataRoom: {
      gameRoomId: number;
      adminUserName: string;
      currentPlayerId: number;
      players: Player[];
    },
    opponentPlayer: Player,
    shipIndex: number,
  ) {
    const ship = opponentPlayer.ships?.[shipIndex];

    if (!ship) return;

    const { x, y } = ship.position;

    for (let i = -1; i < ship.length + 1; i++) {
      for (let j = -1; j < 2; j++) {
        const newX = x + j;
        const newY = y + i;

        const cell = ship.direction
          ? opponentPlayer.gameBoard?.[x + j]?.[y + i]
          : opponentPlayer.gameBoard?.[x + i]?.[y + j];

        if (!cell || cell.isAttacked) continue;

        cell.isAttacked = true;

        dataRoom.players.forEach(({ ws }) =>
          ws.send(
            JSON.stringify({
              type: 'attack',
              data: JSON.stringify({
                position: {
                  x: newX,
                  y: newY,
                },
                currentPlayer: dataRoom.currentPlayerId,
                status: 'miss',
              }),
              id: 0,
            }),
          ),
        );

        this.sendTurn(dataRoom.gameRoomId);
      }
    }
  }

  private getAttackResult(opponentPlayer: Player, x: number, y: number) {
    const cell = opponentPlayer.gameBoard?.[x]?.[y];

    if (!cell || cell.isAttacked) return;

    cell.isAttacked = true;
    const { shipIndex } = cell;

    if (shipIndex === -1) {
      return { status: 'miss', shipIndex };
    }

    if (shipIndex !== -1) {
      const ship = opponentPlayer.ships?.[shipIndex];

      if (!ship || !ship.hp) return;

      ship.hp -= 1;

      return { status: ship.hp === 0 ? 'killed' : 'shot', shipIndex };
    }
  }

  private buildGameBoard(ships: Ship[] | undefined) {
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
