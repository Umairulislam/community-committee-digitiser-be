import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(false),
}));

import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;

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

  beforeEach(async () => {
    const mockUsersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updateProfile: jest.fn(),
      toSafeUser: jest.fn(UsersService.prototype.toSafeUser),
    };

    const mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('register', () => {
    it('should register a new user and return safe user data', async () => {
      jest.spyOn(usersService, 'create').mockResolvedValue(mockUser);

      const result = await authService.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user.email).toBe('test@example.com');
      expect(usersService.create).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        phone: undefined,
      });
    });

    it('should throw ConflictException when email already exists', async () => {
      jest
        .spyOn(usersService, 'create')
        .mockRejectedValue(new ConflictException());

      await expect(
        authService.register({
          name: 'Test',
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should return user data on valid credentials', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should throw UnauthorizedException for unknown email', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'unknown@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for suspended user', async () => {
      jest
        .spyOn(usersService, 'findByEmail')
        .mockResolvedValue({ ...mockUser, status: 'SUSPENDED' });
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      jest
        .spyOn(usersService, 'findByEmail')
        .mockResolvedValue({ ...mockUser, status: 'INACTIVE' });
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('generateToken', () => {
    it('should generate a JWT token with correct payload', () => {
      const token = authService.generateToken('user-1', 'test@example.com');

      expect(token).toBe('mock-jwt-token');
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        email: 'test@example.com',
      });
    });
  });

  describe('updateCurrentUser', () => {
    it('returns the updated profile without the password hash', async () => {
      const updated = { ...mockUser, name: 'Updated Name' };
      jest.spyOn(usersService, 'updateProfile').mockResolvedValue(updated);

      const result = await authService.updateCurrentUser(mockUser.id, {
        name: updated.name,
      });

      expect(usersService.updateProfile).toHaveBeenCalledWith(mockUser.id, {
        name: updated.name,
      });
      expect(result.name).toBe(updated.name);
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('getCurrentUser', () => {
    it('should return safe user data for valid user id', async () => {
      jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser);

      const result = await authService.getCurrentUser('user-1');

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.id).toBe('user-1');
    });

    it('should throw UnauthorizedException when user not found', async () => {
      jest.spyOn(usersService, 'findById').mockResolvedValue(null);

      await expect(authService.getCurrentUser('nonexistent')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
