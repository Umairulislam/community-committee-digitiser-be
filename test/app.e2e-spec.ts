import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('PrismaService')
      .useValue({
        $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET / (health check)', () => {
    it('should return health status', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.status).toBe('ok');
          expect(res.body).toHaveProperty('database');
          expect(res.body).toHaveProperty('timestamp');
        });
    });
  });

  describe('GET /auth/me (unauthenticated)', () => {
    it('should return 401 without a valid JWT cookie', () => {
      return request(app.getHttpServer()).get('/auth/me').expect(401);
    });
  });

  describe('POST /auth/logout (unauthenticated)', () => {
    it('should return 401 without a valid JWT cookie', () => {
      return request(app.getHttpServer()).post('/auth/logout').expect(401);
    });
  });

  describe('POST /auth/register (validation)', () => {
    it('should reject registration with invalid email', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ name: 'Test', email: 'not-an-email', password: 'password123' })
        .expect(400);
    });

    it('should reject registration with short password', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ name: 'Test', email: 'test@test.com', password: 'short' })
        .expect(400);
    });

    it('should reject registration with missing name', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'test@test.com', password: 'password123' })
        .expect(400);
    });
  });

  describe('POST /auth/login (validation)', () => {
    it('should reject login with missing fields', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@test.com' })
        .expect(400);
    });
  });
});
