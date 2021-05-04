export interface GameElement {
    x: number;
    y: number;
}

export interface Player extends GameElement {
    id: string;
    character: string;
}

export interface Obstacle extends GameElement {
    type: string;
}
