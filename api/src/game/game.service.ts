import { Injectable } from '@nestjs/common';

@Injectable()
export class GameService {
    public gameId: string | null = null;
    public players: {id: string, character: string}[] = [];

    public deleteGame() {
        this.gameId = null;
        this.players = [];
    }
}
