import { Module } from '@nestjs/common';
import { SkillsService } from './skills.service';
import { SkillsGateway } from './skills.gateway';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [UsersModule],
  providers: [SkillsGateway, SkillsService],
})
export class SkillsModule {}
