import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "public", "logos");
const buckets = new Map();

function sizeOf(buffer, ext) {
  if (ext === "png" && buffer.length > 24) {
    return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
  }
  if (ext === "ico" && buffer.length > 8) {
    const count = buffer.readUInt16LE(4);
    let best = 0;
    for (let i = 0; i < count; i += 1) {
      const offset = 6 + i * 16;
      if (offset + 2 > buffer.length) break;
      const w = buffer[offset] === 0 ? 256 : buffer[offset];
      if (w > best) best = w;
    }
    return [best, best];
  }
  return null;
}

for (const name of readdirSync(dir)) {
  const ext = name.split(".").pop().toLowerCase();
  if (ext === "svg") continue;

  const size = sizeOf(readFileSync(join(dir, name)), ext);
  const width = size ? size[0] : 0;
  const bucket = width >= 128 ? "128+" : width >= 64 ? "64-127" : width >= 32 ? "32-63" : width > 0 ? "<32" : "bilinmiyor";
  buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
}

for (const [bucket, count] of [...buckets].sort()) {
  console.log(`${bucket.padEnd(12)} ${count}`);
}
