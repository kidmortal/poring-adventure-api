import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';

@Injectable()
export class WebsocketService {
  wsClients: Socket[] = [];
  private logger = new Logger('Websocket - service');
  constructor() {}
  broadcast(event, message: any) {
    this.logger.debug(`broadcasting event ${event}`);
    for (const c of this.wsClients) {
      c.emit(event, message);
    }
  }

  sendTextNotification(email: string, text: string) {
    return this.sendMessageToSocket({
      email,
      event: 'notification',
      payload: text,
    });
  }

  sendMessageToSocket(args: { email: string; event: string; payload: any }) {
    const sockets = this.getUserSockets(args.email);
    if (sockets.length > 0) {
      sockets.forEach((socket) => socket.emit(args.event, args.payload));
    }
    return true;
  }

  getAllSockets() {
    const socketList: { id: string; email: string }[] = [];
    this.wsClients.forEach((socket) => {
      socketList.push({
        id: socket.id.slice(0, 6),
        email: socket.handshake.auth?.email,
      });
    });
    return socketList;
  }

  breakUserConnection(email: string) {
    const sockets = this.getUserSockets(email);
    if (sockets.length > 0) {
      sockets.forEach((socket) => socket.disconnect());
    }
  }

  private getUserSockets(email: string) {
    const sockets = this.wsClients.filter(
      (socket) => socket.handshake.auth.email === email,
    );
    return sockets;
  }
}
