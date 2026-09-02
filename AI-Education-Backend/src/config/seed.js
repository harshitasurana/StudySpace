import Role from '../api/roles/role_schema.js';
import RoleTemplate from '../api/roles/role_template_schema.js';
import Feature from '../api/feature/feature_schema.js';
import FeaturePermission from '../api/feature/feature_permissions_schema.js';
import AvailabilityType from '../api/feature/feature_availability_schema.js';
import FeatureAvailability from '../api/feature/feature_availability_model.js';
import { CategoryType, Category } from '../api/metadata/category/category_schema.js';
import User from '../api/user/user_schema.js';
import bcrypt from 'bcrypt';
import { logError } from '../common/utils/logger.js';
import { logInfo } from '../common/utils/logger.js';

const seedRoles = [
  { role_name: 'super_admin', description: 'Super Administrator with full access', category: 'Administrative' },
  { role_name: 'hospital_admin', description: 'Hospital Administrator', category: 'Administrative' },
  { role_name: 'accountant', description: 'Accountant', category: null },
  { role_name: 'billing_manager', description: 'Billing Manager', category: null },
  { role_name: 'Role Name', description: 'DEsacritption', category: null },
  { role_name: 'ROle_1', description: 'Description', category: null },
  { role_name: 'Role TEST', description: 'TEST THE ROLE', category: null },
  { role_name: 'TEST ROLE 1', description: 'TESTTEST ROLE 1', category: 'Medical Emergency staff' },
  { role_name: 'Role', description: 'Test Template', category: 'Administrative' },
  { role_name: 'FRONTEND TEST', description: 'FRONTEND TEST', category: 'Administrative' },
];

const seedFeatures = [
  { feature_name: 'Profile', category_type_code: 'FEATURE', category_code: 'user_management', description: 'User profile management', show_in_menu: true, is_active: true, menu_label: 'menu.profile', menu_icon: 'pi pi-user', router_link: 'profile', menu_order: 1, parent_feature_name: 'Settings' },
  { feature_name: 'Settings', category_type_code: 'FEATURE', category_code: 'settings', description: 'Application settings', show_in_menu: true, is_active: true, menu_label: 'menu.settings', menu_icon: 'pi pi-cog', router_link: '/settings', menu_order: 18 },
  { feature_name: 'Login', category_type_code: null, category_code: null, description: 'User login', show_in_menu: false, is_active: true, menu_label: 'Login', menu_icon: 'pi pi-sign-in', router_link: 'users/login', menu_order: 37 },
  { feature_name: 'Registration', category_type_code: null, category_code: null, description: 'User registration', show_in_menu: false, is_active: true, menu_order: 36 },
  { feature_name: 'Logout', category_type_code: null, category_code: null, description: 'User logout', show_in_menu: false, is_active: true, menu_order: 31 },
  { feature_name: 'Not Found', category_type_code: 'FEATURE', category_code: 'error', description: '404 page', show_in_menu: false, is_active: true, menu_label: 'Not Found', menu_icon: 'pi pi-exclamation-triangle', router_link: '/not-found', menu_order: 48 },
  { feature_name: 'Sidebar', category_type_code: 'FEATURE', category_code: 'layout', description: 'Navigation sidebar', show_in_menu: false, is_active: true, router_link: '/', menu_order: 47 },
  { feature_name: 'Topbar', category_type_code: 'FEATURE', category_code: 'layout', description: 'Top navigation bar', show_in_menu: false, is_active: true, router_link: '/', menu_order: 46 },
  { feature_name: 'Menu', category_type_code: 'FEATURE', category_code: 'layout', description: 'Menu system', show_in_menu: false, is_active: true, router_link: '/', menu_order: 44 },
  { feature_name: 'Breadcrumb', category_type_code: 'FEATURE', category_code: 'layout', description: 'Breadcrumb navigation', show_in_menu: false, is_active: true, router_link: '/', menu_order: 45 },
  { feature_name: 'Footer', category_type_code: 'FEATURE', category_code: 'layout', description: 'Page footer', show_in_menu: false, is_active: true, router_link: '/', menu_order: 43 },
  { feature_name: 'Toast Notifications', category_type_code: 'FEATURE', category_code: 'ui', description: 'Toast notifications', show_in_menu: false, is_active: true, router_link: '/', menu_order: 42 },
  { feature_name: 'Configurator', category_type_code: 'FEATURE', category_code: 'settings', description: 'UI configurator', show_in_menu: false, is_active: true, router_link: '/', menu_order: 40 },
  { feature_name: 'Floating Configurator', category_type_code: 'FEATURE', category_code: 'settings', description: 'Floating UI configurator', show_in_menu: false, is_active: true, router_link: '/', menu_order: 41 },
  { feature_name: 'Date/Time Formatting', category_type_code: 'FEATURE', category_code: 'internationalization', description: 'Date and time formatting', show_in_menu: false, is_active: true, router_link: '/', menu_order: 39 },
  { feature_name: 'Currency Formatting', category_type_code: 'FEATURE', category_code: 'internationalization', description: 'Currency formatting', show_in_menu: false, is_active: true, router_link: '/', menu_order: 36 },
  { feature_name: 'Preferences', category_type_code: 'FEATURE', category_code: 'settings', description: 'User preferences', show_in_menu: false, is_active: true, router_link: '/', menu_order: 37 },
  { feature_name: 'Language Support', category_type_code: 'FEATURE', category_code: 'internationalization', description: 'Language support', show_in_menu: false, is_active: true, router_link: '/', menu_order: 34 },
  { feature_name: 'Features', category_type_code: 'FEATURE', category_code: 'core', description: 'Features List', show_in_menu: true, is_active: true, menu_label: 'menu.features', menu_icon: 'pi pi-list', router_link: '/admin/features', menu_order: 1, parent_feature_name: 'Admin' },
  { feature_name: 'Add Feature', category_type_code: 'FEATURE', category_code: 'feature_management', description: 'FEATURE.CREATE_DESCRIPTION', show_in_menu: true, is_active: true, menu_label: 'menu.addFeature', menu_icon: 'pi pi-plus', router_link: '/admin/features/add', menu_order: 2, parent_feature_name: 'Admin' },
  { feature_name: 'Role Template', category_type_code: 'FEATURE', category_code: 'role_management', description: 'Role templates for creating roles', show_in_menu: false, is_active: true, menu_label: 'Role Templates', menu_icon: 'pi pi-copy', router_link: 'admin/', menu_order: 21 },
  { feature_name: 'Roles', category_type_code: 'FEATURE', category_code: 'role_management', description: 'Role management', show_in_menu: false, is_active: true, menu_label: 'menu.roles', menu_icon: 'pi pi-briefcase', router_link: 'roles', menu_order: 49 },
  { feature_name: 'Add Role', category_type_code: 'FEATURE', category_code: 'role_management', description: 'Define a new role with specific permissions for staff members.', show_in_menu: false, is_active: true, menu_label: 'menu.addRole', menu_icon: 'pi pi-user-plus', router_link: '/admin/roles/add', menu_order: 5, parent_feature_name: 'Admin Roles' },
  { feature_name: 'Admin', category_type_code: 'FEATURE', category_code: 'administration', description: 'Administration panel', show_in_menu: true, is_active: true, menu_label: 'menu.admin', menu_icon: 'pi pi-shield', router_link: 'admin', menu_order: 20 },
  { feature_name: 'Security', category_type_code: 'FEATURE', category_code: 'auth', description: 'Administration for manage all admin works', show_in_menu: true, is_active: true, menu_label: 'menu.admin', menu_icon: 'pi pi-shield', router_link: 'admin', menu_order: 51 },
  { feature_name: 'Role Management', category_type_code: 'FEATURE', category_code: 'role_management', description: 'Manage roles and permissions', show_in_menu: true, is_active: true, menu_label: 'menu.roles', menu_icon: 'pi pi-shield', router_link: 'admin/roles', menu_order: 4, parent_feature_name: 'Admin' },
  { feature_name: 'Edit Role', category_type_code: 'FEATURE', category_code: 'core', description: 'Modify role details and permissions', show_in_menu: false, is_active: true, menu_label: 'Edit Role', menu_icon: 'pi pi-user-edit', router_link: '/admin/roles/:id', menu_order: 6, parent_feature_name: 'Admin' },
  { feature_name: 'Role Profile', category_type_code: 'FEATURE', category_code: 'role_management', description: 'View role profile', show_in_menu: false, is_active: true, menu_label: 'Role Profile', menu_icon: 'pi pi-id-card', router_link: 'admin/roles/:id', menu_order: 7, parent_feature_name: 'Admin' },
  { feature_name: 'Add Template', category_type_code: 'FEATURE', category_code: 'core', description: 'Define a new role template with specific permissions', show_in_menu: false, is_active: true, menu_label: 'Add Template', menu_icon: 'pi pi-plus', router_link: '/admin/add', menu_order: 1, parent_feature_name: 'Role Template' },
  { feature_name: 'Edit Template', category_type_code: 'FEATURE', category_code: 'core', description: 'Define a new role template with specific permissions', show_in_menu: false, is_active: true, menu_label: 'Edit Template', menu_icon: 'pi pi-user-edit', router_link: '/admin/roles/:id', menu_order: 2, parent_feature_name: 'Role Template' },
  { feature_name: 'Edit Feature', category_type_code: 'FEATURE', category_code: 'feature_management', description: 'FEATURE.UPDATE_DESCRIPTION', show_in_menu: false, is_active: true, menu_label: 'Edit Features', menu_icon: 'pi pi-user-edit', router_link: '/admin/features/:id', menu_order: 8, parent_feature_name: 'Admin' },
  { feature_name: 'Feature Orderlist', category_type_code: 'FEATURE', category_code: 'feature_management', description: 'Manage feature menu order', show_in_menu: true, is_active: true, menu_label: 'Feature Order', menu_icon: 'pi pi-list', router_link: '/admin/menu-ordering', menu_order: 3, parent_feature_name: 'Admin' },
  { feature_name: 'Permissions', category_type_code: 'FEATURE', category_code: 'role_management', description: 'View and manage permissions', show_in_menu: false, is_active: true, menu_label: 'Permissions', menu_icon: 'pi pi-lock', router_link: 'permissions', menu_order: 23 },
  { feature_name: 'Access Denied', category_type_code: 'FEATURE', category_code: 'error', description: 'Access denied error page', show_in_menu: false, is_active: true, menu_label: 'Access Denied', menu_icon: 'pi pi-lock', router_link: 'access-denied', menu_order: 35 },
  { feature_name: 'Use Template', category_type_code: null, category_code: null, description: 'Use the template form to make a new role without add permissions and data again.', show_in_menu: false, is_active: true, router_link: 'admin/use', menu_order: 0, parent_feature_name: 'Role Template' },
  { feature_name: 'Users', category_type_code: 'FEATURE', category_code: 'user_management', description: 'User management', show_in_menu: true, is_active: true, menu_label: 'menu.users', menu_icon: 'pi pi-users', menu_order: 17 },
  { feature_name: 'Admin Features', category_type_code: 'FEATURE', category_code: 'core', description: 'Admin features list', show_in_menu: true, is_active: true, menu_label: 'menu.features', menu_icon: 'pi pi-list', router_link: 'admin/features', menu_order: 0, parent_feature_name: 'Security' },
  { feature_name: 'Admin Roles', category_type_code: 'FEATURE', category_code: 'role_management', description: 'Admin roles list', show_in_menu: false, is_active: true, menu_label: 'menu.admin.roles', menu_icon: 'pi pi-home', router_link: 'roles/', menu_order: 12 },
  { feature_name: 'Preferences Manager', category_type_code: 'FEATURE', category_code: 'settings', description: 'View and manage all saved user preferences', show_in_menu: false, is_active: true, router_link: 'profile/preference-viewer', menu_order: 0, parent_feature_name: 'Settings' },
  { feature_name: 'Profile Activity', category_type_code: 'FEATURE', category_code: 'core', description: 'View and track your recent account activities and actions.', show_in_menu: false, is_active: true, router_link: '/profile', menu_order: 5 },
  { feature_name: 'Profile Security', category_type_code: 'FEATURE', category_code: 'core', description: 'Manage password, authentication, and account security settings.', show_in_menu: false, is_active: true, router_link: '/profile', menu_order: 4 },
  { feature_name: 'Profile Notifications', category_type_code: 'FEATURE', category_code: 'core', description: 'Control how you receive alerts, emails, and system notifications.', show_in_menu: false, is_active: true, router_link: '/profile', menu_order: 3 },
  { feature_name: 'Profile Preferences', category_type_code: 'FEATURE', category_code: 'core', description: 'Customize your personal settings and application experience.', show_in_menu: false, is_active: true, router_link: '/profile', menu_order: 2 },
  { feature_name: 'Manage Preferences', category_type_code: 'FEATURE', category_code: 'core', description: 'Update and control system-wide or personal preference settings.', show_in_menu: false, is_active: true, menu_icon: 'pi pi-user', router_link: 'profile/preference-viewer', menu_order: 1 },
  { feature_name: 'Test-feature-1', category_type_code: 'FEATURE', category_code: 'core', description: 'This test feature regarding permission test', show_in_menu: false, is_active: true, menu_label: 'Test-Feature-1', menu_icon: 'pi pi-home', router_link: '/admin/test-feature-1', menu_order: 5, parent_feature_name: 'Admin' },
  { feature_name: 'Test-feature-2', category_type_code: 'FEATURE', category_code: 'core', description: 'This test feature regarding permission test-1', show_in_menu: false, is_active: true, menu_label: 'Test-Feature-2', menu_icon: 'pi pi-home', router_link: 'admin/test-feature-2', menu_order: 6, parent_feature_name: 'Admin' },
  { feature_name: 'Test-feature-3', category_type_code: 'FEATURE', category_code: 'core', description: 'This test feature regarding permission test-2', show_in_menu: false, is_active: true, menu_label: 'Test-Feature-3', menu_icon: 'pi pi-home', router_link: 'admin/test-feature-3', menu_order: 8, parent_feature_name: 'Admin' },
  { feature_name: 'Test feature', category_type_code: 'FEATURE', category_code: 'core', description: 'test after updaation', show_in_menu: false, is_active: true, menu_icon: 'pi pi-user', router_link: '/admin/test-feature-3/test', menu_order: 0, parent_feature_name: 'Test-feature-3' },
  { feature_name: 'Test-Feature-4', category_type_code: 'FEATURE', category_code: 'core', description: 'this test feature', show_in_menu: true, is_active: true, menu_label: 'test-feature-4', menu_icon: 'pi pi-home', router_link: '/admin/test-feature-3/test//admin/test-feature-4/test/', menu_order: 12 },
  { feature_name: 'Test-Feature-5', category_type_code: 'FEATURE', category_code: 'core', description: 'This is test feature 5', show_in_menu: true, is_active: true, menu_label: 'Test-feature-5', menu_icon: 'pi pi-home', router_link: '/test-feature-5', menu_order: 10 },
  { feature_name: 'Feedback', category_type_code: 'FEATURE', category_code: 'services', description: 'Collect and manage general feedback from patients and staff	', show_in_menu: true, is_active: true, menu_label: 'menu.feedback', menu_icon: 'pi pi-comment', router_link: '/feedback', menu_order: 16 },
  { feature_name: 'Email', category_type_code: 'FEATURE', category_code: 'core', description: 'Integrated email client for internal and external communication	', show_in_menu: true, is_active: true, menu_label: 'menu.email', menu_icon: 'pi pi-envelope', router_link: '/email', menu_order: 3, parent_feature_name: 'Communication' },
  { feature_name: 'Chat', category_type_code: 'FEATURE', category_code: 'core', description: 'Real-time messaging between staff, doctors, and patients	', show_in_menu: true, is_active: true, menu_label: 'menu.chat', menu_icon: 'pi pi-comments', router_link: '/chat', menu_order: 2, parent_feature_name: 'Communication' },
  { feature_name: 'Feature Permissions', category_type_code: 'FEATURE', category_code: 'core', description: 'Feature Permissions Page', show_in_menu: true, is_active: true, menu_label: 'menu.Feature-Permissions', menu_icon: 'pi-check-square', router_link: '/admin/feature-permissions', menu_order: 5, parent_feature_name: 'Admin' },
  { feature_name: 'TEST2', category_type_code: 'FEATURE', category_code: 'core', description: 'TEST', show_in_menu: false, is_active: true, router_link: '/test', menu_order: 0 },
  { feature_name: 'Feature Availability', category_type_code: 'FEATURE', category_code: 'administration', description: 'Feature Availability', show_in_menu: true, is_active: true, menu_label: 'Feature Availability', router_link: '/admin/feature-availability-types', menu_order: 6, parent_feature_name: 'Admin' },
  { feature_name: 'Feature availability mapping', category_type_code: 'FEATURE', category_code: 'administration', description: 'Feature availability mapping', show_in_menu: true, is_active: true, menu_label: 'Feature availability mapping', router_link: '/admin/feature-availability-map', menu_order: 7, parent_feature_name: 'Admin' },
  { feature_name: 'Communication', category_type_code: null, category_code: null, description: 'Communication Platform', show_in_menu: true, is_active: true, menu_label: 'menu.communication', menu_icon: 'pi pi-comments', menu_order: 8 },
  { feature_name: 'Inbox', category_type_code: null, category_code: null, description: 'Unified Inbox', show_in_menu: true, is_active: true, menu_label: 'menu.inbox', menu_icon: 'pi pi-inbox', router_link: '/inbox', menu_order: 1, parent_feature_name: 'Communication' },
  { feature_name: 'Search', category_type_code: null, category_code: null, description: 'Workspace Search', show_in_menu: false, is_active: true, router_link: '/search', menu_order: 4, parent_feature_name: 'Communication' },
  { feature_name: 'Meetings', category_type_code: null, category_code: null, description: 'Video Meetings', show_in_menu: false, is_active: true, router_link: '/meetings', menu_order: 5, parent_feature_name: 'Communication' },
  { feature_name: 'Campaigns', category_type_code: null, category_code: null, description: 'Marketing Campaigns', show_in_menu: false, is_active: true, router_link: '/campaigns', menu_order: 6, parent_feature_name: 'Communication' },
];

const seedRoleTemplates = [
  {
    name: 'Administration',
    category: 'Administrative',
    description: 'Template for administration staff with access to admin features.',
    permissions: [
      { feature_id: 1, can_read: true }, // Dashboard
      { feature_id: 27, can_read: true, can_create: true, can_update: true, can_delete: true }, // Roles
      { feature_id: 4, can_read: true, can_create: true, can_update: true, can_delete: true }, // Users
    ],
    status: 'active',
  },
];

// Metadata seed data
const seedPermissions = [
  { role_name: 'accountant', feature_name: 'Chat', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'accountant', feature_name: 'Communication', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'accountant', feature_name: 'Email', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'accountant', feature_name: 'Feature Availability', can_read: true, can_create: true, can_delete: true },
  { role_name: 'accountant', feature_name: 'Feature availability mapping', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'accountant', feature_name: 'Feature Orderlist', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'accountant', feature_name: 'Feature Permissions', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'accountant', feature_name: 'Feedback', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'accountant', feature_name: 'Inbox', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'accountant', feature_name: 'Profile', can_read: true, can_update: true },
  { role_name: 'accountant', feature_name: 'Role Management', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'accountant', feature_name: 'Role Template', can_delete: true },
  { role_name: 'accountant', feature_name: 'Settings', can_read: true },
  { role_name: 'accountant', feature_name: 'TEST2', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'accountant', feature_name: 'Test feature', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'accountant', feature_name: 'Test-feature-1', can_read: true, can_create: true },
  { role_name: 'accountant', feature_name: 'Test-feature-2', can_read: true, can_create: true },
  { role_name: 'accountant', feature_name: 'Test-feature-3', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'accountant', feature_name: 'Test-Feature-4', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'accountant', feature_name: 'Test-Feature-5', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'billing_manager', feature_name: 'Chat', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'billing_manager', feature_name: 'Communication', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'billing_manager', feature_name: 'Email', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'billing_manager', feature_name: 'Feature Availability', can_read: true, can_create: true, can_delete: true },
  { role_name: 'billing_manager', feature_name: 'Feature availability mapping', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'billing_manager', feature_name: 'Feature Orderlist', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'billing_manager', feature_name: 'Feature Permissions', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'billing_manager', feature_name: 'Feedback', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'billing_manager', feature_name: 'Inbox', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'billing_manager', feature_name: 'Profile', can_read: true, can_update: true },
  { role_name: 'billing_manager', feature_name: 'Role Management', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'billing_manager', feature_name: 'Role Template', can_delete: true },
  { role_name: 'billing_manager', feature_name: 'Settings', can_read: true },
  { role_name: 'billing_manager', feature_name: 'TEST2', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'billing_manager', feature_name: 'Test feature', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'billing_manager', feature_name: 'Test-feature-1', can_read: true, can_create: true },
  { role_name: 'billing_manager', feature_name: 'Test-feature-2', can_read: true, can_create: true },
  { role_name: 'billing_manager', feature_name: 'Test-feature-3', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'billing_manager', feature_name: 'Test-Feature-4', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'billing_manager', feature_name: 'Test-Feature-5', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Access Denied', can_read: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Add Feature', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Add Role', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Add Template', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Admin', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Admin Roles', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Breadcrumb', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Chat', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Communication', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Configurator', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Currency Formatting', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Date/Time Formatting', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Edit Feature', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Edit Role', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Edit Template', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Email', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Feature Availability', can_read: true, can_create: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Feature availability mapping', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Feature Orderlist', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Feature Permissions', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Features', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Feedback', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Floating Configurator', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Footer', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Inbox', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Language Support', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Manage Preferences', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Menu', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Not Found', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Permissions', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Preferences', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Preferences Manager', can_read: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Profile', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Profile Activity', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Profile Notifications', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Profile Preferences', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Profile Security', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Role Management', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Role Profile', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Roles', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Role Template', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Settings', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Sidebar', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'TEST2', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Test feature', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Toast Notifications', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'FRONTEND TEST', feature_name: 'Topbar', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Access Denied', can_read: true },
  { role_name: 'hospital_admin', feature_name: 'Add Feature', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Add Role', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Add Template', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Admin', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Admin Roles', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Breadcrumb', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Chat', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Communication', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Configurator', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Currency Formatting', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Date/Time Formatting', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Edit Feature', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Edit Role', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Edit Template', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Email', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Feature Availability', can_read: true, can_create: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Feature availability mapping', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Feature Orderlist', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Feature Permissions', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Features', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Feedback', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Floating Configurator', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Footer', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Inbox', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Language Support', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Manage Preferences', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Menu', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Not Found', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Permissions', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Preferences', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Profile', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Profile Activity', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Profile Notifications', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Profile Preferences', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Profile Security', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Role Management', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Role Profile', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Roles', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Role Template', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Settings', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Sidebar', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'TEST2', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Test feature', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Toast Notifications', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'hospital_admin', feature_name: 'Topbar', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Access Denied', can_read: true },
  { role_name: 'Role', feature_name: 'Add Feature', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Add Role', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Add Template', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Admin', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Admin Roles', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Breadcrumb', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Chat', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Communication', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Configurator', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Currency Formatting', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Date/Time Formatting', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Edit Feature', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Edit Role', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Edit Template', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Email', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Feature Availability', can_read: true, can_create: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Feature availability mapping', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Feature Orderlist', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Feature Permissions', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Features', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Feedback', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Floating Configurator', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Footer', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Inbox', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Language Support', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Manage Preferences', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Menu', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Not Found', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Permissions', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Preferences', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Preferences Manager', can_read: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Profile', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Profile Activity', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Profile Notifications', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Profile Preferences', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Profile Security', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Role Management', can_delete: true },
  { role_name: 'Role', feature_name: 'Role Profile', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Roles', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Role Template', can_delete: true },
  { role_name: 'Role', feature_name: 'Settings', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Sidebar', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'TEST2', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Test feature', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Test-feature-1', can_read: true, can_create: true },
  { role_name: 'Role', feature_name: 'Test-feature-2', can_read: true, can_create: true },
  { role_name: 'Role', feature_name: 'Test-feature-3', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Test-Feature-4', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Test-Feature-5', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Toast Notifications', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role', feature_name: 'Topbar', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'ROle_1', feature_name: 'Chat', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'ROle_1', feature_name: 'Communication', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'ROle_1', feature_name: 'Email', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'ROle_1', feature_name: 'Feature Availability', can_read: true, can_create: true, can_delete: true },
  { role_name: 'ROle_1', feature_name: 'Feature availability mapping', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'ROle_1', feature_name: 'Feature Orderlist', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'ROle_1', feature_name: 'Feature Permissions', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'ROle_1', feature_name: 'Feedback', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'ROle_1', feature_name: 'Inbox', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'ROle_1', feature_name: 'Role Management', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'ROle_1', feature_name: 'Role Template', can_delete: true },
  { role_name: 'ROle_1', feature_name: 'TEST2', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'ROle_1', feature_name: 'Test feature', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'ROle_1', feature_name: 'Test-feature-1', can_read: true, can_create: true },
  { role_name: 'ROle_1', feature_name: 'Test-feature-2', can_read: true, can_create: true },
  { role_name: 'ROle_1', feature_name: 'Test-feature-3', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'ROle_1', feature_name: 'Test-Feature-4', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'ROle_1', feature_name: 'Test-Feature-5', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role Name', feature_name: 'Chat', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role Name', feature_name: 'Communication', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role Name', feature_name: 'Email', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role Name', feature_name: 'Feature Availability', can_read: true, can_create: true, can_delete: true },
  { role_name: 'Role Name', feature_name: 'Feature availability mapping', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role Name', feature_name: 'Feature Orderlist', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role Name', feature_name: 'Feature Permissions', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role Name', feature_name: 'Feedback', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role Name', feature_name: 'Inbox', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role Name', feature_name: 'Role Management', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role Name', feature_name: 'Role Template', can_delete: true },
  { role_name: 'Role Name', feature_name: 'TEST2', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role Name', feature_name: 'Test feature', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role Name', feature_name: 'Test-feature-1', can_read: true, can_create: true },
  { role_name: 'Role Name', feature_name: 'Test-feature-2', can_read: true, can_create: true },
  { role_name: 'Role Name', feature_name: 'Test-feature-3', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role Name', feature_name: 'Test-Feature-4', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role Name', feature_name: 'Test-Feature-5', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role TEST', feature_name: 'Chat', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role TEST', feature_name: 'Communication', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role TEST', feature_name: 'Email', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role TEST', feature_name: 'Feature Availability', can_read: true, can_create: true, can_delete: true },
  { role_name: 'Role TEST', feature_name: 'Feature availability mapping', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role TEST', feature_name: 'Feature Orderlist', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role TEST', feature_name: 'Feature Permissions', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role TEST', feature_name: 'Feedback', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role TEST', feature_name: 'Inbox', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role TEST', feature_name: 'Role Management', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role TEST', feature_name: 'Role Template', can_delete: true },
  { role_name: 'Role TEST', feature_name: 'TEST2', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role TEST', feature_name: 'Test feature', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role TEST', feature_name: 'Test-feature-1', can_read: true, can_create: true },
  { role_name: 'Role TEST', feature_name: 'Test-feature-2', can_read: true, can_create: true },
  { role_name: 'Role TEST', feature_name: 'Test-feature-3', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role TEST', feature_name: 'Test-Feature-4', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'Role TEST', feature_name: 'Test-Feature-5', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Access Denied', can_read: true },
  { role_name: 'super_admin', feature_name: 'Add Feature', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Add Role', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Add Template', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Admin', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Admin Roles', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Breadcrumb', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Chat', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Communication', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Configurator', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Currency Formatting', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Date/Time Formatting', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Edit Feature', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Edit Role', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Edit Template', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Email', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Feature Availability', can_read: true, can_create: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Feature availability mapping', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Feature Orderlist', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Feature Permissions', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Features', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Feedback', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Floating Configurator', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Footer', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Inbox', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Language Support', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Manage Preferences', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Menu', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Not Found', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Permissions', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Preferences', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Preferences Manager', can_read: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Profile', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Profile Activity', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Profile Notifications', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Profile Preferences', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Profile Security', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Role Management', can_delete: true },
  { role_name: 'super_admin', feature_name: 'Role Profile', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Roles', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Role Template', can_delete: true },
  { role_name: 'super_admin', feature_name: 'Settings', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Sidebar', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'TEST2', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Test feature', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Toast Notifications', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'super_admin', feature_name: 'Topbar', can_delete: true },
  { role_name: 'TEST ROLE 1', feature_name: 'Chat', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'TEST ROLE 1', feature_name: 'Communication', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'TEST ROLE 1', feature_name: 'Email', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'TEST ROLE 1', feature_name: 'Feature Availability', can_read: true, can_create: true, can_delete: true },
  { role_name: 'TEST ROLE 1', feature_name: 'Feature availability mapping', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'TEST ROLE 1', feature_name: 'Feature Orderlist', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'TEST ROLE 1', feature_name: 'Feature Permissions', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'TEST ROLE 1', feature_name: 'Feedback', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'TEST ROLE 1', feature_name: 'Inbox', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'TEST ROLE 1', feature_name: 'Profile', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'TEST ROLE 1', feature_name: 'Role Management', can_delete: true },
  { role_name: 'TEST ROLE 1', feature_name: 'Role Template', can_delete: true },
  { role_name: 'TEST ROLE 1', feature_name: 'Settings', can_update: true, can_delete: true },
  { role_name: 'TEST ROLE 1', feature_name: 'TEST2', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'TEST ROLE 1', feature_name: 'Test feature', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'TEST ROLE 1', feature_name: 'Test-feature-1', can_read: true, can_create: true },
  { role_name: 'TEST ROLE 1', feature_name: 'Test-feature-2', can_read: true, can_create: true },
  { role_name: 'TEST ROLE 1', feature_name: 'Test-feature-3', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'TEST ROLE 1', feature_name: 'Test-Feature-4', can_read: true, can_create: true, can_update: true, can_delete: true },
  { role_name: 'TEST ROLE 1', feature_name: 'Test-Feature-5', can_read: true, can_create: true, can_update: true, can_delete: true },
];




const seedCategoryTypes = [
  { name: 'Healthcare', code: 'HEALTHCARE', description: null, is_active: true },
  { name: 'Finance', code: 'FINANCE', description: null, is_active: true },
  { name: 'Admin', code: 'ADMIN', description: null, is_active: true },
  { name: 'Feature', code: 'FEATURE', description: 'Categories for application features and modules', is_active: true },
  { name: 'Role', code: 'ROLE', description: 'Role Category', is_active: true },
  { name: 'Feature', code: 'feature', description: 'Categories for application features and modules', is_active: true },
  { name: 'Role', code: 'role', description: 'Categories for roles and role templates', is_active: true },
  { name: 'Pharmacy', code: 'pharmacy', description: 'Categories for pharmacy medicines', is_active: true },
  { name: 'Inventory', code: 'inventory', description: 'Categories for general hospital inventory', is_active: true },
  { name: 'Role Templates', code: 'role Template', description: 'Categories for role templates', is_active: true },
  { name: 'Prescription Template', code: 'prescription_template', description: 'Categories for medicine templates', is_active: true },
];

const seedFeatureCategories = [
  { name: 'Core', code: 'core', display_order: 1 },
  { name: 'User Management', code: 'user_management', display_order: 2 },
  { name: 'Department Management', code: 'department_management', display_order: 3 },
  { name: 'Auth', code: 'auth', display_order: 4 },
  { name: 'Error', code: 'error', display_order: 5 },
  { name: 'Layout', code: 'layout', display_order: 6 },
  { name: 'UI', code: 'ui', display_order: 7 },
  { name: 'Services', code: 'services', display_order: 8 },
  { name: 'Internationalization', code: 'internationalization', display_order: 9 },
  { name: 'Patient Management', code: 'patient_management', display_order: 10 },
  { name: 'Medical', code: 'medical', display_order: 11 },
  { name: 'Financial', code: 'financial', display_order: 12 },
  { name: 'Reporting', code: 'reporting', display_order: 13 },
  { name: 'Feature Management', code: 'feature_management', display_order: 14 },
  { name: 'Role Management', code: 'role_management', display_order: 15 },
  { name: 'Dashboard', code: 'dashboard', display_order: 16 },
  { name: 'Scheduling', code: 'scheduling', display_order: 17 },
  { name: 'Appointment', code: 'appointment', display_order: 18 },
  { name: 'Support', code: 'support', display_order: 19 },
  { name: 'Staff Management', code: 'staff_management', display_order: 20 },
  { name: 'Records', code: 'records', display_order: 21 },
  { name: 'Settings', code: 'settings', display_order: 22 },
  { name: 'Administration', code: 'administration', display_order: 23 }
];

const seedRoleCategories = [
  { name: 'Administrative', code: 'administrative', display_order: 1 },
  { name: 'Medical', code: 'medical', display_order: 2 },
  { name: 'Support', code: 'support', display_order: 3 },
  { name: 'Finance', code: 'finance', display_order: 4 },
];




export const seedDatabase = async () => {
  try {
    // Seed category types early so dependent seeds can resolve category_id safely
    for (const catType of seedCategoryTypes) {
      await CategoryType.findOrCreate({
        where: { code: catType.code },
        defaults: {
          name: catType.name,
          description: catType.description,
          is_active: true,
        },
      });
    }
    logInfo('Category types seeded');

    // Seed categories early so roles/features can reference category_id instead of legacy text fields
    const featureType = await CategoryType.findOne({ where: { code: 'feature' } });
    if (featureType) {
      for (const cat of seedFeatureCategories) {
        await Category.findOrCreate({
          where: {
            code: cat.code,
            category_type_id: featureType.category_type_id
          },
          defaults: {
            category_type_id: featureType.category_type_id,
            name: cat.name,
            code: cat.code,
            display_order: cat.display_order,
            is_active: true,
          },
        });
      }
      logInfo('Feature categories seeded');
    }

    const roleType = await CategoryType.findOne({ where: { code: 'role' } });
    if (roleType) {
      for (const cat of seedRoleCategories) {
        await Category.findOrCreate({
          where: {
            code: cat.code,
            category_type_id: roleType.category_type_id
          },
          defaults: {
            category_type_id: roleType.category_type_id,
            name: cat.name,
            code: cat.code,
            display_order: cat.display_order,
            is_active: true,
          },
        });
      }
      logInfo('Role categories seeded');
    }

// Seed roles
    for (const role of seedRoles) {
      const roleType = await CategoryType.findOne({ where: { code: 'role' } });
      const category = roleType
        ? await Category.findOne({
            where: {
              name: role.category,
              category_type_id: roleType.category_type_id,
            },
          })
        : null;

      await Role.findOrCreate({
        where: { role_name: role.role_name },
        defaults: {
          role_name: role.role_name,
          description: role.description,
          category_id: category?.category_id || null,
          is_active: true,
        },
      });
    }
    logInfo('Roles seeded');

    // ── Seed super-admin user (must come after roles so role_id FK is valid) ─
    const seedAdminEmail = 'admin@myniq.com';
    const seedAdminPassword = 'Admin@123';
    const superAdminRole = await Role.findOne({ where: { role_name: 'super_admin' } });
    const [, adminCreated] = await User.findOrCreate({
      where: { account_email: seedAdminEmail },
      defaults: {
        account_email: seedAdminEmail,
        password: await bcrypt.hash(seedAdminPassword, 10),
        first_name: 'Super',
        last_name: 'Admin',
        phone: '+1234567890',
        is_active: true,
        is_main_user: true,
        role_id: superAdminRole?.role_id || 1,
      },
    });
    if (adminCreated) logInfo(`✅ Admin user created — email: ${seedAdminEmail}  password: ${seedAdminPassword}`);
    else logInfo(`ℹ️  Admin user already exists: ${seedAdminEmail}`);

    // Seed role templates
    for (const template of seedRoleTemplates) {
      const roleType = await CategoryType.findOne({ where: { code: 'role' } });
      const category = roleType
        ? await Category.findOne({
            where: {
              name: template.category,
              category_type_id: roleType.category_type_id,
            },
          })
        : null;

      await RoleTemplate.findOrCreate({
        where: { name: template.name },
        defaults: {
          name: template.name,
          category_id: category?.category_id || null,
          description: template.description,
          permissions: template.permissions,
          status: template.status,
        },
      });
    }
    logInfo('Role templates seeded');

    // Seed features - create all first ignoring parent constraints, then update parents
    // First pass: create all without parent_feature_id
    const featureMap = {};
    for (const feature of seedFeatures) {
      const { parent_feature_id, category_type_code, category_code, ...featureData } = feature;
      const featureType = category_type_code
        ? await CategoryType.findOne({ where: { code: category_type_code } })
        : null;
      const category = featureType && category_code
        ? await Category.findOne({
            where: {
              code: category_code,
              category_type_id: featureType.category_type_id,
            },
          })
        : null;

      const [createdOrExisting] = await Feature.findOrCreate({
        where: { feature_name: feature.feature_name },
        defaults: {
          ...featureData,
          category_id: category?.category_id || null,
        }
      });
      featureMap[feature.feature_name] = createdOrExisting;
    }

    // Second pass: update parent_feature_id safely
    for (const feature of seedFeatures) {
      if (feature.parent_feature_name) {
        const parentFeature = featureMap[feature.parent_feature_name];
        if (parentFeature && featureMap[feature.feature_name]) {
          await featureMap[feature.feature_name].update({
            parent_feature_id: parentFeature.feature_id
          });
        }
      }
    }
    logInfo('Features seeded');

    // Seed Availability Types
    const [angularType] = await AvailabilityType.findOrCreate({
      where: { code: 'ANGULAR' },
      defaults: { code: 'ANGULAR', name: 'Angular Web Client', is_active: true }
    });
    const [reactType] = await AvailabilityType.findOrCreate({
      where: { code: 'REACT' },
      defaults: { code: 'REACT', name: 'React Web Client', is_active: true }
    });
    const [mobileType] = await AvailabilityType.findOrCreate({
      where: { code: 'MOBILE' },
      defaults: { code: 'MOBILE', name: 'Mobile App Client', is_active: true }
    });

    // Link all features to ANGULAR and REACT availability types
    const featuresList = await Feature.findAll();
    for (const feature of featuresList) {
      if (angularType) {
        await FeatureAvailability.findOrCreate({
          where: { feature_id: feature.feature_id, availability_type_id: angularType.availability_type_id },
          defaults: { feature_id: feature.feature_id, availability_type_id: angularType.availability_type_id }
        });
      }
      if (reactType) {
        await FeatureAvailability.findOrCreate({
          where: { feature_id: feature.feature_id, availability_type_id: reactType.availability_type_id },
          defaults: { feature_id: feature.feature_id, availability_type_id: reactType.availability_type_id }
        });
      }
    }
    logInfo('Feature availabilities mapped');

    // Seed permissions
    const extraFeatures = ['Search', 'Meetings', 'Campaigns'];
    for (const perm of seedPermissions) {
      const role = await Role.findOne({ where: { role_name: perm.role_name } });
      if (!role) continue;

      const featuresToSeed = [perm.feature_name];
      if (perm.feature_name === 'Communication') {
        featuresToSeed.push(...extraFeatures);
      }

      for (const featName of featuresToSeed) {
        const feature = await Feature.findOne({ where: { feature_name: featName } });
        if (feature) {
          // Build a list of permission names from the boolean flags
          const permNames = [];
          if (perm.can_read) permNames.push('can_read');
          if (perm.can_create) permNames.push('can_create');
          if (perm.can_update) permNames.push('can_update');
          if (perm.can_delete) permNames.push('can_delete');
          if (permNames.length === 0) permNames.push('can_read'); // default

          for (const permName of permNames) {
            await FeaturePermission.findOrCreate({
              where: { role_id: role.role_id, feature_id: feature.feature_id, permission_name: permName },
              defaults: {
                role_id: role.role_id,
                feature_id: feature.feature_id,
                permission_name: permName,
                permission_display_name: `${permName.charAt(0).toUpperCase() + permName.slice(1)}`,
                is_enabled: true,
              },
            });
          }
        }
      }
    }
    logInfo('Permissions seeded');

  } catch (error) {
    console.error('Seeding error:', error);
  }
};

