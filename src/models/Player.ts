import { CustomWebSocket } from '../app/utils';
import { Ship } from './Ship';

export type Player = {
  gameRoomId: number;
  index: number;
  ws: CustomWebSocket;
  ships?: Ship[];
  gameBoard?: { shipIndex: number; isAttacked: boolean }[][];
};
