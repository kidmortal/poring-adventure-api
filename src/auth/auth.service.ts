import { Injectable } from '@nestjs/common';
import { FirebaseRepository } from 'src/firebase/firebase.repository';

@Injectable()
export class AuthService {
  constructor(private readonly firebaseRepository: FirebaseRepository) {}
  async getAuthenticatedEmailFromToken(token: string) {
    if (!token) return false;
    const email = await this.firebaseRepository.validateEmail({ token });
    return email;
  }
}