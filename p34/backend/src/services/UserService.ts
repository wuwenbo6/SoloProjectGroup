import { User, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { UserRepository } from '../repositories/UserRepository';
import prisma from '../config/database';
import logger from '../utils/logger';
import { CreateUserRequest, UpdateUserRequest } from '../types';

export class UserService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  async getAllUsers(page: number, pageSize: number, filters?: { role?: UserRole; status?: UserStatus }) {
    const where: any = {};
    if (filters?.role) where.role = filters.role;
    if (filters?.status) where.status = filters.status;

    return this.userRepository.findPaginated(page, pageSize, {
      where,
      select: { id: true, username: true, email: true, role: true, status: true, createdAt: true, lastLoginAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserById(id: string) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('用户不存在');
    }
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async createUser(request: CreateUserRequest) {
    const existingEmail = await this.userRepository.findByEmail(request.email);
    if (existingEmail) {
      throw new Error('邮箱已被注册');
    }

    const existingUsername = await this.userRepository.findByUsername(request.username);
    if (existingUsername) {
      throw new Error('用户名已被使用');
    }

    const passwordHash = await bcrypt.hash(request.password, 12);

    const user = await this.userRepository.create({
      username: request.username,
      email: request.email,
      passwordHash,
      role: request.role,
    });

    const { passwordHash: _, ...userWithoutPassword } = user;
    logger.info(`User created: ${user.email}`);

    return userWithoutPassword;
  }

  async updateUser(id: string, request: UpdateUserRequest) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('用户不存在');
    }

    if (request.email && request.email !== user.email) {
      const existingEmail = await this.userRepository.findByEmail(request.email);
      if (existingEmail) {
        throw new Error('邮箱已被使用');
      }
    }

    const updatedUser = await this.userRepository.update(id, request);
    const { passwordHash, ...userWithoutPassword } = updatedUser;
    logger.info(`User updated: ${id}`);

    return userWithoutPassword;
  }

  async deleteUser(id: string) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('用户不存在');
    }

    await this.userRepository.delete(id);
    logger.info(`User deleted: ${id}`);
  }

  async getUserOperations(userId: string, page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;

    const [operations, total] = await Promise.all([
      prisma.userOperation.findMany({
        where: { userId },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.userOperation.count({ where: { userId } }),
    ]);

    return { data: operations, total };
  }

  async getStats() {
    const [totalUsers, activeUsers, admins, designers] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { status: 'ACTIVE' } }),
      this.userRepository.count({ where: { role: 'ADMIN' } }),
      this.userRepository.count({ where: { role: 'DESIGNER' } }),
    ]);

    return { totalUsers, activeUsers, admins, designers };
  }
}
