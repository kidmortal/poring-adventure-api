import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { FirebaseRepository } from 'src/firebase/firebase.repository';

@Injectable()
export class PurchaseGuard implements CanActivate {
  constructor(private readonly firebaseRepository: FirebaseRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const auth = request.headers.authorization;
    const key = process.env.REVENUECAT_WEBHOOK_KEY;
    if (auth !== key) {
      throw new UnauthorizedException(`Wrong auth key`);
    }
    return true;
  }
}
