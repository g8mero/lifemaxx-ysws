import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { json } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { getEncryptionKey } from './crypto.util';

process.on('unhandledRejection', (reason) => {
  const logger = new Logger('UnhandledRejection');
  logger.fatal('Unhandled promise rejection', reason);
  process.exit(1);
});

async function bootstrap() {
  // Fail at boot with a readable message rather than on the first login.
  getEncryptionKey();

  const app = await NestFactory.create(AppModule);

  app.use(json({ limit: '50mb' }));
  app.use(helmet());

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
