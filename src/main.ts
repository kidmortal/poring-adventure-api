import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { EventEmitter } from 'stream';
import { setupSentry } from './sentry';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: '*', allowedHeaders: '*' });
  app.useGlobalPipes(new ValidationPipe());
  setupSentry();
  EventEmitter.setMaxListeners(30);
  await app.listen(process.env.PORT || 8000);
}
bootstrap();
