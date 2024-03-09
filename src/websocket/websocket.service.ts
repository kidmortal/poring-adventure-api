import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';

@Injectable()
export class WebsocketService {
  wsClients: Socket[] = [];
  constructor() {}
  broadcast(event, message: any) {
    for (const c of this.wsClients) {
      c.emit(event, message);
    }
  }

  sendTextNotification(email: string, text: string) {
    const socket = this.getUserSocket(email);
    if (socket) {
      socket.emit('notification', text);
    }
  }

  private getUserSocket(email: string) {
    const socket = this.wsClients.find(
      (socket) => socket.handshake.auth.email === email,
    );
    if (socket) {
      return socket;
    } else {
      return false;
    }
  }
}
