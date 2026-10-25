import apiClient from './apiClient';
import { ENDPOINTS } from '../api/endpoints';

const ProfileService = {
  async getProfile() {
    const { data } = await apiClient.get(ENDPOINTS.profile.get);
    return data;
  },

  async updateProfile(payload) {
    const { data } = await apiClient.patch(ENDPOINTS.profile.update, payload);
    return data;
  },
};

export default ProfileService;
