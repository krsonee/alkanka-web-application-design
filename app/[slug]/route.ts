import { hitShortLink } from "@/lib/short-links";
import { notFound } from "next/navigation";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const destination = await hitShortLink(slug);
  if (!destination) notFound();

  const res = NextResponse.redirect(destination, 302);
  res.headers.set("Cache-Control", "no-store, max-age=0");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}
