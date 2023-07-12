import { CustomWebSocket } from '../app/utils';
import { User } from '../models/User';

export const usersDB: { name: string; user: User; wins: number }[] = [];

export const roomsDB: {
  roomId: number;
  roomUsers: { index: number; ws: CustomWebSocket }[];
}[] = [];
