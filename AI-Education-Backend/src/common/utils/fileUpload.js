import multer from 'multer';
import path from 'path';

const imageExtensions = ['.jpeg', '.jpg', '.png', '.gif', '.webp'];
const imageMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

const documentExtensions = ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.txt'];
const documentMimeTypes = [
  ...imageMimeTypes,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

const createFileFilter = ({ allowedExtensions, allowedMimeTypes, errorMessage }) => (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isExtensionAllowed = allowedExtensions.includes(ext);
  const isMimeTypeAllowed = allowedMimeTypes.includes(file.mimetype.toLowerCase());

  if (isExtensionAllowed && isMimeTypeAllowed) {
    return cb(null, true);
  }

  return cb(new Error(errorMessage));
};

const memoryStorage = multer.memoryStorage();

const imageFileFilter = createFileFilter({
  allowedExtensions: imageExtensions,
  allowedMimeTypes: imageMimeTypes,
  errorMessage: 'Error: Images Only!',
});

const documentFileFilter = createFileFilter({
  allowedExtensions: documentExtensions,
  allowedMimeTypes: documentMimeTypes,
  errorMessage: 'Error: Unsupported file type!',
});

export const uploadAvatar = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

export const uploadPhoto = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

export const uploadBranding = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

export const uploadDocuments = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: documentFileFilter,
}).single('document');

// A student's single consolidated PDF of every handwritten Sample Paper
// answer (not a per-question photo — see sample_paper_service.js).
const pdfFileFilter = createFileFilter({
  allowedExtensions: ['.pdf'],
  allowedMimeTypes: ['application/pdf'],
  errorMessage: 'Error: PDF files only!',
});

export const uploadSamplePaperAnswerPdf = multer({
  storage: memoryStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: pdfFileFilter,
}).single('pdf');

// A student's single image attachment on an AI Tutor chat message (a
// photo of a textbook problem, handwritten work, a diagram).
export const uploadChatImage = multer({
  storage: memoryStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: imageFileFilter,
}).single('image');
