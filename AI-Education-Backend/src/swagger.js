import swaggerJSDoc from "swagger-jsdoc";
import 'dotenv/config';

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Education Platform API",
      version: "1.0.0",
      description: "API for a single-tenant, fully-local education platform for students, staff, and AI/RAG features",
    },
    servers: [{ url: process.env.BASE_URL || "http://localhost:5000" }],
    security: [{ bearerAuth: [] }],
    tags: [
      {
        name: "Search",
        description: "Global entity search across platform modules"
      },
      {
        name: "Profile Notifications",
        description: "User notification management (Industry Standard)"
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
            schemas: {
        AuditFields: {
          type: "object",
          properties: {
            created_at: { type: "string", format: "date-time", example: "2026-01-01T00:00:00Z" },
            updated_at: { type: "string", format: "date-time", example: "2026-01-01T00:00:00Z", nullable: true },
            created_by: { type: "integer", example: 1, nullable: true },
            updated_by: { type: "integer", example: 1, nullable: true },
            created_by_name: { type: "string", example: "Admin User", description: "Full name of creator", nullable: true },
            updated_by_name: { type: "string", example: "Admin User", description: "Full name of updater", nullable: true },
          }
        },
        Admin: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            name: { type: "string", example: "Super Admin" },
            account_email: { type: "string", example: "admin@example.com" },
            username: { type: "string", example: "superadmin" },
            password: { type: "string", example: "SecurePass123" },
            refresh_token: { type: "string", nullable: true, example: "jwt_refresh_token" },
          },
        },
        Role: {
          type: "object",
          properties: {
            role_id: { type: "integer", example: 1 },
            role_name: { type: "string", example: "teacher" },
            permissions: { type: "object", additionalProperties: true, example: { "read": true, "write": false } },
          },
        },
        MenuItem: {
          type: "object",
          properties: {
            label: { type: "string", example: "menu.students" },
            icon: { type: "string", example: "pi pi-user" },
            routerLink: { type: "array", items: { type: "string" } },
            feature: { type: "string", nullable: true, example: "Students" },
            public: { type: "boolean", nullable: true, example: false },
            items: {
              type: "array",
              items: { $ref: '#/components/schemas/MenuItem' }
            }
          }
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            message: {
              type: "string",
              example: "Error message",
            },
            details: {
              type: "string",
              example: "Additional error details",
            },
          },
        },
        Notification: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              example: "123e4567-e89b-12d3-a456-426614174000"
            },
            title: {
              type: "string",
              example: "New announcement posted"
            },
            message: {
              type: "string",
              example: "A new announcement has been posted for your class"
            },
            type: {
              type: "string",
              enum: ["SYSTEM", "ANNOUNCEMENT", "MESSAGE", "SECURITY", "REMINDER"],
              example: "ANNOUNCEMENT"
            },
            is_read: {
              type: "boolean",
              example: false
            },
            createdAt: {
              type: "string",
              format: "date-time",
              example: "2023-10-01T12:00:00Z"
            }
          }
        },
        NotificationPreferences: {
          type: "object",
          properties: {
            email_security_alerts: { type: "boolean", example: true },
            email_account_updates: { type: "boolean", example: true },
            email_newsletter: { type: "boolean", example: false },
            push_login_alerts: { type: "boolean", example: true },
            push_critical_updates: { type: "boolean", example: true },
            push_reminders: { type: "boolean", example: false },
            system_task_updates: { type: "boolean", example: true },
            system_comments: { type: "boolean", example: true },
            system_mentions: { type: "boolean", example: true }
          }
        },
        Feature: {
      type: "object",
      properties: {
        feature_id: {
          type: "integer",
          description: "Unique identifier for the feature",
        },
        feature_name: {
          type: "string",
          description: "Name of the feature",
        },
        description: {
          type: "string",
          description: "Description of the feature",
        },
        category: {
          type: "string",
          description: "Category the feature belongs to",
        },
        parent_feature_id: {
          type: "integer",
          nullable: true,
          description: "ID of the parent feature (for hierarchical features)",
        },
        show_in_menu: {
          type: "boolean",
          description: "Whether the feature should be shown in the menu",
        },
        menu_label: {
          type: "string",
          description: "Label to display in the menu",
        },
        menu_icon: {
          type: "string",
          description: "Icon for the menu item",
        },
        is_active: {
          type: "boolean",
          description: "Whether the feature is active",
        },
        is_deleted: {
          type: "boolean",
          description: "Whether the feature is deleted",
        },
        created_by: {
          type: "integer",
          nullable: true,
          description: "ID of the user who created the feature",
        },
        created_at: {
          type: "string",
          format: "date-time",
          description: "Creation timestamp",
        },
        updated_at: {
          type: "string",
          format: "date-time",
          description: "Last update timestamp",
        },
      },
    },
    FeaturePermission: {
      type: "object",
      properties: {
        role_id: {
          type: "integer",
          description: "ID of the role",
        },
        can_read: {
          type: "boolean",
          description: "Read permission",
        },
        can_create: {
          type: "boolean",
          description: "Create permission",
        },
        can_update: {
          type: "boolean",
          description: "Update permission",
        },
        can_delete: {
          type: "boolean",
          description: "Delete permission",
        },
      },
    },
    PaginatedFeaturesResponse: {
      type: "object",
      properties: {
        success: {
          type: "boolean",
          example: true,
        },
        message: {
          type: "string",
          example: "Features retrieved successfully",
        },
        data: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                $ref: "#/components/schemas/Feature",
              },
            },
            total: {
              type: "integer",
              description: "Total number of features",
            },
            page: {
              type: "integer",
              description: "Current page number",
            },
            totalPages: {
              type: "integer",
              description: "Total number of pages",
            },
            limit: {
              type: "integer",
              description: "Items per page",
            },
            offset: {
              type: "integer",
              description: "Offset for pagination",
            },
          },
        },
      },
    },
    FeaturesListResponse: {
      type: "object",
      properties: {
        success: {
          type: "boolean",
          example: true,
        },
        message: {
          type: "string",
          example: "Features retrieved successfully",
        },
        data: {
          type: "array",
          items: {
            $ref: "#/components/schemas/Feature",
          },
        },
      },
    },
    FeatureResponse: {
      type: "object",
      properties: {
        success: {
          type: "boolean",
          example: true,
        },
        message: {
          type: "string",
          example: "Feature retrieved successfully",
        },
        data: {
          $ref: "#/components/schemas/Feature",
        },
      },
    },
    CreateFeatureRequest: {
      type: "object",
      required: ["feature_name"],
      properties: {
        feature_name: {
          type: "string",
          minLength: 1,
          maxLength: 100,
              example: "Student Management",
        },
        description: {
          type: "string",
          maxLength: 500,
              example: "Manage students",
        },
            category_id: {
              type: "integer",
              example: 13,
        },
        parent_feature_id: {
          type: "integer",
              nullable: true,
              example: null,
        },
        show_in_menu: {
          type: "boolean",
          example: true,
        },
        menu_label: {
          type: "string",
          maxLength: 100,
              example: "menu.students",
        },
        menu_icon: {
          type: "string",
          maxLength: 200,
              example: "pi pi-users",
            },
            router_link: {
              type: "string",
              maxLength: 255,
              example: "/students",
            },
            menu_order: {
              type: "integer",
              example: 18,
        },
        is_active: {
          type: "boolean",
          example: true,
        },
        permissions: {
          type: "array",
          items: {
                type: "string",
          },
              example: ["create", "read", "update", "delete"]
        },
      },
    },
    UpdateFeatureRequest: {
      type: "object",
      properties: {
        feature_name: {
          type: "string",
          minLength: 1,
          maxLength: 100,
              example: "Student Management",
        },
        description: {
          type: "string",
          maxLength: 500,
              example: "Manage students",
        },
            category_id: {
              type: "integer",
              example: 13,
        },
        parent_feature_id: {
          type: "integer",
              nullable: true,
              example: null,
        },
        show_in_menu: {
          type: "boolean",
          example: true,
        },
        menu_label: {
          type: "string",
          maxLength: 100,
              example: "menu.students",
        },
        menu_icon: {
          type: "string",
          maxLength: 200,
              example: "pi pi-users",
            },
            router_link: {
              type: "string",
              maxLength: 255,
              example: "/students",
            },
            menu_order: {
              type: "integer",
              example: 18,
        },
        is_active: {
          type: "boolean",
          example: true,
        },
        permissions: {
          type: "array",
          items: {
                type: "string",
          },
              example: ["create", "read", "update", "delete"]
        },
      },
    },
      },
    },
  },
  apis: ["./src/api/**/*.js"],
};

const swaggerSpec = swaggerJSDoc(options);
export default swaggerSpec;

