import { SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { Logger } from '@nestjs/common';
import { ButtonCode } from './enums/button-code';
import { ObstaclesData } from './interfaces/obstacles-data';
import { GroundData } from './interfaces/ground-data';
import { Player } from './interfaces/player';

@WebSocketGateway()
export class GameGateway {
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
            return;
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
        this.gameService.playerSockets.push({ socket: client, playerId: data.clientId });

        this.gameService.playerSockets.map(playerSocket =>
            playerSocket.socket.emit('joinSuccess', {
                players: this.gameService.players,
                level: this.gameService.level,
            }),
        );
    }

    @SubscribeMessage('disconnect')
    handleDisconnecting(
        client: Socket,
        data: {
            playerId: string;
            gameId: string;
        },
    ) {
        this.gameService.players = this.gameService.players.filter(
            player => data.playerId !== player.id,
        );
        this.gameService.playerSockets = this.gameService.playerSockets.filter(
            playerSocket => data.playerId !== playerSocket.playerId,
        );

        this.gameService.playerSockets.map(playerSocket =>
            playerSocket.socket.emit('disconnectSuccess', {
                players: this.gameService.players,
            }),
        );
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
            obstacles: ObstaclesData;
            ground: GroundData;
            players: Player[];
        },
    ) {
        this.gameService.players = data.players;
        client.broadcast.emit('update', data);
    }

    @SubscribeMessage('start')
    handleGameStarting() {
        this.gameService.playerSockets.map(playerSocket =>
            playerSocket.socket.emit('start'),
        );
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
