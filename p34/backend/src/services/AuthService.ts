import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UserRepository } from '../repositories/UserRepository';
import { LoginRequest, CreateUserRequest, LoginResponse } from '../types';
import logger from '../utils/logger';

export class AuthService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  async login(request: LoginRequest): Promise<LoginResponse> {
    const user = await this.userRepository.findByEmail(request.email);

    if (!user) {
      throw new Error('邮箱或密码错误');
    }

    const isValidPassword = await bcrypt.compare(request.password, user.passwordHash);

    if (!isValidPassword) {
      throw new Error('邮箱或密码错误');
    }

    if (user.status !== 'ACTIVE') {
      throw new Error('账户已被禁用');
    }

    await this.userRepository.updateLastLogin(user.id);

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    const { passwordHash, ...userWithoutPassword } = user;

    logger.info(`User logged in: ${user.email}`);

    return { token, user: userWithoutPassword as any };
  }

  async register(request: CreateUserRequest) {
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

    logger.info(`User registered: ${user.email}`);

    return userWithoutPassword;
  }

  async getCurrentUser(userId: string) {
    const user = await this.userRepository.findByIdWithPermissions(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
