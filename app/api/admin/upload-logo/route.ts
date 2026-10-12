import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/admin-gate";
import { slugify } from "@/lib/slug";
import { detectImageType, MAX_UPLOAD_BYTES, writeImageFile } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const unauth = await requireAuth();
  if (unauth) return unauth;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Dosya okunamadı" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Dosya seçilmedi" }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "Dosya en fazla 8 MB olabilir" },
      { status: 413 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) {
    return NextResponse.json(
      { error: "Yalnızca PNG, JPG, WEBP ve GIF yüklenebilir" },
      { status: 415 },
    );
  }

  // Dosya adı hiçbir zaman istemciden gelen adla kurulmaz. Baytlar olduğu
  // gibi yazılır; hareketli GIF yeniden kodlanmaz.
  const base = slugify(String(form.get("name") ?? "")) || "logo";
  const fileName = `${base}-${randomBytes(4).toString("hex")}.${type}`;
  const url = await writeImageFile(fileName, bytes);

  return NextResponse.json({ url }, { status: 201 });
}
