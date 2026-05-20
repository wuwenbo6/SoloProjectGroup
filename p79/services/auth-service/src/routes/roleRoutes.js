const express = require('express');
const roleController = require('../controllers/roleController');
const { protect, requirePermission, requireRole } = require('../middleware/auth');
const { ROLES, PERMISSIONS } = require('../../../../shared/constants');

const router = express.Router();

router.use(protect);

/**
 * @swagger
 * /api/roles/initialize:
 *   post:
 *     summary: 初始化默认角色
 *     tags: [角色管理]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 角色初始化完成
 */
router.post('/initialize', roleController.initializeRoles);

/**
 * @swagger
 * /api/roles:
 *   get:
 *     summary: 获取所有角色
 *     tags: [角色管理]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功获取角色列表
 */
router.get('/', requireRole(ROLES.ADMIN), roleController.getAllRoles);

/**
 * @swagger
 * /api/roles/{id}:
 *   get:
 *     summary: 根据ID获取角色
 *     tags: [角色管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 成功获取角色
 *       404:
 *         description: 角色不存在
 */
router.get('/:id', requireRole(ROLES.ADMIN), roleController.getRoleById);

/**
 * @swagger
 * /api/roles:
 *   post:
 *     summary: 创建新角色
 *     tags: [角色管理]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - permissions
 *             properties:
 *               name:
 *                 type: string
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: 角色创建成功
 *       409:
 *         description: 角色已存在
 */
router.post('/', requireRole(ROLES.ADMIN), roleController.createRole);

/**
 * @swagger
 * /api/roles/{id}:
 *   put:
 *     summary: 更新角色
 *     tags: [角色管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: 角色更新成功
 *       404:
 *         description: 角色不存在
 */
router.put('/:id', requireRole(ROLES.ADMIN), roleController.updateRole);

/**
 * @swagger
 * /api/roles/{id}:
 *   delete:
 *     summary: 删除角色
 *     tags: [角色管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 角色删除成功
 *       404:
 *         description: 角色不存在
 *       400:
 *         description: 角色下还有用户，无法删除
 */
router.delete('/:id', requireRole(ROLES.ADMIN), roleController.deleteRole);

module.exports = router;
