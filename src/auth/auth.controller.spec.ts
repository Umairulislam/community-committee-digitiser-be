import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let authController: AuthController;
  let authService: AuthService;

  const safeUser = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    phone: null,
    role: 'USER',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockResponse = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  };

  beforeEach(async () => {
    const mockAuthService = {
      register: jest.fn().mockResolvedValue({ user: safeUser }),
      login: jest.fn().mockResolvedValue({ user: safeUser }),
      generateToken: jest.fn().mockReturnValue('mock-jwt-token'),
      getCurrentUser: jest.fn().mockResolvedValue(safeUser),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'COOKIE_SECURE') return 'false';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    authController = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);

    mockResponse.cookie.mockClear();
    mockResponse.clearCookie.mockClear();
  });

  describe('POST /auth/register', () => {
    it('should register user and set auth cookie', async () => {
      const result = await authController.register(
        { name: 'Test', email: 'test@example.com', password: 'password123' },
        mockResponse as any,
      );

      expect(result.message).toBe('Registration successful');
      expect(result.user.email).toBe('test@example.com');
      expect(authService.generateToken).toHaveBeenCalledWith(
        safeUser.id,
        safeUser.email,
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'jwt',
        'mock-jwt-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
        }),
      );
    });
  });

  describe('POST /auth/login', () => {
    it('should login user and set auth cookie', async () => {
      const result = await authController.login(
        { email: 'test@example.com', password: 'password123' },
        mockResponse as any,
      );

      expect(result.message).toBe('Login successful');
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'jwt',
        'mock-jwt-token',
        expect.objectContaining({ httpOnly: true }),
      );
    });
  });

  describe('POST /auth/logout', () => {
    it('should clear auth cookie', () => {
      const result = authController.logout(mockResponse as any);

      expect(result.message).toBe('Logout successful');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith(
        'jwt',
        expect.objectContaining({ httpOnly: true }),
      );
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user data', async () => {
      const mockRequest = { user: { id: 'user-1' } };

      const result = await authController.me(mockRequest as any);

      expect(result.id).toBe('user-1');
      expect(authService.getCurrentUser).toHaveBeenCalledWith('user-1');
    });
  });
});
