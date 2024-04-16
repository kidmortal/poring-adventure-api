import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

const libsql = createClient({
  url: `${process.env.TURSO_DATABASE_URL ?? 'file:dev.db'}`,
  authToken: `${process.env.TURSO_AUTH_TOKEN ?? ''}`,
});

const adapter = new PrismaLibSQL(libsql);

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    super({ adapter });
  }
}
