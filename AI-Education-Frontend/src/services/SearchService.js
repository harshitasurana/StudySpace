import apiClient from './apiClient';

// Talks to api/search/search_routes.js. Goes through the shared apiClient
// so the request actually carries the Authorization header the backend's
// `authenticate` middleware requires - the raw fetch() call this replaces
// had no auth header at all, so it 401'd on every request and silently
// fell back to hardcoded mock results.
const SearchService = {
  // Returns { success, data: { query, total, results: [{ entity,
  // category, id, title, subtitle, description, route, meta }],
  // entity_counts, category_counts, ... } }
  async search(query, params = {}) {
    const { data } = await apiClient.get('/api/search', { params: { q: query, ...params } });
    return data;
  },
};

export default SearchService;