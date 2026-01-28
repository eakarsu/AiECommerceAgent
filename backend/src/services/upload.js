import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Upload directory
const uploadDir = join(__dirname, '../../uploads');
const productImagesDir = join(uploadDir, 'products');

// Ensure directories exist
if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
if (!existsSync(productImagesDir)) mkdirSync(productImagesDir, { recursive: true });

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.params.type || 'general';
    let dir = uploadDir;

    if (type === 'products') {
      dir = productImagesDir;
    }

    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'), false);
  }
};

// Create multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
    files: 10 // Max 10 files at once
  }
});

// Export different upload configurations
export const uploadSingle = upload.single('image');
export const uploadMultiple = upload.array('images', 10);

// Helper to get image URL
export const getImageUrl = (filename, type = 'products') => {
  return `/uploads/${type}/${filename}`;
};

// Helper to get full path
export const getImagePath = (filename, type = 'products') => {
  return join(uploadDir, type, filename);
};

export default {
  uploadSingle,
  uploadMultiple,
  getImageUrl,
  getImagePath,
  uploadDir
};
