import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import * as Sentry from '@sentry/node';

@Catch()
export class WebsocketExceptionsFilter extends BaseWsExceptionFilter {
  catch(exception: WsException | HttpException, host: ArgumentsHost) {
    try {
      const args = host.getArgs();
      const lastArg = args[args.length - 1];
      const socket = host.switchToWs().getClient() as Socket;
      const message = exception.message;
      Sentry.captureException(exception);

      socket.emit(
        'error_notification',
        `Error on event ${lastArg} - message ${message}`,
      );
    } catch (error) {}
  }
}
