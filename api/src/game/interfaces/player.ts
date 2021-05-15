import { PlayerStatus } from '../enums/player-status';
import { GameElement } from './gameElement';
import { Character } from '../enums/character';

export interface Player extends GameElement {
    id: string;
    character: Character;
    status?: PlayerStatus;
}
