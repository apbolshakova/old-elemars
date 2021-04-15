import { Injectable } from '@nestjs/common';

@Injectable()
export class GameService {
    public gameId: string | null = null;
    public level: string | null = null;
    public players: {id: string, character: string, x: number, y: number}[] = [];

    public deleteGame() {
        this.gameId = null;
        this.level = null;
        this.players = [];
    }
}
