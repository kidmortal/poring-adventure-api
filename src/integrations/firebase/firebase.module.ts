import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { FIREBASE_APP, FirebaseRepository } from './firebase.repository';

const firebaseProvider = {
  provide: FIREBASE_APP,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const projectId = configService.get<string>('PROJECT_ID');
    const clientEmail = configService.get<string>('CLIENT_EMAIL');
    // Env vars keep the private key on a single line, so the newlines arrive escaped.
    const privateKey = configService.get<string>('PRIVATE_KEY')?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Missing firebase credentials: PROJECT_ID, CLIENT_EMAIL and PRIVATE_KEY are required');
    }

    return admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      databaseURL: `https://${projectId}.firebaseio.com`,
      storageBucket: `${projectId}.appspot.com`,
    });
  },
};

@Global()
@Module({
  imports: [ConfigModule.forRoot({ envFilePath: '.env' })],
  providers: [firebaseProvider, FirebaseRepository],
  exports: [FirebaseRepository],
})
export class FirebaseModule {}
