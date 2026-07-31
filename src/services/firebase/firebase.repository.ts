import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { app } from 'firebase-admin';

export const FIREBASE_APP = 'FIREBASE_APP';

@Injectable()
export class FirebaseRepository {
  constructor(@Inject(FIREBASE_APP) private readonly firebaseApp: app.App) {}

  /** Resolves the email behind a firebase id token, throwing when the token carries none. */
  async validateEmail(args: { token: string }): Promise<string> {
    const validation = await this.firebaseApp.auth().verifyIdToken(args.token);
    if (!validation.email) {
      throw new UnauthorizedException('Access token has no email associated with it');
    }
    return validation.email;
  }
}
