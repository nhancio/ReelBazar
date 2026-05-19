import path from 'node:path';
import { ValidationError } from './validation';

type AllowedMime = Set<string>;

const IMAGE_SIGNATURES: Record<string, (buffer: Buffer) => boolean> = {
  'image/jpeg': (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  'image/png': (buffer) =>
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a,
  'image/webp': (buffer) =>
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  'image/gif': (buffer) =>
    buffer.length >= 6 &&
    (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' ||
      buffer.subarray(0, 6).toString('ascii') === 'GIF89a'),
};

function isIsoBmff(buffer: Buffer): boolean {
  return buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp';
}

function isoBmffBrand(buffer: Buffer): string {
  return isIsoBmff(buffer) ? buffer.subarray(8, 12).toString('ascii') : '';
}

const VIDEO_SIGNATURES: Record<string, (buffer: Buffer) => boolean> = {
  'video/mp4': (buffer) => {
    const brand = isoBmffBrand(buffer);
    return ['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'M4V '].includes(brand);
  },
  'video/quicktime': (buffer) => isoBmffBrand(buffer) === 'qt  ',
  'video/webm': (buffer) =>
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3,
};

export const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
export const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

export function assertAllowedMimeType(mimetype: string, allowed: AllowedMime, label: string): void {
  if (!allowed.has(mimetype)) {
    throw new ValidationError(`Invalid ${label} type`);
  }
}

export function assertFileSignature(buffer: Buffer, mimetype: string, label: string): void {
  const validators = { ...IMAGE_SIGNATURES, ...VIDEO_SIGNATURES };
  const validator = validators[mimetype];

  if (!validator || !validator(buffer)) {
    throw new ValidationError(`${label} content does not match the declared MIME type`);
  }
}

export function safeObjectName(prefix: string, id: string, originalName: string): string {
  const ext = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, '');
  return `${prefix}/${id}${ext}`;
}
