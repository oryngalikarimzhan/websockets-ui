import { Player } from '../models/Player';
import { User } from '../models/User';

export const usersDB: { user: User; wins: number }[] = [];

export const gameRoomsDB = new Map<number, Player[]>();
