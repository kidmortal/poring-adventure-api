import { Injectable, Logger } from '@nestjs/common';
import { FirebaseRepository } from 'src/firebase/firebase.repository';

@Injectable()
export class AuthService {
  private logger = new Logger('AuthService');
  constructor(private readonly firebaseRepository: FirebaseRepository) {}
  async getAuthenticatedEmailFromToken(token: string) {
    if (!token) return false;
    try {
      const email = await this.firebaseRepository.validateEmail({ token });
      return email;
    } catch (error) {
      this.logger.error(`Error on getAuthenticatedEmailFromToken`);
      return false;
    }
  }
}
