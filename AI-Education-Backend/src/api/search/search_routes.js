import express from "express";
import { authenticate } from "../../common/middlewares/auth_middleware.js";
import { getFilters, search } from "./search_controller.js";
import { searchQuerySchema } from "./search_validation.js";
import { validateQuery } from "../../common/middlewares/validate.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     SearchResult:
 *       type: object
 *       properties:
 *         entity:
 *           type: string
 *         category:
 *           type: string
 *         id:
 *           type: integer
 *         title:
 *           type: string
 *         subtitle:
 *           type: string
 *           nullable: true
 *         description:
 *           type: string
 *           nullable: true
 *         route:
 *           type: string
 *         meta:
 *           type: object
 *           additionalProperties: true
 *
 *     SearchFilters:
 *       type: object
 *       properties:
 *         categories:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               key:
 *                 type: string
 *               label:
 *                 type: string
 *         entities:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               key:
 *                 type: string
 *               label:
 *                 type: string
 *               category:
 *                 type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2026-01-01T00:00:00Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           example: "2026-01-01T00:00:00Z"
 *         created_by:
 *           type: integer
 *           nullable: true
 *           example: 1
 *         updated_by:
 *           type: integer
 *           nullable: true
 *           example: 1
 *         created_by_name:
 *           type: string
 *           nullable: true
 *           example: "Admin User"
 *         updated_by_name:
 *           type: string
 *           nullable: true
 *           example: "Admin User"
 */

/**
 * @swagger
 * /api/search/filters:
 *   get:
 *     tags: [Search]
 *     summary: Get available global search filters
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Search filter metadata
 */
router.get("/filters", authenticate, getFilters);

/**
 * @swagger
 * /api/search:
 *   get:
 *     tags: [Search]
 *     summary: Search across supported entities
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search text
 *       - in: query
 *         name: entity
 *         schema:
 *           type: string
 *           enum: [organizations, departments, services, doctors, patients, staff, appointments, calendar, contacts, tasks, rooms, ambulances, support, inventory-items, inventory-suppliers]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [organization, people, operations, scheduling, directory, productivity, support]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: per_entity_limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Search results
 */
router.get("/", authenticate, validateQuery(searchQuerySchema), search);

export default router;
