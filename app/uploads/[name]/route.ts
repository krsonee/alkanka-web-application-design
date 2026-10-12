import { readFile } from "fs/promises";
import { join } from "path";
import { UPLOAD_DIR, UPLOAD_TYPES } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAFE_NAME = /^[a-z0-9-]+\.(png|jpg|gif|webp)$/;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const match = SAFE_NAME.exec(name);
  if (!match) return new Response("Bulunamadı", { status: 404 });

  try {
    const bytes = await readFile(join(UPLOAD_DIR, name));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": UPLOAD_TYPES[match[1]],
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Bulunamadı", { status: 404 });
  }
}
