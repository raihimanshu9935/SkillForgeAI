import crypto from "crypto";

const LRU = new Map();

export function keyFor({ projectId, question, ctx }) {
  const full =
    projectId +
    "|" +
    question +
    "|" +
    ctx.map((c) => c.file + ":" + c.score.toFixed(3)).join(",");
  return crypto.createHash("sha1").update(full).digest("hex");
}

export function get(key) {
  const hit = LRU.get(key);
  if (!hit) return null;
  if (Date.now() > hit.exp) {
    LRU.delete(key);
    return null;
  }
  return hit.val;
}

export function set(key, val, ttlSec) {
  LRU.set(key, { val, exp: Date.now() + ttlSec * 1000 });
}
