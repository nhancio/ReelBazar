import { Router, Request, Response } from 'express';
import { authMiddleware, requireRegistered } from '../middleware/auth';
import { storage } from '../utils/firebase';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { createRateLimit } from '../middleware/rateLimit';
import { ALLOWED_IMAGE_TYPES, assertAllowedMimeType, assertFileSignature, safeObjectName } from '../utils/uploadSecurity';
import { ValidationError } from '../utils/validation';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const uploadRouter = Router();
const avatarRateLimit = createRateLimit({
  keyPrefix: 'upload-avatar',
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Too many avatar upload attempts. Please try again later.',
});

uploadRouter.post('/avatar', avatarRateLimit, authMiddleware, requireRegistered, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'File is required' });
    }

    assertAllowedMimeType(req.file.mimetype, ALLOWED_IMAGE_TYPES, 'image');
    assertFileSignature(req.file.buffer, req.file.mimetype, 'Image');

    const filename = safeObjectName('avatars', uuidv4(), req.file.originalname);
    const bucket = storage();
    const file = bucket.file(filename);

    await file.save(req.file.buffer, {
      resumable: false,
      metadata: {
        contentType: req.file.mimetype,
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });

    await file.makePublic();
    const url = `https://storage.googleapis.com/${bucket.name}/${filename}`;

    res.json({ url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error uploading avatar:', message);
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: error instanceof ValidationError ? message : 'Failed to upload avatar',
    });
  }
});
