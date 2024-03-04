import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { FirebaseRepository } from 'src/firebase/firebase.repository';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly firebaseRepository: FirebaseRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['auth'];
    if (token) {
      const email = await this.firebaseRepository.validateEmail({ token });
      request.headers['authenticated_email'] = email;
    }
    return true;
  }
}
