import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../../users/users.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersService: UsersService;

  const mockUser = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    phone: null,
    passwordHash: 'hashed-password',
    role: 'USER' as const,
    status: 'ACTIVE' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const payload = { sub: 'user-1', email: 'test@example.com' };

  beforeEach(() => {
    const mockConfigService = {
      get: jest.fn((key: string) =>
        key === 'JWT_SECRET' ? 'test-secret' : undefined,
      ),
    };
    const mockUsersService = {
      findById: jest.fn(),
    };

    strategy = new JwtStrategy(
      mockConfigService as unknown as ConfigService,
      mockUsersService as unknown as UsersService,
    );
    usersService = mockUsersService as unknown as UsersService;
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should throw an error at construction when JWT_SECRET is missing', () => {
    const mockConfigService = { get: jest.fn().mockReturnValue(undefined) };
    const mockUsersService = { findById: jest.fn() };

    expect(
      () =>
        new JwtStrategy(
          mockConfigService as unknown as ConfigService,
          mockUsersService as unknown as UsersService,
        ),
    ).toThrow('JWT_SECRET environment variable is not set');
  });

  describe('validate', () => {
    it('should return a slim user payload for an active user', async () => {
      jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        role: 'USER',
      });
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('name');
      expect(result).not.toHaveProperty('status');
    });

    it('should throw UnauthorizedException when user not found', async () => {
      jest.spyOn(usersService, 'findById').mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for a suspended user', async () => {
      jest
        .spyOn(usersService, 'findById')
        .mockResolvedValue({ ...mockUser, status: 'SUSPENDED' });

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for an inactive user', async () => {
      jest
        .spyOn(usersService, 'findById')
        .mockResolvedValue({ ...mockUser, status: 'INACTIVE' });

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
