import express from 'express';
import { authenticate } from '../../common/middlewares/auth_middleware.js';
import * as categoryService from './category/category_service.js';

import categoryRoutes from './category/category_routes.js';

const router = express.Router();

router.use('/category', categoryRoutes);

// Shorthand: GET /api/metadata/categories?type=faq_category
router.get('/categories', authenticate, async (req, res) => {
  try {
    const { type } = req.query;
    const data = type
      ? await categoryService.getCategoriesByTypeService(type)
      : await categoryService.getAllCategoriesService();
    res.json({ success: true, data, message: 'Categories retrieved successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
