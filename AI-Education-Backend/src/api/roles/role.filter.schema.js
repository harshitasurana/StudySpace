export const ROLE_FILTER_SCHEMA = {
  searchable: ["role_name", "description", "$creator.first_name$", "$creator.last_name$", "$updater.first_name$", "$updater.last_name$"],
  exact: [
    "role_id",
    "role_name",
    "description",
    "category_id",
    "is_active",
    "is_deleted",
    "created_by",
    "updated_by",
  ],
  range: {
    number: [],
    date: ["created_at", "updated_at"],
  },
  sortable: [
    'updated_by_name',
    'created_by_name',"role_id", "role_name", "description", "created_at", "updated_at"],
};
