import { PlayerStatus } from '../enums/player-status';
import { GameElement } from './gameElement';

export interface Player extends GameElement {
    id: string;
    character: string;
    status?: PlayerStatus;
}
