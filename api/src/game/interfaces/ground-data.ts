import { GameElement } from './gameElement';

export interface GroundElement extends GameElement {
    type: string;
}

export interface GroundData {
    x: number;
    elements: GroundElement[];
}
