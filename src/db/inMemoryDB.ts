import { Player } from '../models/Player';
import { User } from '../models/User';

export const usersDB: { user: User; wins: number }[] = [];

export const gameRoomsDB: {
  [gameRoomId: number]: {
    isStarted: boolean;
    currentPlayerId: number;
    players: Player[];
  };
} = {};
