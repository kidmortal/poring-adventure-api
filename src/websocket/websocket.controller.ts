import { Body, Controller, Post } from '@nestjs/common';

import { WebsocketService } from './websocket.service';

@Controller('websocket')
export class WebsocketController {
  constructor(private readonly websocket: WebsocketService) {}

  @Post()
  notify(@Body() notification: { to: string; message: string }) {
    return this.websocket.sendTextNotification(
      notification.to,
      notification.message,
    );
  }
}
