import { GameElement } from './game-element';

export interface GroundElement extends GameElement {
    type: string;
}

export interface GroundData {
    x: number;
    elements: GroundElement[];
}
