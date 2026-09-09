import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Prisma, User } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Profile API (HTTP integration)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let users: Map<string, User>;
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  function cookie(id = 'user-1', expiresIn = 3600): string {
    return `jwt=${jwt.sign({ sub: id }, { expiresIn })}`;
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_SECRET: 'profile-integration-test-secret' })],
        }),
        PrismaModule,
        AuthModule,
      ],
      providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = module.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    jwt = module.get(JwtService);
  });

  beforeEach(() => {
    jest.resetAllMocks();
    users = new Map(
      (['USER', 'ADMIN'] as const).map((role, index) => {
        const user: User = {
          id: index === 0 ? 'user-1' : 'admin-1',
          name: `${role} Name`,
          email: `${role.toLowerCase()}@example.com`,
          phone: '03001234567',
          passwordHash: 'private-hash',
          role,
          status: 'ACTIVE',
          createdAt: new Date('2026-09-01T00:00:00Z'),
          updatedAt: new Date('2026-09-01T00:00:00Z'),
        };
        return [user.id, user];
      }),
    );
    prisma.user.findUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) =>
        users.get(where.id) ?? null,
    );
    prisma.user.update.mockImplementation(
      async ({
        where,
        data,
      }: {
        where: { id: string; status: string };
        data: { name?: string; phone?: string | null };
      }) => {
        const user = users.get(where.id);
        if (!user || user.status !== where.status) {
          throw new Prisma.PrismaClientKnownRequestError('Record not found', {
            code: 'P2025',
            clientVersion: '6.19.3',
          });
        }
        const updated: User = {
          ...user,
          name: data.name ?? user.name,
          phone: data.phone === undefined ? user.phone : data.phone,
          updatedAt: new Date('2026-09-09T00:00:00Z'),
        };
        users.set(user.id, updated);
        return updated;
      },
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  describe.each(['user-1', 'admin-1'])('authenticated as %s', (id) => {
    it('reads only its own safe profile', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookie(id))
        .expect(200);

      expect(response.body).toMatchObject({ id, email: users.get(id)?.email });
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('updates, trims and persists only its own profile', async () => {
      const otherId = id === 'user-1' ? 'admin-1' : 'user-1';
      const otherUser = { ...users.get(otherId) };
      const response = await request(app.getHttpServer())
        .patch('/auth/me')
        .set('Cookie', cookie(id))
        .send({ name: '  Updated Name  ', phone: '  +92 300 7654321  ' })
        .expect(200);

      expect(response.body).toMatchObject({
        id,
        name: 'Updated Name',
        phone: '+92 300 7654321',
        email: users.get(id)?.email,
        role: users.get(id)?.role,
        status: 'ACTIVE',
      });
      expect(response.body).not.toHaveProperty('passwordHash');
      expect(users.get(otherId)).toEqual(otherUser);

      const current = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookie(id))
        .expect(200);
      expect(current.body).toEqual(response.body);
    });

    it.each([{ name: 'Name Only' }, { phone: '03111234567' }, { phone: null }])(
      'supports partial updates: %j',
      async (payload) => {
        const original = { ...users.get(id) };
        const response = await request(app.getHttpServer())
          .patch('/auth/me')
          .set('Cookie', cookie(id))
          .send(payload)
          .expect(200);

        expect(response.body).toMatchObject({
          name: original.name,
          phone: original.phone,
          ...payload,
        });
      },
    );

    it.each([
      ['id', 'another-user'],
      ['userId', 'another-user'],
      ['role', 'ADMIN'],
      ['passwordHash', 'replacement'],
      ['password', 'replacement'],
      ['status', 'SUSPENDED'],
      ['email', 'other@example.com'],
      ['createdBy', 'another-user'],
      ['createdAt', '2020-01-01'],
      ['updatedAt', '2020-01-01'],
      ['notificationPreferences', { email: false }],
      ['committees', { deleteMany: {} }],
    ])('rejects protected or unsupported field %s', async (field, value) => {
      await request(app.getHttpServer())
        .patch('/auth/me')
        .set('Cookie', cookie(id))
        .send({ name: 'Valid Name', [String(field)]: value })
        .expect(400);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  it.each([
    {},
    { name: null },
    { name: '' },
    { name: '   ' },
    { name: 123 },
    { name: ['Name'] },
    { name: 'a'.repeat(101) },
    { phone: 123 },
    { phone: { value: '03001234567' } },
    { phone: '' },
    { phone: '   ' },
    { phone: '1'.repeat(33) },
  ])('rejects invalid update %j', async (payload) => {
    await request(app.getHttpServer())
      .patch('/auth/me')
      .set('Cookie', cookie())
      .send(payload)
      .expect(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  describe.each(['get', 'patch'] as const)(
    '%s /auth/me authentication',
    (method) => {
      it('rejects a missing cookie', async () => {
        await request(app.getHttpServer())[method]('/auth/me').expect(401);
        expect(prisma.user.update).not.toHaveBeenCalled();
      });

      it('rejects invalid and expired cookies', async () => {
        for (const token of ['jwt=invalid', cookie('user-1', -1)]) {
          await request(app.getHttpServer())
            [method]('/auth/me')
            .set('Cookie', token)
            .expect(401);
        }
        expect(prisma.user.update).not.toHaveBeenCalled();
      });

      it.each(['INACTIVE', 'SUSPENDED'] as const)(
        'rejects a %s account',
        async (status) => {
          const user = users.get('user-1');
          if (!user) throw new Error('Missing test user');
          user.status = status;
          await request(app.getHttpServer())
            [method]('/auth/me')
            .set('Cookie', cookie())
            .expect(401);
          expect(prisma.user.update).not.toHaveBeenCalled();
        },
      );

      it('rejects a deleted account', async () => {
        users.delete('user-1');
        await request(app.getHttpServer())
          [method]('/auth/me')
          .set('Cookie', cookie())
          .expect(401);
        expect(prisma.user.update).not.toHaveBeenCalled();
      });
    },
  );
});
