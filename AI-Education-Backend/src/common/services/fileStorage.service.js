import path from 'path';
import { getStorageProvider } from './storageProviderFactory.js';

const PRIVATE_URL_TTL_SECONDS = Number(process.env.SIGNED_URL_TTL_SECONDS || 900);

const sanitizeSegment = (value, fallback = 'unknown') => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
};

const stripUploadsPrefix = (value = '') => value.replace(/^\/?uploads\//, '').replace(/^\/+/, '');

const isExternalUrl = (value = '') => /^https?:\/\//i.test(value);

const buildFilename = (originalName = 'file.bin') => {
  const ext = path.extname(originalName) || '';
  const name = path.basename(originalName, ext);
  return `${Date.now()}-${sanitizeSegment(name, 'file')}${ext.toLowerCase()}`;
};

const normalizeStoredKey = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  if (isExternalUrl(value)) {
    return null;
  }

  if (value.startsWith('/uploads/')) {
    return stripUploadsPrefix(value);
  }

  if (value.startsWith('uploads/')) {
    return stripUploadsPrefix(value);
  }

  return value.replace(/^\/+/, '');
};

export const FILE_VISIBILITY = {
  PUBLIC: 'public',
  PRIVATE: 'private',
};

export const STORAGE_CATEGORIES = {
  AVATAR: 'avatar',
  BRANDING: 'branding',
  SAMPLE_PAPER_SOURCE: 'sample_paper_source',
  SAMPLE_PAPER_SOLUTION: 'sample_paper_solution',
  SAMPLE_PAPER_ANSWER: 'sample_paper_answer',
  AI_TUTOR_CHAT_IMAGE: 'ai_tutor_chat_image',
};

export const buildStorageKey = ({
  category, organizationId, userId, assetType, originalName,
  samplePaperId, attemptId, questionId, conversationId,
}) => {
  const tenantId = organizationId;

  switch (category) {
    case STORAGE_CATEGORIES.AVATAR:
      return [
        'avatars',
        sanitizeSegment(tenantId),
        sanitizeSegment(userId, 'pending'),
        buildFilename(originalName),
      ].join('/');
    case STORAGE_CATEGORIES.BRANDING:
      return [
        'branding',
        sanitizeSegment(tenantId),
        sanitizeSegment(assetType, 'asset'),
        buildFilename(originalName),
      ].join('/');
    case STORAGE_CATEGORIES.SAMPLE_PAPER_SOURCE:
      return [
        'sample-papers',
        'sources',
        sanitizeSegment(samplePaperId, 'pending'),
        buildFilename(originalName),
      ].join('/');
    case STORAGE_CATEGORIES.SAMPLE_PAPER_SOLUTION:
      return [
        'sample-papers',
        'solutions',
        sanitizeSegment(samplePaperId, 'pending'),
        buildFilename(originalName),
      ].join('/');
    case STORAGE_CATEGORIES.SAMPLE_PAPER_ANSWER:
      // One consolidated PDF per attempt (not per-question) — see
      // sample_paper_service.js's uploadAnswerPdfService.
      return [
        'sample-papers',
        'answers',
        sanitizeSegment(tenantId),
        sanitizeSegment(attemptId, 'pending'),
        buildFilename(originalName),
      ].join('/');
    case STORAGE_CATEGORIES.AI_TUTOR_CHAT_IMAGE:
      return [
        'ai-tutor',
        'chat-images',
        sanitizeSegment(userId, 'pending'),
        sanitizeSegment(conversationId, 'pending'),
        buildFilename(originalName),
      ].join('/');
    default:
      throw new Error(`Unsupported storage category: ${category}`);
  }
};

export const uploadStoredFile = async ({ file, key, visibility = FILE_VISIBILITY.PUBLIC, metadata = {} }) => {
  if (!file) {
    throw new Error('File is required for upload');
  }

  const provider = getStorageProvider();
  const isPublic = visibility === FILE_VISIBILITY.PUBLIC;
  const buffer = file.buffer || Buffer.alloc(0);

  return provider.upload({
    buffer,
    mimeType: file.mimetype,
    originalName: file.originalname || file.filename,
    key,
    isPublic,
    metadata,
  });
};

export const resolveStoredFileUrl = async (value, { visibility = FILE_VISIBILITY.PUBLIC, expiresIn = PRIVATE_URL_TTL_SECONDS } = {}) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  if (isExternalUrl(value)) {
    return value;
  }

  const key = normalizeStoredKey(value);
  if (!key) {
    return null;
  }

  const provider = getStorageProvider();
  const isPublic = visibility === FILE_VISIBILITY.PUBLIC;
  return isPublic
    ? provider.getPublicUrl(key, { isPublic: true })
    : provider.getSignedUrl(key, { expiresIn, isPublic: false });
};

// Server-to-server raw bytes read-back (e.g. handing a stored file's
// content to another internal service) — distinct from resolveStoredFileUrl,
// which only ever gives a browser something to fetch itself.
export const downloadStoredFile = async (value, { visibility = FILE_VISIBILITY.PRIVATE } = {}) => {
  const key = normalizeStoredKey(value);
  if (!key) {
    throw new Error('A valid storage key is required');
  }

  const provider = getStorageProvider();
  return provider.download(key, { isPublic: visibility === FILE_VISIBILITY.PUBLIC });
};

export const deleteStoredFile = async (value, { visibility = FILE_VISIBILITY.PUBLIC } = {}) => {
  const key = normalizeStoredKey(value);
  if (!key) {
    return;
  }

  const provider = getStorageProvider();
  await provider.delete(key, { isPublic: visibility === FILE_VISIBILITY.PUBLIC });
};

export const normalizeStoredFileKey = normalizeStoredKey;

export const mapDocumentArrayWithUrls = async (documents, { visibility = FILE_VISIBILITY.PRIVATE } = {}) => {
  if (!Array.isArray(documents)) {
    return documents;
  }

  return Promise.all(documents.map(async (document) => {
    if (!document?.path) {
      return document;
    }

    return {
      ...document,
      path: await resolveStoredFileUrl(document.path, { visibility }),
    };
  }));
};
