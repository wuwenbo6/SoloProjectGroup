import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('开始种子数据初始化...');

  const hashedPassword = await bcrypt.hash('123456', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@pattern.com' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@pattern.com',
      passwordHash: hashedPassword,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });
  console.log('创建管理员用户:', admin.email);

  const designer = await prisma.user.upsert({
    where: { email: 'designer@pattern.com' },
    update: {},
    create: {
      username: 'designer',
      email: 'designer@pattern.com',
      passwordHash: hashedPassword,
      role: UserRole.DESIGNER,
      status: UserStatus.ACTIVE,
    },
  });
  console.log('创建设计师用户:', designer.email);

  const collector = await prisma.user.upsert({
    where: { email: 'collector@pattern.com' },
    update: {},
    create: {
      username: 'collector',
      email: 'collector@pattern.com',
      passwordHash: hashedPassword,
      role: UserRole.COLLECTOR,
      status: UserStatus.ACTIVE,
    },
  });
  console.log('创建采集员用户:', collector.email);

  const categories = [
    { name: '苗族纹样', ethnicity: '苗族', description: '苗族传统服饰纹样' },
    { name: '侗族纹样', ethnicity: '侗族', description: '侗族传统服饰纹样' },
    { name: '彝族纹样', ethnicity: '彝族', description: '彝族传统服饰纹样' },
    { name: '藏族纹样', ethnicity: '藏族', description: '藏族传统服饰纹样' },
    { name: '壮族纹样', ethnicity: '壮族', description: '壮族传统服饰纹样' },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: category,
    });
    console.log('创建分类:', category.name);
  }

  console.log('种子数据初始化完成!');
  console.log(`
  ==========================================
  🎉 初始化完成
  
  测试账号:
  - 管理员: admin@pattern.com / 123456
  - 设计师: designer@pattern.com / 123456
  - 采集员: collector@pattern.com / 123456
  ==========================================
  `);
}

main()
  .catch((e) => {
    console.error('种子数据初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
