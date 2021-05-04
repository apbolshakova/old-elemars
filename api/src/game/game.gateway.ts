import {SubscribeMessage, WebSocketGateway, WebSocketServer} from '@nestjs/websockets';
import {Server, Socket} from 'socket.io';
import {GameService} from './game.service';
import {Logger} from '@nestjs/common';
import {ButtonCode} from './enums/button-code';
import {Obstacle, Player} from './interfaces/gameElement';

@WebSocketGateway()
export class GameGateway {
    @WebSocketServer() wss: Server;

    private readonly logger = new Logger('Game gateway');

    constructor(private gameService: GameService) {}

    @SubscribeMessage('connect')
    handleConnection(client: Socket) {
        client.emit('connect');
    }

    @SubscribeMessage('create')
    handleCreation(
        client: Socket,
        data: {
            gameId: string;
            level: string;
        },
    ) {
        this.logger.log('create');
        if (this.gameService.gameId) {
            client.emit('createFail', 'Где-то уже создана игра.');
        }

        this.gameService.gameId = data.gameId;
        this.gameService.level = data.level;
        this.gameService.host = client;
        client.emit('createSuccess');
    }

    @SubscribeMessage('join')
    handleJoining(
        client: Socket,
        data: {
            clientId: string;
            gameId: string;
            character: string;
        },
    ) {
        this.logger.log('join');
        if (this.gameService.gameId !== data.gameId) {
            client.emit('joinFail', 'Попытка подключится к несуществующей игре.');
        }

        for (const player of this.gameService.players) {
            if (data.character === player.character) {
                client.emit('joinFail', 'Выбранный Элемар уже занят.');
                return;
            }
        }

        const newPlayer = {
            id: data.clientId,
            character: data.character,
            x: Math.random() * 100,
            y: 0,
        };

        this.gameService.players.push(newPlayer);

        this.wss.emit('joinSuccess', {
            players: this.gameService.players,
            level: this.gameService.level,
        });
    }

    @SubscribeMessage('deleteGame')
    handleDeletingGame(client: Socket, gameId: string) {
        this.logger.log('delete');
        if (this.gameService.gameId) {
            this.gameService.deleteGame();
        }

        client.emit('deleteSuccess');
    }

    @SubscribeMessage('update')
    handleUpdating(
        client: Socket,
        data: {
            obstacles: Obstacle[];
            players: Player[];
        },
    ) {
        client.broadcast.emit('update', data);
    }

    @SubscribeMessage('start')
    handleGameStarting() {
        this.wss.emit('start');
    }

    @SubscribeMessage('clientPressButton')
    handleClientButtonPressing(
        client: Socket,
        data: {
            clientId: string;
            pressedButton: ButtonCode;
        },
    ) {
        this.gameService.host.emit('clientPressButton', data);
    }

    @SubscribeMessage('clientReleaseButton')
    handleClientButtonReleasing(
        client: Socket,
        data: {
            clientId: string;
            releasedButton: ButtonCode;
        },
    ) {
        this.gameService.host.emit('clientReleaseButton', data);
    }
}
