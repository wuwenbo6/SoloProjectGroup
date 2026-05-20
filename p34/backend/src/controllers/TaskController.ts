import { Request, Response } from 'express';
import { TaskService, TaskCreateData, TaskReviewData, TaskSubmissionData } from '../services/TaskService';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

const taskService = new TaskService();

export const createTask = async (req: Request, res: Response) => {
  try {
    const creatorId = (req as any).user.userId;
    const result = await taskService.createTask(req.body as TaskCreateData, creatorId);
    return successResponse(res, result, '任务创建成功');
  } catch (error) {
    logger.error('Create task failed:', error);
    return errorResponse(res, '创建任务失败');
  }
};

export const getTasks = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const filters = {
      status: req.query.status as string,
      priority: req.query.priority as string,
      ethnicity: req.query.ethnicity as string,
    };
    const result = await taskService.getTasks(filters, page, pageSize);
    return successResponse(res, result);
  } catch (error) {
    logger.error('Get tasks failed:', error);
    return errorResponse(res, '获取任务列表失败');
  }
};

export const getTaskById = async (req: Request, res: Response) => {
  try {
    const result = await taskService.getTaskById(req.params.id);
    if (!result) {
      return errorResponse(res, '任务不存在', 404);
    }
    return successResponse(res, result);
  } catch (error) {
    logger.error('Get task failed:', error);
    return errorResponse(res, '获取任务详情失败');
  }
};

export const updateTask = async (req: Request, res: Response) => {
  try {
    const operatorId = (req as any).user.userId;
    const result = await taskService.updateTask(req.params.id, req.body, operatorId);
    return successResponse(res, result, '任务更新成功');
  } catch (error) {
    logger.error('Update task failed:', error);
    return errorResponse(res, '更新任务失败');
  }
};

export const assignTask = async (req: Request, res: Response) => {
  try {
    const assignerId = (req as any).user.userId;
    const { assigneeId } = req.body;
    const result = await taskService.assignTask(req.params.id, assigneeId, assignerId);
    return successResponse(res, result, '任务分配成功');
  } catch (error) {
    logger.error('Assign task failed:', error);
    return errorResponse(res, '分配任务失败');
  }
};

export const startTask = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const result = await taskService.startTask(req.params.id, userId);
    return successResponse(res, result, '任务已开始');
  } catch (error) {
    logger.error('Start task failed:', error);
    return errorResponse(res, '开始任务失败');
  }
};

export const submitTask = async (req: Request, res: Response) => {
  try {
    const submitterId = (req as any).user.userId;
    const result = await taskService.submitTask(req.body as TaskSubmissionData, submitterId);
    return successResponse(res, result, '任务提交成功');
  } catch (error) {
    logger.error('Submit task failed:', error);
    return errorResponse(res, '提交任务失败');
  }
};

export const requestReview = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const result = await taskService.requestReview(req.params.id, userId);
    return successResponse(res, result, '已申请审核');
  } catch (error) {
    logger.error('Request review failed:', error);
    return errorResponse(res, '申请审核失败');
  }
};

export const reviewTask = async (req: Request, res: Response) => {
  try {
    const reviewerId = (req as any).user.userId;
    const result = await taskService.reviewTask(req.body as TaskReviewData, reviewerId);
    return successResponse(res, result, '审核完成');
  } catch (error) {
    logger.error('Review task failed:', error);
    return errorResponse(res, '审核失败');
  }
};

export const completeTask = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { actualHours } = req.body;
    const result = await taskService.completeTask(req.params.id, userId, actualHours);
    return successResponse(res, result, '任务已完成');
  } catch (error) {
    logger.error('Complete task failed:', error);
    return errorResponse(res, '完成任务失败');
  }
};

export const cancelTask = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { reason } = req.body;
    const result = await taskService.cancelTask(req.params.id, userId, reason);
    return successResponse(res, result, '任务已取消');
  } catch (error) {
    logger.error('Cancel task failed:', error);
    return errorResponse(res, '取消任务失败');
  }
};

export const deleteTask = async (req: Request, res: Response) => {
  try {
    const operatorId = (req as any).user.userId;
    await taskService.deleteTask(req.params.id, operatorId);
    return successResponse(res, null, '任务已删除');
  } catch (error) {
    logger.error('Delete task failed:', error);
    return errorResponse(res, '删除任务失败');
  }
};

export const addComment = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { content } = req.body;
    const result = await taskService.addComment(req.params.id, userId, content);
    return successResponse(res, result, '评论添加成功');
  } catch (error) {
    logger.error('Add comment failed:', error);
    return errorResponse(res, '添加评论失败');
  }
};

export const getTaskComments = async (req: Request, res: Response) => {
  try {
    const result = await taskService.getTaskComments(req.params.id);
    return successResponse(res, result);
  } catch (error) {
    logger.error('Get task comments failed:', error);
    return errorResponse(res, '获取评论失败');
  }
};

export const getMyTasks = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const role = req.query.role as 'creator' | 'assignee' || 'assignee';
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const result = await taskService.getMyTasks(userId, role, page, pageSize);
    return successResponse(res, result);
  } catch (error) {
    logger.error('Get my tasks failed:', error);
    return errorResponse(res, '获取我的任务失败');
  }
};

export const getStatistics = async (req: Request, res: Response) => {
  try {
    const result = await taskService.getStatistics();
    return successResponse(res, result);
  } catch (error) {
    logger.error('Get task statistics failed:', error);
    return errorResponse(res, '获取统计数据失败');
  }
};

export const getReviewerTasks = async (req: Request, res: Response) => {
  try {
    const reviewerId = (req as any).user.userId;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const result = await taskService.getReviewerTasks(reviewerId, page, pageSize);
    return successResponse(res, result);
  } catch (error) {
    logger.error('Get reviewer tasks failed:', error);
    return errorResponse(res, '获取审核任务失败');
  }
};

export const getTaskSubmissions = async (req: Request, res: Response) => {
  try {
    const result = await taskService.getTaskSubmissions(req.params.id);
    return successResponse(res, result);
  } catch (error) {
    logger.error('Get task submissions failed:', error);
    return errorResponse(res, '获取任务提交记录失败');
  }
};
