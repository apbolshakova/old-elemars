export interface GameElement {
    x: number;
    y: number;
    width?: number;
    height?: number;
}

export interface Player extends GameElement {
    id: string;
    character: string;
    isJumping?: true;
}

export interface Obstacle extends GameElement {
    type: string;
}
