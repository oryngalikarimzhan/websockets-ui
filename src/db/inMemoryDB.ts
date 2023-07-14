import { GameRoom, User } from './models';

export const usersDB: {
  [userName: string]: User;
} = {};

export const gameRoomsDB: {
  [gameRoomId: number]: GameRoom;
} = {};
