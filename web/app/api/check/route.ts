import { NextResponse } from "next/server";

export const maxDuration = 60;

const LIVE = '&#34;shopName&#34;';
const DEAD = "商品不存在";
const IMG = /https:\/\/si\.geilicdn\.com\/[^"'\s\\]+?\.(?:jpg|jpeg|png|webp)[^"'\s\\]*/g;

function pickProductImg(un: string): string | undefined {
  const all = un.match(IMG) || [];
  // kleine Assets (Shop-Icons/Banner) haben "_<w>_<h>"-Suffixe unter 200px
  for (const u of all) {
    const m = u.match(/_(\d{2,4})_(\d{2,4})[._]/);
    if (!m || (parseInt(m[1]) >= 200 && parseInt(m[2]) >= 200)) return u;
  }
  return all[0];
}
const PRICE = /"(?:price|minPrice|itemPrice|priceText)"\s*:\s*"?(\d+(?:\.\d+)?)"?/;

async function checkOne(id: string) {
  try {
    const r = await fetch(`https://weidian.com/item.html?itemID=${id}`, {
      headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15" },
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (r.status === 403 || r.status === 429) return { id, s: "blocked" };
    if (r.status !== 200) return { id, s: "unknown" };
    const t = await r.text();
    if (t.includes(LIVE)) {
      const un = t.replace(/&#34;/g, '"').replace(/\\u002F/g, "/");
      const img = pickProductImg(un);
      const pm = un.match(PRICE)?.[1];
      let price: number | undefined;
      if (pm) {
        const v = parseFloat(pm);
        price = v > 10000 ? v / 100 : v;
      }
      return { id, s: "ok", img, price };
    }
    if (t.includes(DEAD) || t.length < 27000) return { id, s: "dead" };
    return { id, s: "unknown" };
  } catch {
    return { id, s: "unknown" };
  }
}

export async function POST(request: Request) {
  const key = request.headers.get("x-crawl-key");
  if (!process.env.CRAWL_KEY || key !== process.env.CRAWL_KEY) {
    return NextResponse.json({ error: "key" }, { status: 403 });
  }
  const { ids } = await request.json().catch(() => ({ ids: [] }));
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 20) {
    return NextResponse.json({ error: "1-20 ids" }, { status: 400 });
  }
  const results = [];
  for (let i = 0; i < ids.length; i += 5) {
    results.push(...await Promise.all(ids.slice(i, i + 5).map((id: string) => checkOne(String(id)))));
  }
  return NextResponse.json({ results });
}
