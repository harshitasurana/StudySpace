import fs from 'fs';
import path from 'path';

const ensureDir = async (dirPath) => {
  await fs.promises.mkdir(dirPath, { recursive: true });
};

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return fallback;
};

export default class LocalStorageProvider {
  constructor() {
    this.root = path.resolve(process.env.LOCAL_UPLOAD_ROOT || 'uploads');
    this.baseUrl = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
    this.checkExists = normalizeBoolean(process.env.STORAGE_CHECK_EXISTS, false);
  }

  async upload({ buffer, key, mimeType }) {
    const targetPath = path.join(this.root, ...key.split('/'));
    await ensureDir(path.dirname(targetPath));
    await fs.promises.writeFile(targetPath, buffer);

    return {
      key,
      mimeType,
      url: this.getPublicUrl(key),
    };
  }

  async download(key) {
    const targetPath = path.join(this.root, ...key.split('/'));
    return fs.promises.readFile(targetPath);
  }

  async delete(key) {
    const targetPath = path.join(this.root, ...key.split('/'));
    try {
      await fs.promises.unlink(targetPath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async exists(key) {
    const targetPath = path.join(this.root, ...key.split('/'));
    try {
      await fs.promises.access(targetPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  getPublicUrl(key) {
    return `${this.baseUrl}/uploads/${key}`;
  }

  async getSignedUrl(key) {
    if (this.checkExists && !(await this.exists(key))) {
      return null;
    }

    return this.getPublicUrl(key);
  }
}
