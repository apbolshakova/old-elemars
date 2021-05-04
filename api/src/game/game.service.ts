import {Injectable} from '@nestjs/common';
import {Socket} from 'socket.io';
import {Player} from './interfaces/gameElement';

@Injectable()
export class GameService {
    public gameId: string | null = null;
    public level: string | null = null;
    public players: Player[] = [];
    public host: Socket | null = null;

    public deleteGame() {
        this.gameId = null;
        this.level = null;
        this.players = [];
        this.host = null;
    }
}
