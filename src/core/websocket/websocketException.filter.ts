import { ArgumentsHost, Catch, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import * as Sentry from '@sentry/node';

/**
 * Turns a thrown handler into something both the operator and the client can
 * see. Two things matter here, and the previous version did neither:
 *
 * - it logs, so a failure is not invisible on the server
 * - it settles the acknowledgement, so the client is not left waiting for a
 *   response that is never coming. `asyncEmit` resolves off the ack callback,
 *   so an unanswered request is a screen that loads forever.
 */
@Catch()
export class WebsocketExceptionsFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger('Websocket - exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const message = exception instanceof Error ? exception.message : String(exception);
    const stack = exception instanceof Error ? exception.stack : undefined;

    // First, and outside every guard: a filter able to hide its own failure is
    // how a server error becomes a spinning client with nothing in the logs.
    this.logger.error(message, stack);

    this._safely('sentry', () => Sentry.captureException(exception));

    // socket.io hands the acknowledgement callback to the handler as its last
    // argument, and Nest never calls it once the handler has thrown. Answering
    // it is what releases the waiting client.
    this._safely('ack', () => {
      const ack = host.getArgs().find((arg) => typeof arg === 'function');
      if (ack) ack({ error: message });
    });

    this._safely('notify', () => {
      const socket = host.switchToWs().getClient() as Socket;
      socket.emit('error_notification', message);
    });
  }

  private _safely(step: string, run: () => void) {
    try {
      run();
    } catch (error) {
      this.logger.error(`exception filter failed during ${step}: ${error}`);
    }
  }
}
