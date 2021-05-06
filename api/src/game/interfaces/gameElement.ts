import {PlayerStatus} from '../enums/player-status';

export interface GameElement {
    x: number;
    y: number;
    width?: number;
    height?: number;
}

export interface Player extends GameElement {
    id: string;
    character: string;
    status?: PlayerStatus;
}

export interface Obstacle extends GameElement {
    type: string;
}
