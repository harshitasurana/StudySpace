import { CategoryType, Category } from "../metadata/category/category_schema.js";

/**
 * Validate that category_type_code + category_code exist in metadata/categories
 */
export const validateCategoryExists = async (typeCode, catCode) => {
  if (!typeCode || !catCode) return true; // Optional fields
  
  // Find category type
  const categoryType = await CategoryType.findOne({ 
    where: { 
      code: typeCode, 
      is_active: true 
    } 
  });
  
  if (!categoryType) {
    throw new Error(`Category type '${typeCode}' not found in metadata/category_types`);
  }
  
  // Find category under that type
  const category = await Category.findOne({ 
    where: { 
      category_type_id: categoryType.category_type_id,
      code: catCode,
      is_active: true
    } 
  });
  
  if (!category) {
    throw new Error(`Category '${catCode}' not found under type '${typeCode}'`);
  }
  
  return true;
};

/**
 * Get all valid category options for dropdowns
 */
export const getValidCategories = async () => {
  const categories = await Category.findAll({
    include: [{
      model: CategoryType,
      where: { is_active: true },
      attributes: ['code', 'name']
    }],
    where: { is_active: true },
    order: [
      [{ model: CategoryType }, 'code', 'ASC'],
      ['display_order', 'ASC'],
      ['name', 'ASC']
    ]
  });
  
  return categories.map(cat => ({
    category_id: cat.category_id,
    category_type_code: cat.CategoryType.code,
    category_type_name: cat.CategoryType.name,
    category_code: cat.code,
    category_name: cat.name,
    display_order: cat.display_order
  }));
};

export default { validateCategoryExists, getValidCategories };
