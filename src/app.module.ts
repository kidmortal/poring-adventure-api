import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { FirebaseModule } from './firebase/firebase.module';

@Module({
  imports: [FirebaseModule, UsersModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
