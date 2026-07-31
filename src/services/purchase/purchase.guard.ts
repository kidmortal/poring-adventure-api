import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

/** Only lets through requests carrying the shared secret configured on RevenueCat. */
@Injectable()
export class PurchaseGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const auth = request.headers.authorization;
    const key = process.env.REVENUECAT_WEBHOOK_KEY;
    if (!key || auth !== key) {
      throw new UnauthorizedException('Wrong auth key');
    }
    return true;
  }
}
