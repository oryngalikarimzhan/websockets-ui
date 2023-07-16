import { CustomWebSocket } from '../app/utils';

export type GameRoom = {
  gameRoomId: number;
  adminUserName: string;
  currentPlayerId: number;
  players: Player[];
};

export type User = {
  index: number;
  name: string;
  password: string;
  ws: CustomWebSocket;
  wins: number;
};

export type Player = {
  index: number;
  isBot: boolean;
  ws?: CustomWebSocket;
  ships?: Ship[];
  gameBoard?: { shipIndex: number; isAttacked: boolean }[][];
};

export type Ship = {
  position: {
    x: number;
    y: number;
  };
  direction: boolean;
  length: number;
  type: 'small' | 'medium' | 'large' | 'huge';
  hp?: number;
};
