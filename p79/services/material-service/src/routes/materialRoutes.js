const express = require('express');
const materialController = require('../controllers/materialController');
const { protect, requirePermission, requireRole } = require('../middleware/auth');
const { ROLES, PERMISSIONS } = require('../../../../shared/constants');

const router = express.Router();

router.use(protect);

/**
 * @swagger
 * /api/materials/categories:
 *   get:
 *     summary: 获取原料分类列表
 *     tags: [原料管理]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功获取分类列表
 */
router.get('/categories', requirePermission(PERMISSIONS.MATERIAL_READ), materialController.getCategories);
router.get('/origin-technique-mapping', requirePermission(PERMISSIONS.MATERIAL_READ), materialController.getOriginTechniqueMapping);
router.get('/heritage-statistics', requirePermission(PERMISSIONS.MATERIAL_READ), materialController.getHeritageStatistics);

/**
 * @swagger
 * /api/materials:
 *   get:
 *     summary: 获取所有原料
 *     tags: [原料管理]
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
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: supplierId
 *         schema:
 *           type: string
 *       - in: query
 *         name: qualityGrade
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 成功获取原料列表
 */
router.get('/', requirePermission(PERMISSIONS.MATERIAL_READ), materialController.getAllMaterials);

/**
 * @swagger
 * /api/materials/{id}:
 *   get:
 *     summary: 根据ID获取原料
 *     tags: [原料管理]
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
 *         description: 成功获取原料
 *       404:
 *         description: 原料不存在
 */
router.get('/:id', requirePermission(PERMISSIONS.MATERIAL_READ), materialController.getMaterialById);

/**
 * @swagger
 * /api/materials:
 *   post:
 *     summary: 录入原料信息
 *     tags: [原料管理]
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
 *               - category
 *               - origin
 *             properties:
 *               name:
 *                 type: string
 *               category:
 *                 type: string
 *               origin:
 *                 type: object
 *                 properties:
 *                   province:
 *                     type: string
 *                   city:
 *                     type: string
 *                   address:
 *                     type: string
 *               supplierId:
 *                 type: string
 *               description:
 *                 type: string
 *               attributes:
 *                 type: object
 *               unit:
 *                 type: string
 *               pricePerUnit:
 *                 type: number
 *               qualityGrade:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: 原料录入成功
 */
router.post('/', requireRole(ROLES.ADMIN), materialController.createMaterial);

/**
 * @swagger
 * /api/materials/{id}:
 *   put:
 *     summary: 更新原料信息
 *     tags: [原料管理]
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
 *               category:
 *                 type: string
 *               origin:
 *                 type: object
 *               supplierId:
 *                 type: string
 *               description:
 *                 type: string
 *               attributes:
 *                 type: object
 *               unit:
 *                 type: string
 *               pricePerUnit:
 *                 type: number
 *               qualityGrade:
 *                 type: string
 *               status:
 *                 type: string
 *               images:
 *                 type: array
 *     responses:
 *       200:
 *         description: 原料更新成功
 *       404:
 *         description: 原料不存在
 */
router.put('/:id', requireRole(ROLES.ADMIN), materialController.updateMaterial);

/**
 * @swagger
 * /api/materials/{id}:
 *   delete:
 *     summary: 删除原料
 *     tags: [原料管理]
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
 *         description: 原料删除成功
 *       404:
 *         description: 原料不存在
 */
router.delete('/:id', requireRole(ROLES.ADMIN), materialController.deleteMaterial);
router.put('/:id/processing-technique', requireRole(ROLES.ADMIN, ROLES.QUALITY_INSPECTOR), materialController.updateProcessingTechnique);
router.put('/:id/heritage-info', requireRole(ROLES.ADMIN, ROLES.QUALITY_INSPECTOR), materialController.updateHeritageInfo);
router.post('/:id/certifications', requireRole(ROLES.ADMIN, ROLES.QUALITY_INSPECTOR), materialController.addCraftCertification);

module.exports = router;
