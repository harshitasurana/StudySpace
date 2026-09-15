import express from 'express';
import { authenticate } from '../../common/middlewares/auth_middleware.js';
import { getMenu, reorderMenu } from './menu_controller.js';

const router = express.Router();

// Apply authentication middleware to all menu routes
router.use(authenticate);

/**
 * @swagger
 * /api/menu:
 *   get:
 *     summary: Get UI menu dynamically built from database
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Returns the menu structure (PrimeNG MenuItem-like) dynamically built directly from the database based on the authenticated user's role permissions.
 *
 *       **Key Features:**
 *       - Menu is built directly from the Feature table where `show_in_menu = true`
 *       - Hierarchical structure is created using `parent_feature_id` (self-referencing)
 *       - Menu items are filtered based on user's role permissions from FeaturePermission table
 *       - Menu items are further filtered by `X-Client-Type` header — only features linked to the matching availability type are returned
 *       - Uses `menu_label`, `menu_icon`, and `router_link` from database
 *
 *       **Database Fields Used:**
 *       - `feature_name` - Name of the feature
 *       - `parent_feature_id` - For hierarchical structure
 *       - `show_in_menu` - Boolean to include in menu
 *       - `menu_label` - Label to display
 *       - `menu_icon` - Icon class
 *       - `router_link` - Route path
 *     parameters:
 *       - in: header
 *         name: X-Client-Type
 *         schema:
 *           type: string
 *           example: REACT
 *         description: Client platform code used to filter features by their availability type (e.g. REACT, ANGULAR, MOBILE). If omitted, all features are returned.
 *         required: false
 *     responses:
 *       200:
 *         description: Menu returned successfully from database
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MenuItem'
 *             example:
 *               - label: "Dashboard"
 *                 icon: "pi pi-th-large"
 *                 routerLink: ["/dashboard"]
 *                 feature: "Dashboard"
 *                 feature_id: 1
 *                 category: "Core"
 *                 menu_order: 1
 *                 items: []
 *               - label: "Settings"
 *                 icon: "pi pi-cog"
 *                 routerLink: ["/settings"]
 *                 feature: "Settings"
 *                 feature_id: 3
 *                 category: "Core"
 *                 menu_order: 10
 *                 items:
 *                   - label: "Profile"
 *                     icon: "pi pi-user"
 *                     routerLink: ["/profile"]
 *                     feature: "Profile"
 *                     feature_id: 2
 *                     category: "Core"
 *                     menu_order: 0
 *                     items: []
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       500:
 *         description: Server error - Failed to build menu
 */
router.get('/', getMenu);

/**
 * @swagger
 * /api/menu/reorder:
 *   put:
 *     summary: Reorder menu items by updating menu_order for multiple features
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Updates the menu_order field for multiple features to reorder the menu directly in the database.
 *
 *       **Supported Request Formats:**
 *       1. **Hierarchical Format (Recommended)** - Preserves parent-child relationships
 *          `{ "menu": [{ feature_id, menu_order, items: [...] }, ...] }`
 *
 *       2. **Array Format** - Flat list of items
 *          `{ "items": [{ feature_id, menu_order }, ...] }`
 *
 *       3. **Map Format** - Object with feature_id as key
 *          `{ "orders": { "1": 1, "2": 2, ... } }`
 *
 *       4. **Direct Array Format** - No wrapper
 *          `[{ feature_id, menu_order }, ...]`
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 title: Hierarchical Format
 *                 description: Recommended format - preserves menu hierarchy
 *                 properties:
 *                   menu:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         feature_id:
 *                           type: integer
 *                         menu_order:
 *                           type: integer
 *                         items:
 *                           type: array
 *                           description: Nested menu items
 *               - type: object
 *                 title: Array Format
 *                 properties:
 *                   items:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         feature_id:
 *                           type: integer
 *                         menu_order:
 *                           type: integer
 *               - type: object
 *                 title: Map Format
 *                 properties:
 *                   orders:
 *                     type: object
 *                     additionalProperties:
 *                       type: integer
 *               - type: array
 *                 title: Direct Array Format
 *                 items:
 *                   type: object
 *                   properties:
 *                     feature_id:
 *                       type: integer
 *                     menu_order:
 *                       type: integer
 *           examples:
 *             hierarchical:
 *               summary: Hierarchical Format (Recommended)
 *               value:
 *                 menu:
 *                   - feature_id: 100
 *                     menu_order: 1
 *                     items:
 *                       - feature_id: 68
 *                         menu_order: 1
 *                       - feature_id: 69
 *                         menu_order: 2
 *                   - feature_id: 1
 *                     menu_order: 2
 *                     items: []
 *                   - feature_id: 3
 *                     menu_order: 3
 *                     items:
 *                       - feature_id: 2
 *                         menu_order: 1
 *                       - feature_id: 65
 *                         menu_order: 2
 *             array:
 *               summary: Array Format
 *               value:
 *                 items:
 *                   - feature_id: 1
 *                     menu_order: 1
 *                   - feature_id: 2
 *                     menu_order: 2
 *                   - feature_id: 3
 *                     menu_order: 3
 *             map:
 *               summary: Map Format
 *               value:
 *                 orders:
 *                   "1": 1
 *                   "2": 2
 *                   "3": 3
 *             direct:
 *               summary: Direct Array Format
 *               value:
 *                 - feature_id: 1
 *                   menu_order: 1
 *                 - feature_id: 2
 *                   menu_order: 2
 *     responses:
 *       200:
 *         description: Menu reordered successfully in database
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     updated:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           feature_id:
 *                             type: integer
 *                           feature_name:
 *                             type: string
 *                           old_menu_order:
 *                             type: integer
 *                           new_menu_order:
 *                             type: integer
 *                     notFound:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           feature_id:
 *                             type: integer
 *                           error:
 *                             type: string
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *                 summary:
 *                   type: object
 *                   properties:
 *                     total_requested:
 *                       type: integer
 *                     updated_count:
 *                       type: integer
 *                     not_found_count:
 *                       type: integer
 *                     error_count:
 *                       type: integer
 *             example:
 *               success: true
 *               message: "Menu reordered successfully (3 items updated)"
 *               data:
 *                 updated:
 *                   - feature_id: 100
 *                     feature_name: "Admin"
 *                     old_menu_order: 11
 *                     new_menu_order: 1
 *                   - feature_id: 1
 *                     feature_name: "Dashboard"
 *                     old_menu_order: 1
 *                     new_menu_order: 2
 *                   - feature_id: 3
 *                     feature_name: "Settings"
 *                     old_menu_order: 10
 *                     new_menu_order: 3
 *                 notFound: []
 *                 errors: []
 *               summary:
 *                 total_requested: 3
 *                 updated_count: 3
 *                 not_found_count: 0
 *                 error_count: 0
 *       400:
 *         description: Validation error - Invalid request format or missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 error:
 *                   type: string
 *                 details:
 *                   type: array
 *             example:
 *               success: false
 *               error: "Validation failed"
 *               details:
 *                 - "Item 0: missing feature_id"
 *                 - "Item 1: feature_id and menu_order must be numbers"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       500:
 *         description: Server error - Failed to reorder menu
 */
router.put('/reorder', reorderMenu);

export default router;