import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

// public/ klasörü derleme anında dondurulur ve barındırma ortamında her
// yayında sıfırlanır; yüklenen dosyalar kalıcı bir klasöre yazılıp
// /uploads/<ad> yolundan servis edilir. Render'da bu klasör /var/data/uploads.
export const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), "uploads");

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const UPLOAD_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

export function detectImageType(bytes: Uint8Array): keyof typeof UPLOAD_TYPES | null {
  const startsWith = (...signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png";
  if (startsWith(0xff, 0xd8, 0xff)) return "jpg";
  if (startsWith(0x47, 0x49, 0x46, 0x38)) return "gif";
  const ascii = (offset: number, text: string) => [...text].every((char, i) => bytes[offset + i] === char.charCodeAt(0));
  if (bytes.length >= 12 && ascii(0, "RIFF") && ascii(8, "WEBP")) return "webp";
  return null;
}

export async function writeImageFile(fileName: string, bytes: Uint8Array) {
  if (!/^[a-z0-9-]+\.(png|jpg|gif|webp)$/.test(fileName)) throw new Error("Geçersiz dosya adı");
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(join(UPLOAD_DIR, fileName), bytes);
  return `/uploads/${fileName}`;
}
