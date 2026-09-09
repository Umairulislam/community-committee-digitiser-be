import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService profile updates', () => {
  let service: UsersService;
  const prisma = { user: { update: jest.fn() } };
  const user: User = {
    id: 'user-1',
    name: 'Updated Name',
    email: 'user@example.com',
    phone: '+92 300 1234567',
    passwordHash: 'private-hash',
    role: 'USER',
    status: 'ACTIVE',
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-09-09T00:00:00Z'),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(UsersService);
    prisma.user.update.mockResolvedValue(user);
  });

  it('only writes safe fields for the supplied authenticated user', async () => {
    const payload = {
      name: user.name,
      phone: user.phone,
      id: 'another-user',
      role: 'ADMIN',
      status: 'SUSPENDED',
      passwordHash: 'replacement',
      email: 'replacement@example.com',
      committees: { deleteMany: {} },
    };

    await service.updateProfile(user.id, payload);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id, status: 'ACTIVE' },
      data: { name: user.name, phone: user.phone },
    });
  });

  it.each([{ name: 'New Name' }, { phone: '03001234567' }, { phone: null }])(
    'supports a partial update: %j',
    async (payload) => {
      await service.updateProfile(user.id, payload);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id, status: 'ACTIVE' },
        data: { name: undefined, phone: undefined, ...payload },
      });
    },
  );

  it('rejects an empty update without writing', async () => {
    await expect(service.updateProfile(user.id, {})).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('returns 401 if the account disappears or becomes inactive before the write', async () => {
    prisma.user.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '6.19.3',
      }),
    );

    await expect(
      service.updateProfile(user.id, { name: 'New Name' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('preserves unexpected database errors', async () => {
    const error = new Error('Database unavailable');
    prisma.user.update.mockRejectedValue(error);
    await expect(
      service.updateProfile(user.id, { name: 'New Name' }),
    ).rejects.toBe(error);
  });

  it('removes the password hash from profile data', () => {
    const profile = service.toSafeUser(user);
    expect(profile).not.toHaveProperty('passwordHash');
    expect(profile).toMatchObject({ id: user.id, name: user.name });
  });
});
