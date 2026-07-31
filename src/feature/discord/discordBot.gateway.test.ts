import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { WebsocketDiscordServiceGuard } from 'src/core/websocket/websocket.guard';

function contextFor(email: string) {
  return {
    switchToWs: () => ({ getClient: () => ({ handshake: { auth: { email } } }) }),
  } as unknown as ExecutionContext;
}

describe('WebsocketDiscordServiceGuard', () => {
  const guard = new WebsocketDiscordServiceGuard();

  it('lets the discord bot socket through', async () => {
    await expect(guard.canActivate(contextFor('discord'))).resolves.toBe(true);
  });

  it('rejects a regular player socket', async () => {
    await expect(guard.canActivate(contextFor('player@example.com'))).rejects.toThrow(ForbiddenException);
  });

  it('rejects an unauthenticated socket', async () => {
    await expect(guard.canActivate(contextFor(undefined))).rejects.toThrow(ForbiddenException);
  });
});
