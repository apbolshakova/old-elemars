import { Module } from '@nestjs/common';
import { GameGateway } from './game/game.gateway';
import { GameService } from './game/game.service';

@Module({
  imports: [],
  controllers: [],
  providers: [GameGateway, GameService],
})
export class AppModule {}
