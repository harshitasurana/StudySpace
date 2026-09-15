import { Router } from 'express';
import * as controller from './category_controller.js';
import { authenticate, authorize } from '../../../common/middlewares/auth_middleware.js';
import {
  createCategoryTypeSchema,
  updateCategoryTypeSchema,
  createCategorySchema,
  updateCategorySchema,
  categoryTypeParamsSchema,
  categoryParamsSchema
} from './category_validation.js';
import { validateBody, validateParams } from '../../../common/middlewares/validate.js';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     CategoryType:
 *       type: object
 *       properties:
 *         category_type_id:
 *           type: integer
 *         name:
 *           type: string
 *         code:
 *           type: string
 *         description:
 *           type: string
 *         is_active:
 *           type: boolean
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     CreateCategoryType:
 *       type: object
 *       required:
 *         - name
 *         - code
 *       properties:
 *         name:
 *           type: string
 *         code:
 *           type: string
 *         description:
 *           type: string
 *     UpdateCategoryType:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         code:
 *           type: string
 *         description:
 *           type: string
 *         is_active:
 *           type: boolean
 *     Category:
 *       type: object
 *       properties:
 *         category_id:
 *           type: integer
 *         category_type_id:
 *           type: integer
 *         name:
 *           type: string
 *         code:
 *           type: string
 *         description:
 *           type: string
 *         display_order:
 *           type: integer
 *         is_active:
 *           type: boolean
 *         CategoryType:
 *           $ref: '#/components/schemas/CategoryType'
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     CreateCategory:
 *       type: object
 *       required:
 *         - type
 *         - name
 *       properties:
 *         type:
 *           type: string
 *           description: 'Category type code (e.g., pharmacy)'
 *         name:
 *           type: string
 *         code:
 *           type: string
 *         description:
 *           type: string
 *         display_order:
 *           type: integer
 *           default: 0
 *     UpdateCategory:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *           description: 'Category type code (e.g., pharmacy)'
 *         name:
 *           type: string
 *         code:
 *           type: string
 *         description:
 *           type: string
 *         display_order:
 *           type: integer
 *         is_active:
 *           type: boolean
 */

/**
 * @swagger
 * /api/metadata/category/category-types:
 *   post:
 *     summary: Create category type
 *     tags: [Metadata]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCategoryType'
 *     responses:
 *       201:
 *         description: Category type created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/CategoryType'
 */
router.post('/category-types', authenticate, authorize(['hospital_admin']), validateBody(createCategoryTypeSchema), controller.createCategoryTypeController);

/**
 * @swagger
 * /api/metadata/category/category-types:
 *   get:
 *     summary: Get all category types
 *     tags: [Metadata]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of category types
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CategoryType'
 */
router.get('/category-types', authenticate, controller.getAllCategoryTypesController);

/**
 * @swagger
 * /api/metadata/category/category-types/{id}:
 *   put:
 *     summary: Update category type
 *     tags: [Metadata]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateCategoryType'
 *     responses:
 *       200:
 *         description: Category type updated
 */
router.put('/category-types/:id', authenticate, authorize(['hospital_admin']), validateParams(categoryTypeParamsSchema), validateBody(updateCategoryTypeSchema), controller.updateCategoryTypeController);

/**
 * @swagger
 * /api/metadata/category/category-types/{id}:
 *   delete:
 *     summary: Delete category type
 *     tags: [Metadata]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Category type deleted
 */
router.delete('/category-types/:id', authenticate, authorize(['hospital_admin']), validateParams(categoryTypeParamsSchema), controller.deleteCategoryTypeController);

/**
 * @swagger
 * /api/metadata/category/categories:
 *   get:
 *     summary: Get categories (by type or all)
 *     tags: [Metadata]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: type
 *         in: query
 *         schema:
 *           type: string
 *         example: pharmacy
 *     responses:
 *       200:
 *         description: List of categories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Category'
 */
router.get('/categories', authenticate, controller.getCategoriesController);

/**
 * @swagger
 * /api/metadata/category/categories:
 *   post:
 *     summary: Create category
 *     tags: [Metadata]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCategory'
 *     responses:
 *       201:
 *         description: Category created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Category'
 */
router.post('/categories', authenticate, authorize(['hospital_admin']), validateBody(createCategorySchema), controller.createCategoryController);

/**
 * @swagger
 * /api/metadata/category/categories/{id}:
 *   get:
 *     summary: Get category by ID
 *     tags: [Metadata]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Category details
 */
router.get('/categories/:id', authenticate, controller.getCategoryController);

/**
 * @swagger
 * /api/metadata/category/categories/{id}:
 *   put:
 *     summary: Update category
 *     tags: [Metadata]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateCategory'
 *     responses:
 *       200:
 *         description: Category updated
 */
router.put('/categories/:id', authenticate, authorize(['hospital_admin']), validateParams(categoryParamsSchema), validateBody(updateCategorySchema), controller.updateCategoryController);

/**
 * @swagger
 * /api/metadata/category/categories/{id}:
 *   delete:
 *     summary: Delete category
 *     tags: [Metadata]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Category deleted
 */
router.delete('/categories/:id', authenticate, authorize(['hospital_admin']), validateParams(categoryParamsSchema), controller.deleteCategoryController);

export default router;
