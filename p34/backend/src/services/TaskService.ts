import prisma from '../config/database';
import logger from '../utils/logger';

export interface TaskCreateData {
  title: string;
  description?: string;
  requirementDoc?: string;
  categoryId?: string;
  ethnicity?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  deadline?: Date;
  estimatedHours?: number;
  assignedTo?: string;
}

export interface TaskReviewData {
  taskId: string;
  result: 'APPROVED' | 'REJECTED' | 'NEEDS_REVISION';
  comments?: string;
  reviewLevel?: number;
}

export interface TaskSubmissionData {
  taskId: string;
  patternIds: string[];
  remark?: string;
}

export class TaskService {
  async createTask(data: TaskCreateData, creatorId: string) {
    const task = await prisma.designTask.create({
      data: {
        title: data.title,
        description: data.description,
        requirementDoc: data.requirementDoc,
        categoryId: data.categoryId,
        ethnicity: data.ethnicity,
        priority: data.priority || 'MEDIUM',
        deadline: data.deadline,
        estimatedHours: data.estimatedHours,
        createdBy: creatorId,
        assignedTo: data.assignedTo,
        status: data.assignedTo ? 'ASSIGNED' : 'PENDING',
      },
      include: {
        creator: { select: { id: true, username: true } },
        assignee: { select: { id: true, username: true } },
        category: true,
      },
    });

    if (data.assignedTo) {
      await this.addComment(
        task.id,
        creatorId,
        `任务已分配给设计师，预计工时: ${data.estimatedHours || '未设置'}小时`
      );
    }

    logger.info(`Task created: ${task.id} by ${creatorId}`);
    return task;
  }

  async getTasks(filters: any = {}, page: number = 1, pageSize: number = 20) {
    const skip = (page - 1) * pageSize;
    const where: any = {};

    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.createdBy) where.createdBy = filters.createdBy;
    if (filters.assignedTo) where.assignedTo = filters.assignedTo;
    if (filters.ethnicity) where.ethnicity = filters.ethnicity;

    const [tasks, total] = await Promise.all([
      prisma.designTask.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          creator: { select: { id: true, username: true } },
          assignee: { select: { id: true, username: true } },
          category: true,
          _count: {
            select: { reviews: true, submissions: true, comments: true },
          },
        },
      }),
      prisma.designTask.count({ where }),
    ]);

    return { data: tasks, total, page, pageSize };
  }

  async getTaskById(id: string) {
    return prisma.designTask.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, username: true, email: true } },
        assignee: { select: { id: true, username: true, email: true } },
        category: true,
        reviews: {
          orderBy: { createdAt: 'desc' },
          include: { reviewer: { select: { id: true, username: true } } },
        },
        submissions: {
          orderBy: { createdAt: 'desc' },
          include: { submitter: { select: { id: true, username: true } } },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { id: true, username: true } } },
        },
      },
    });
  }

  async updateTask(id: string, data: Partial<TaskCreateData>, operatorId: string) {
    const task = await prisma.designTask.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        requirementDoc: data.requirementDoc,
        categoryId: data.categoryId,
        ethnicity: data.ethnicity,
        priority: data.priority,
        deadline: data.deadline,
        estimatedHours: data.estimatedHours,
      },
    });

    await this.addComment(id, operatorId, '更新了任务信息');

    logger.info(`Task updated: ${id}`);
    return task;
  }

  async assignTask(id: string, assigneeId: string, assignerId: string) {
    const task = await prisma.designTask.update({
      where: { id },
      data: {
        assignedTo: assigneeId,
        status: 'ASSIGNED',
      },
    });

    await this.addComment(id, assignerId, `将任务分配给设计师`);

    logger.info(`Task ${id} assigned to ${assigneeId}`);
    return task;
  }

  async startTask(id: string, userId: string) {
    const task = await prisma.designTask.update({
      where: { id },
      data: { status: 'IN_PROGRESS' },
    });

    await this.addComment(id, userId, '开始处理任务');

    logger.info(`Task started: ${id}`);
    return task;
  }

  async submitTask(data: TaskSubmissionData, submitterId: string) {
    const submission = await prisma.taskSubmission.create({
      data: {
        taskId: data.taskId,
        submittedBy: submitterId,
        patternIds: data.patternIds,
        remark: data.remark,
      },
    });

    await prisma.designTask.update({
      where: { id: data.taskId },
      data: { status: 'SUBMITTED' },
    });

    await this.addComment(data.taskId, submitterId, `提交了${data.patternIds.length}个纹样设计`);

    logger.info(`Task submitted: ${data.taskId}`);
    return submission;
  }

  async requestReview(id: string, userId: string) {
    const task = await prisma.designTask.update({
      where: { id },
      data: { status: 'UNDER_REVIEW' },
    });

    await this.addComment(id, userId, '申请审核');

    logger.info(`Task requested review: ${id}`);
    return task;
  }

  async reviewTask(data: TaskReviewData, reviewerId: string) {
    const review = await prisma.taskReview.create({
      data: {
        taskId: data.taskId,
        reviewerId,
        result: data.result,
        comments: data.comments,
        reviewLevel: data.reviewLevel || 1,
      },
    });

    let newStatus: any = 'UNDER_REVIEW';
    if (data.result === 'APPROVED') {
      newStatus = 'APPROVED';
    } else if (data.result === 'REJECTED') {
      newStatus = 'REJECTED';
    }

    const task = await prisma.designTask.update({
      where: { id: data.taskId },
      data: { status: newStatus },
    });

    await this.addComment(
      data.taskId,
      reviewerId,
      `审核${data.result === 'APPROVED' ? '通过' : data.result === 'REJECTED' ? '未通过' : '需要修改'}: ${data.comments || ''}`
    );

    logger.info(`Task reviewed: ${data.taskId} - ${data.result}`);
    return { review, task };
  }

  async completeTask(id: string, userId: string, actualHours?: number) {
    const task = await prisma.designTask.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        actualHours,
        completedAt: new Date(),
      },
    });

    await this.addComment(id, userId, `任务完成，实际工时: ${actualHours || '未记录'}小时`);

    logger.info(`Task completed: ${id}`);
    return task;
  }

  async cancelTask(id: string, userId: string, reason?: string) {
    const task = await prisma.designTask.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    await this.addComment(id, userId, `取消任务: ${reason || '无理由'}`);

    logger.info(`Task cancelled: ${id}`);
    return task;
  }

  async deleteTask(id: string, operatorId: string) {
    await prisma.designTask.delete({ where: { id } });
    logger.info(`Task deleted: ${id} by ${operatorId}`);
  }

  async addComment(taskId: string, userId: string, content: string) {
    return prisma.taskComment.create({
      data: {
        taskId,
        userId,
        content,
      },
    });
  }

  async getTaskComments(taskId: string) {
    return prisma.taskComment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, username: true } },
      },
    });
  }

  async getMyTasks(userId: string, role: 'creator' | 'assignee', page: number = 1, pageSize: number = 20) {
    const where = role === 'creator' ? { createdBy: userId } : { assignedTo: userId };
    return this.getTasks(where, page, pageSize);
  }

  async getStatistics() {
    const [total, byStatus, byPriority] = await Promise.all([
      prisma.designTask.count(),
      prisma.designTask.groupBy({ by: ['status'], _count: true }),
      prisma.designTask.groupBy({ by: ['priority'], _count: true }),
    ]);

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const monthlyStats = await prisma.designTask.count({
      where: { createdAt: { gte: thisMonth } },
    });

    const inProgress = await prisma.designTask.count({
      where: { status: 'IN_PROGRESS' },
    });

    return {
      total,
      monthlyStats,
      inProgress,
      byStatus,
      byPriority,
    };
  }

  async getReviewerTasks(reviewerId: string, page: number = 1, pageSize: number = 20) {
    const skip = (page - 1) * pageSize;

    const tasks = await prisma.designTask.findMany({
      where: {
        OR: [
          { status: 'UNDER_REVIEW' },
          {
            reviews: {
              some: { reviewerId },
            },
          },
        ],
      },
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        creator: { select: { id: true, username: true } },
        assignee: { select: { id: true, username: true } },
        category: true,
        _count: { select: { reviews: true, submissions: true } },
      },
    });

    const total = await prisma.designTask.count({
      where: {
        OR: [
          { status: 'UNDER_REVIEW' },
          {
            reviews: {
              some: { reviewerId },
            },
          },
        ],
      },
    });

    return { data: tasks, total, page, pageSize };
  }

  async getTaskSubmissions(taskId: string) {
    return prisma.taskSubmission.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      include: {
        submitter: { select: { id: true, username: true } },
      },
    });
  }
}
