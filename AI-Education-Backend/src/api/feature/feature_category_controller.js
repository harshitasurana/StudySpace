import { getValidCategories } from './feature_category_validator.js';

/**
 * Get metadata categories for feature dropdowns (FEATURE type only)
 */
export const getCategoryDropdownController = async (req, res) => {
  try {
    const categories = await getValidCategories();
    res.json({
      success: true,
      message: "Feature categories retrieved successfully",
      data: categories
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export default { getCategoryDropdownController };

