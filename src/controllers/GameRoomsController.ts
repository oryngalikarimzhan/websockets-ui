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
      .map(([id, gameRoom]) => {
        const firstPlayer = gameRoom.players[0];

        return {
          roomId: id,
          roomUsers: [
            {
              name: firstPlayer?.ws?.userName,
              index: firstPlayer?.index,
            },
          ],
        };
      });

    wss.clients.forEach((client) => {
      return client.send(generateMessageText('update_room', freeRooms));
    });
  }

  createGame(roomId: number) {
    gameRoomsDB[roomId]?.players?.forEach(
      ({ ws, index }) =>
        ws &&
        ws.send(
          generateMessageText('create_game', {
            idGame: roomId,
            idPlayer: index,
          }),
        ),
    );
  }

  createNewRoom(ws: CustomWebSocket) {
    const room = Object.entries(gameRoomsDB).find(
      ([, gameRoom]) => gameRoom.adminUserName === ws.userName,
    );

    if (room) return;

    const newRoomId = this.roomsCounter++;

    gameRoomsDB[newRoomId] = {
      gameRoomId: newRoomId,
      adminUserName: ws.userName,
      currentPlayerId: -1,
      players: [{ ws, index: 0, isBot: false }],
    };

    return { roomId: newRoomId, gameRoom: gameRoomsDB[newRoomId] as GameRoom };
  }

  addUserToRoom(dataString: string, ws: CustomWebSocket) {
    const roomId = JSON.parse(dataString).indexRoom;
    const gameRoom = gameRoomsDB[roomId];
    const players = gameRoom?.players;
    const firstPlayer = players?.[0];

    if (
      !gameRoom ||
      !firstPlayer ||
      players.length !== 1 ||
      gameRoom?.adminUserName === ws.userName
    )
      return;

    gameRoomsDB[roomId] = {
      ...gameRoom,
      players: [firstPlayer, { ws, index: 1, isBot: false }],
    };

    return roomId;
  }

  addPlayerShips(dataString: string) {
    const { gameId, indexPlayer, ships } = JSON.parse(dataString);

    const gameRoom = gameRoomsDB[gameId];
    const players = gameRoom?.players;
    const player = players?.[indexPlayer];

    if (!gameRoom || !player) return;

    player.ships = ships;
    player.gameBoard = this.buildGameBoard(player.ships);

    if (players.every((player) => !!player.ships)) {
      players.forEach(
        ({ ws, ships }) =>
          ws &&
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
    const gameRoom = gameRoomsDB[gameId];

    if (!gameRoom || !gameRoom.players) return;

    if (nextPlayerId !== undefined) {
      gameRoom.currentPlayerId = nextPlayerId;
    }

    gameRoom.players.forEach(({ ws, isBot, index }) => {
      ws &&
        ws.send(
          generateMessageText('turn', {
            currentPlayer: gameRoom.currentPlayerId,
          }),
        );

      if (isBot && gameRoom.currentPlayerId === index) {
        setTimeout(() => {
          this.makeRandomAttack(JSON.stringify({ gameId, indexPlayer: index }));
        }, 1000);
      }
    });
  }

  makeAttack(dataString: string) {
    const { gameId, indexPlayer, x, y } = JSON.parse(dataString);
    const opponentPlayerId = indexPlayer === 1 ? 0 : 1;

    const gameRoom = gameRoomsDB[gameId];
    const players = gameRoom?.players;
    const opponentPlayer = players?.[opponentPlayerId];
    const currentPlayer = players?.[indexPlayer];

    if (
      !gameRoom ||
      gameRoom.currentPlayerId !== indexPlayer ||
      !opponentPlayer ||
      !currentPlayer
    )
      return;

    const attackResult = this.getAttackResult(opponentPlayer, x, y);

    if (!attackResult) return;

    const { status, shipIndex } = attackResult;

    let isWin = false;

    if (status === 'killed') {
      this.markKilledShipAround(gameRoom, opponentPlayer, shipIndex);
      isWin = !!opponentPlayer.ships?.every((ship) => ship.hp === 0);
    }

    players.forEach(
      ({ ws }) =>
        ws &&
        ws.send(
          generateMessageText('attack', {
            position: { x, y },
            currentPlayer: indexPlayer,
            status,
          }),
        ),
    );

    if (isWin) {
      this.finishGame(players, indexPlayer);

      delete gameRoomsDB?.[gameId];

      return opponentPlayer.isBot || currentPlayer.isBot
        ? undefined
        : currentPlayer.ws?.userName;
    }

    this.sendTurn(gameId, status === 'miss' ? opponentPlayerId : undefined);
  }

  makeRandomAttack(dataString: string) {
    const { gameId, indexPlayer } = JSON.parse(dataString);

    const opponentPlayerId = indexPlayer === 1 ? 0 : 1;
    const opponentPlayer = gameRoomsDB[gameId]?.players?.[opponentPlayerId];

    if (!opponentPlayer) return;

    while (true) {
      const x = Math.floor(Math.random() * 10);
      const y = Math.floor(Math.random() * 10);

      const cell = opponentPlayer.gameBoard?.[x]?.[y];

      if (!cell || cell.isAttacked) continue;

      this.makeAttack(JSON.stringify({ gameId, indexPlayer, x, y }));
      break;
    }
  }

  finishGame(players: Player[], winnerPlayerIndex: number) {
    players.forEach(({ ws }) => {
      ws &&
        ws.send(
          generateMessageText('finish', {
            winPlayer: winnerPlayerIndex,
          }),
        );
    });
  }

  createSinglePlayGame(ws: CustomWebSocket) {
    const gameRoom = Object.entries(gameRoomsDB).find(
      ([, gameRoom]) => gameRoom.adminUserName === ws.userName,
    )?.[1];

    if (gameRoom && gameRoom.players.length === 2) return;

    const botPlayer = this.createBotPlayer();

    let currentGameRoom = gameRoom;

    if (!currentGameRoom) {
      const roomId = this.createNewRoom(ws)?.roomId as number;
      currentGameRoom = gameRoomsDB[roomId] as GameRoom;
    }

    currentGameRoom.players = [currentGameRoom.players[0] as Player, botPlayer];

    this.createGame(currentGameRoom.gameRoomId);
  }

  createBotPlayer(): Player {
    const ships = this.generateShipPositions();
    return {
      index: 1,
      isBot: true,
      ships,
      gameBoard: this.buildGameBoard(ships),
    };
  }

  private generateShipPositions() {
    const ships: Ship[] = [];
    const shipTypes = ['huge', 'large', 'medium', 'small'];
    const shipLengths = [4, 3, 2, 1];
    const shipCounts = [1, 2, 3, 4];

    const grid: boolean[][] = Array.from({ length: 10 }, () =>
      new Array(10).fill(false),
    );

    for (let i = 0; i < shipTypes.length; i++) {
      const shipType = shipTypes[i] as 'small' | 'medium' | 'large' | 'huge';
      const shipLength = shipLengths[i] as number;
      const shipCount = shipCounts[i] as number;

      for (let j = 0; j < shipCount; j++) {
        let isPlaced = false;

        while (!isPlaced) {
          const direction = Math.random() < 0.5;

          const x = Math.floor(
            Math.random() * (10 - (direction ? 0 : shipLength)),
          );

          const y = Math.floor(
            Math.random() * (10 - (direction ? shipLength : 0)),
          );

          let isValidPlacement = true;

          if (grid[x]?.[y]) continue;

          for (let k = -1; k < shipLength + 1; k++) {
            for (let l = -1; l < 2; l++) {
              const newX = direction ? x + l : x + k;
              const newY = direction ? y + k : y + l;

              const cell = grid[newX]?.[newY];

              if (cell) {
                isValidPlacement = false;
                break;
              }
            }
          }

          if (isValidPlacement) {
            for (let s = 0; s < shipLength; s++) {
              const newX = direction ? x : x + s;
              const newY = direction ? y + s : y;

              const cell = grid[newX]?.[newY];

              if (cell === undefined) continue;

              (grid[newX] as boolean[])[newY] = true;
            }

            ships.push({
              position: { x, y },
              direction,
              length: shipLength,
              type: shipType,
              hp: shipLength,
            });

            isPlaced = true;
          }
        }
      }
    }

    return ships;
  }

  closeGameRoom(ws: CustomWebSocket) {
    const gameRoom = Object.entries(gameRoomsDB).find(
      ([, gameRoom]) =>
        gameRoom.adminUserName === ws.userName ||
        gameRoom.players[1]?.ws?.userName === ws.userName,
    )?.[1];

    if (!gameRoom) return;

    const winnerPlayerIndex = gameRoom.adminUserName === ws.userName ? 1 : 0;
    const winnerUserName = gameRoom.players[winnerPlayerIndex]?.ws?.userName;
    this.finishGame(gameRoom.players, winnerPlayerIndex);

    delete gameRoomsDB?.[gameRoom.gameRoomId];
    return winnerUserName;
  }

  private markKilledShipAround(
    gameRoom: GameRoom,
    opponentPlayer: Player,
    shipIndex: number,
  ) {
    const ship = opponentPlayer.ships?.[shipIndex];

    if (!ship) return;

    for (let i = -1; i < ship.length + 1; i++) {
      for (let j = -1; j < 2; j++) {
        const x = ship.position.x + (ship.direction ? j : i);
        const y = ship.position.y + (ship.direction ? i : j);

        const cell = opponentPlayer.gameBoard?.[x]?.[y];

        if (!cell || cell.isAttacked) continue;

        cell.isAttacked = true;

        gameRoom.players.forEach(
          ({ ws }) =>
            ws &&
            ws.send(
              generateMessageText('attack', {
                position: { x, y },
                currentPlayer: gameRoom.currentPlayerId,
                status: 'miss',
              }),
            ),
        );

        this.sendTurn(gameRoom.gameRoomId);
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

    const ship = opponentPlayer.ships?.[shipIndex];

    if (!ship || !ship.hp) return;

    ship.hp -= 1;

    return { status: ship.hp === 0 ? 'killed' : 'shot', shipIndex };
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
