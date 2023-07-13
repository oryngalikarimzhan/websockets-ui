import { Player } from '../models/Player';

export const usersDB: {
  [userName: string]: {
    name: string;
    password: string;
    wins: number;
  };
} = {};

export const gameRoomsDB: {
  [gameRoomId: number]: {
    gameRoomId: number;
    adminUserName: string;
    currentPlayerId: number;
    players: Player[];
  };
} = {};
