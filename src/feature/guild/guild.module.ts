import { Module } from '@nestjs/common';
import { GuildService } from './guild.service';
import { GuildGateway } from './guild.gateway';
import { CacheModule } from '@nestjs/cache-manager';
import { WebsocketModule } from 'src/core/websocket/websocket.module';
import { NotificationModule } from 'src/integrations/notification/notification.module';
import { UsersModule } from 'src/feature/users/users.module';
import { GuildRepository } from './guild.repository';
import { GuildPermissions } from './guild.permissions';
import { GuildTaskService } from './guildTask.service';
import { GuildBlessingService } from './guildBlessing.service';
import { GuildApplicationService } from './guildApplication.service';
import { GuildBossService } from './guildBoss.service';
import { GuildStoreService } from './guildStore.service';
import { ItemsModule } from 'src/feature/items/items.module';

const providers = [
  GuildService,
  GuildRepository,
  GuildPermissions,
  GuildTaskService,
  GuildBlessingService,
  GuildApplicationService,
  GuildBossService,
  GuildStoreService,
];

@Module({
  imports: [
    WebsocketModule,
    NotificationModule,
    UsersModule,
    ItemsModule,
    CacheModule.register({ ttl: 1000 * 60 * 10 }), // 10 minutes cache
  ],
  providers: [...providers, GuildGateway],
  exports: providers,
})
export class GuildModule {}
