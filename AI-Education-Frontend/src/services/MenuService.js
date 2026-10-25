import apiClient from './apiClient';

// GET /api/menu returns a flat array of menu nodes directly (not wrapped in
// { success, data }), already filtered/shaped by role via req.user on the
// backend — see api/menu/menu_controller.js's getMenu(). Each node:
// { label, icon, routerLink: [path], feature, feature_id, category,
//   menu_order, description, items: [...] }
const MenuService = {
  async getMenu() {
    const { data } = await apiClient.get('/api/menu');
    return data;
  },
};

export default MenuService;