import { GameElement } from './gameElement';

export interface ObstacleElement extends GameElement {
    type: string;
}

export interface ObstaclesData {
    x: number;
    elements: ObstacleElement[];
}
