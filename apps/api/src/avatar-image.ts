import sharp from 'sharp';

const MAX_INPUT_PIXELS = 40_000_000;
const AVATAR_SIZE = 512;

export class InvalidAvatarError extends Error {}

export async function normalizeAvatar(input: Buffer): Promise<Buffer> {
  try {
    const image = sharp(input, { failOn: 'warning', limitInputPixels: MAX_INPUT_PIXELS });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || !metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format)) throw new InvalidAvatarError('The image could not be decoded.');
    return await image.rotate().resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'centre' }).webp({ quality: 82 }).toBuffer();
  } catch (error) {
    if (error instanceof InvalidAvatarError) throw error;
    throw new InvalidAvatarError('Use a valid JPEG, PNG, or WebP image.');
  }
}
