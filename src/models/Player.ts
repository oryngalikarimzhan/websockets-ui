import { CustomWebSocket } from '../app/utils';
import { Ship } from './Ship';

export type Player = {
  gameRoomId: number;
  ships?: Ship[];
  index: number;
  ws: CustomWebSocket;
};
