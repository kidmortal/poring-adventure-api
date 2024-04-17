import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { Socket } from 'socket.io';
import { FirebaseRepository } from 'src/services/firebase/firebase.repository';

@Injectable()
export class AuthService {
  private logger = new Logger('AuthService');
  constructor(private readonly firebaseRepository: FirebaseRepository) {}

  async validateWebsocketConnection(args: { socket: Socket }) {
    const isDiscordToken = this._validateDiscordToken(args);
    if (isDiscordToken) {
      return true;
    }
    const isEmailToken = await this._validateEmailToken(args);
    if (isEmailToken) {
      return true;
    }
    return false;
  }

  private async _validateEmailToken(args: { socket: Socket }) {
    const client = args.socket;
    const accessToken = client.handshake.auth?.accessToken;
    if (accessToken) {
      try {
        const email = await this.firebaseRepository.validateEmail({ token: accessToken });
        client.handshake.auth.email = email;
        this.logger.debug(`Websocket connected - ${email}`);
        return true;
      } catch (error) {
        console.log(error);
        throw new ForbiddenException('An invalid access token has been provided ');
      }
    }
  }
  private _validateDiscordToken(args: { socket: Socket }) {
    const client = args.socket;
    const accessToken = client.handshake.auth?.accessToken;

    if (accessToken) {
      const hash = createHash('md5').update(process.env.DISCORD_API_TOKEN).digest('hex');
      if (accessToken === hash) {
        const email = 'discord';
        client.handshake.auth.email = email;
        this.logger.debug(`Websocket connected - ${email}`);
        return true;
      }
      return false;
    }
  }
}
