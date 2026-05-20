const express = require('express');
const supplierController = require('../controllers/supplierController');
const { protect, requirePermission, requireRole } = require('../middleware/auth');
const { ROLES, PERMISSIONS } = require('../../../../shared/constants');

const router = express.Router();

router.use(protect);

/**
 * @swagger
 * /api/suppliers:
 *   get:
 *     summary: 获取所有供应商
 *     tags: [供应商管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 成功获取供应商列表
 */
router.get('/', requirePermission(PERMISSIONS.MATERIAL_READ), supplierController.getAllSuppliers);

/**
 * @swagger
 * /api/suppliers/{id}:
 *   get:
 *     summary: 根据ID获取供应商
 *     tags: [供应商管理]
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
 *         description: 成功获取供应商
 *       404:
 *         description: 供应商不存在
 */
router.get('/:id', requirePermission(PERMISSIONS.MATERIAL_READ), supplierController.getSupplierById);

/**
 * @swagger
 * /api/suppliers:
 *   post:
 *     summary: 创建供应商
 *     tags: [供应商管理]
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
 *             properties:
 *               name:
 *                 type: string
 *               contact_person:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               address:
 *                 type: string
 *               certification:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: 供应商创建成功
 */
router.post('/', requireRole(ROLES.ADMIN), supplierController.createSupplier);

/**
 * @swagger
 * /api/suppliers/{id}:
 *   put:
 *     summary: 更新供应商
 *     tags: [供应商管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               contact_person:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               address:
 *                 type: string
 *               certification:
 *                 type: array
 *               status:
 *                 type: string
 *               rating:
 *                 type: number
 *     responses:
 *       200:
 *         description: 供应商更新成功
 *       404:
 *         description: 供应商不存在
 */
router.put('/:id', requireRole(ROLES.ADMIN), supplierController.updateSupplier);

/**
 * @swagger
 * /api/suppliers/{id}:
 *   delete:
 *     summary: 删除供应商
 *     tags: [供应商管理]
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
 *         description: 供应商删除成功
 *       404:
 *         description: 供应商不存在
 *       400:
 *         description: 供应商下还有关联的原料
 */
router.delete('/:id', requireRole(ROLES.ADMIN), supplierController.deleteSupplier);

module.exports = router;
