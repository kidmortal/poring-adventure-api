import { Module } from '@nestjs/common';
import { MonstersService } from './monsters.service';
import { MonstersController } from './monsters.controller';

@Module({
  controllers: [MonstersController],
  providers: [MonstersService],
})
export class MonstersModule {}
