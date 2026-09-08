import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { InvalidAvatarError, normalizeAvatar } from './avatar-image.js';

describe('avatar normalization', () => {
  it('decodes and re-encodes an image as a 512px WebP square', async () => {
    const source = await sharp({ create: { width: 640, height: 480, channels: 4, background: '#063ac1' } }).png().withMetadata({ orientation: 6 }).toBuffer();
    const output = await normalizeAvatar(source);
    expect(await sharp(output).metadata()).toMatchObject({ width: 512, height: 512, format: 'webp' });
  });

  it('rejects undecodable input', async () => {
    await expect(normalizeAvatar(Buffer.from('not an image'))).rejects.toBeInstanceOf(InvalidAvatarError);
  });

  it('rejects a decodable but unapproved vector format', async () => {
    await expect(normalizeAvatar(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>'))).rejects.toBeInstanceOf(InvalidAvatarError);
  });
});
