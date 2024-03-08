import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { FirebaseRepository } from 'src/firebase/firebase.repository';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly firebaseRepository: FirebaseRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    console.log('guard');
    const request = context.switchToHttp().getRequest();
    const headerEmail = request.headers['authenticated_email'];
    if (headerEmail) {
      throw new ForbiddenException('Remove authenticated_email from headers');
    }
    const token = request.headers['auth'];
    if (token) {
      try {
        const email = await this.firebaseRepository.validateEmail({ token });
        request.headers['authenticated_email'] = email;
        return true;
      } catch (error) {
        console.log(error);
        throw new ForbiddenException(
          'An invalid access token has been provided ',
        );
      }
    }
    throw new ForbiddenException(
      'No auth token provided, make sure to add a token on auth header',
    );
  }
}
