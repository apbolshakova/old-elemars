import { SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { GameService } from './game.service'
import { Logger } from '@nestjs/common'

@WebSocketGateway()
export class GameGateway {
    @WebSocketServer() wss: Server

    private readonly logger = new Logger('Game gateway');

    constructor(private gameService: GameService) {
    }

    @SubscribeMessage('create')
    handleCreation(
        client: Socket,
        gameId: string,
    ) {
        this.logger.log('create');
        if (this.gameService.gameId) {
            client.emit('createFail', 'Где-то уже создана игра.')
        }

        this.gameService.gameId = gameId
        client.emit('createSuccess')
    }

    @SubscribeMessage('join')
    handleJoining(
        client: Socket,
        data: {
            clientId: string,
            gameId: string
            character: string
        },
    ) {
        this.logger.log('join');
        if (this.gameService.gameId !== data.gameId) {
            client.emit('joinFail', 'Попытка подключится к несуществующей игре.')
        }

        for (const player of this.gameService.players) {
            if (data.character === player.character) {
                client.emit('joinFail', 'Выбранный Элемар уже занят.')
                return
            }
        }

        this.gameService.players.push({id: data.clientId, character: data.character});
        client.emit('joinSuccess', this.gameService.players);
    }
}
