import { WebSocketServer } from 'ws';

import { CustomWebSocket } from '../app/utils';
import { gameRoomsDB } from '../db/inMemoryDB';
import { GameRoom, Player, Ship } from '../db/models';
import { generateMessageText } from '../app/utils';

export class GameRoomsController {
  roomsCounter = 1;

  sendFreeRooms(wss: WebSocketServer) {
    const freeRooms = Object.entries(gameRoomsDB)
      .filter(([, gameRoom]) => gameRoom.players.length === 1)
      .map(([id, gameRoom]) => ({
        roomId: id,
        roomUsers: gameRoom.players.map(({ ws: { userName }, index }) => ({
          name: userName,
          index,
        })),
      }));

    wss.clients.forEach((client) => {
      return client.send(generateMessageText('update_room', freeRooms));
    });
  }

  createGame(roomId: number) {
    gameRoomsDB[roomId]?.players?.forEach(({ ws, index }) =>
      ws.send(
        generateMessageText('create_game', {
          idGame: roomId,
          idPlayer: index,
        }),
      ),
    );
  }

  createNewRoom(ws: CustomWebSocket) {
    const hasRoom = Object.entries(gameRoomsDB).find(
      ([, gameRoom]) => gameRoom.adminUserName === ws.userName,
    );

    if (hasRoom) return;

    gameRoomsDB[this.roomsCounter] = {
      gameRoomId: this.roomsCounter,
      adminUserName: ws.userName,
      currentPlayerId: -1,
      players: [{ ws, index: 0 }],
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
      players: [firstPlayer, { ws, index: 1 }],
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
      players.forEach(({ ws, ships }) =>
        ws.send(
          generateMessageText('start_game', {
            currentPlayerIndex: player.index,
            ships,
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
        generateMessageText('turn', {
          currentPlayer: roomData.currentPlayerId,
        }),
      ),
    );
  }

  makeAttack(dataString: string) {
    const { gameId, indexPlayer, x, y } = JSON.parse(dataString);
    const dataRoom = gameRoomsDB[gameId];
    const players = dataRoom?.players;

    const opponentPlayerId = indexPlayer === 1 ? 0 : 1;
    const opponent = players?.[opponentPlayerId];
    const currentPlayer = players?.[indexPlayer];

    if (
      !dataRoom ||
      dataRoom.currentPlayerId !== indexPlayer ||
      !opponent ||
      !currentPlayer
    )
      return;

    const attackResult = this.getAttackResult(opponent, x, y);

    if (!attackResult) return;

    const { status, shipIndex } = attackResult;

    let isWin = false;

    if (status === 'killed') {
      this.markKilledShipAround(dataRoom, opponent, shipIndex);
      isWin = !!opponent.ships?.every((ship) => ship.hp === 0);
    }

    players.forEach(({ ws }) =>
      ws.send(
        generateMessageText('attack', {
          position: {
            x,
            y,
          },
          currentPlayer: indexPlayer,
          status,
        }),
      ),
    );

    if (isWin) {
      this.finishGame(players, indexPlayer);

      this.deleteRoom(gameId);

      return currentPlayer.ws.userName;
    }

    this.sendTurn(gameId, status === 'miss' ? opponentPlayerId : undefined);
  }

  makeRandomAttack(dataString: string) {
    const { gameId, indexPlayer } = JSON.parse(dataString);

    const opponentPlayerId = indexPlayer === 1 ? 0 : 1;
    const opponent = gameRoomsDB[gameId]?.players?.[opponentPlayerId];

    if (!opponent) return;

    let isValidPosition = false;
    let x = -1;
    let y = -1;

    while (!isValidPosition) {
      const [randomX, randomY] = Array.from({ length: 2 }, () =>
        Math.round(Math.random() * 9),
      );

      if (!randomX || !randomY) continue;

      const cell = opponent.gameBoard?.[randomX]?.[randomY];

      if (!cell || cell.isAttacked) continue;

      isValidPosition = true;
      x = randomX;
      y = randomY;
    }

    this.makeAttack(JSON.stringify({ gameId, indexPlayer, x, y }));
  }

  finishGame(players: Player[], winnerPlayerIndex: number) {
    players.forEach(({ ws }) => {
      ws.send(
        generateMessageText('finish', {
          winPlayer: winnerPlayerIndex,
        }),
      );
    });
  }

  deleteRoom(gameId: number) {
    delete gameRoomsDB?.[gameId];
  }

  private markKilledShipAround(
    dataRoom: GameRoom,
    opponentPlayer: Player,
    shipIndex: number,
  ) {
    const ship = opponentPlayer.ships?.[shipIndex];

    if (!ship) return;

    const { x, y } = ship.position;

    for (let i = -1; i < ship.length + 1; i++) {
      for (let j = -1; j < 2; j++) {
        const newX = ship.direction ? x + j : x + i;
        const newY = ship.direction ? y + i : y + j;

        const cell = opponentPlayer.gameBoard?.[newX]?.[newY];

        if (!cell || cell.isAttacked) continue;

        cell.isAttacked = true;

        dataRoom.players.forEach(({ ws }) =>
          ws.send(
            generateMessageText('attack', {
              position: {
                x: newX,
                y: newY,
              },
              currentPlayer: dataRoom.currentPlayerId,
              status: 'miss',
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

    const board = Array.from({ length: 10 }, () =>
      Array.from({ length: 10 }, () => ({
        ...{ shipIndex: -1, isAttacked: false },
      })),
    );

    ships.forEach((ship, index) => {
      ship.hp = ship.length;

      const { x, y } = ship.position;

      for (let i = 0; i < ship.length; i++) {
        const cell = ship.direction ? board[x]?.[y + i] : board[x + i]?.[y];

        if (cell && cell.shipIndex === -1) {
          cell.shipIndex = index;
        }
      }
    });

    return board;
  }
}
