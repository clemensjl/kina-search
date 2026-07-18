// Agent-/QC-Link-Templates, verifiziert Jul 2026. Litbuy = Favorit.
// {id} = Item-ID, {url} = urlencodierte Original-URL. pf: wd|tb|al

export type Item = {
  n: string; b?: string; c: string; i?: string; s?: string;
  pf?: "wd" | "tb" | "al"; pid?: string; u?: string;
  pv?: number; pc?: string; p?: string;
  verified?: { rating: number; note?: string };
  _h?: string;
};

type Tpl = Partial<Record<"wd" | "tb" | "al" | "*", string>>;
export type Agent = { n: string; fav?: boolean; t: Tpl };

export const AGENTS: Agent[] = [
  { n: "Litbuy", fav: true, t: { wd: "https://litbuy.com/products/details?id={id}&channel=WEIDIAN", tb: "https://litbuy.com/products/details?id={id}&channel=TAOBAO", al: "https://litbuy.com/products/details?id={id}&channel=1688" } },
  { n: "Kakobuy", t: { "*": "https://www.kakobuy.com/item/details?url={url}" } },
  { n: "ACBuy", t: { wd: "https://www.acbuy.com/product?id={id}&source=WD", tb: "https://www.acbuy.com/product?id={id}&source=TB", al: "https://www.acbuy.com/product?id={id}&source=AL" } },
  { n: "Mulebuy", t: { wd: "https://mulebuy.com/product/?shop_type=weidian&id={id}", tb: "https://mulebuy.com/product/?shop_type=taobao&id={id}", al: "https://mulebuy.com/product/?shop_type=ali_1688&id={id}" } },
  { n: "Oopbuy", t: { wd: "https://www.oopbuy.com/product/weidian/{id}", tb: "https://www.oopbuy.com/product/1/{id}", al: "https://www.oopbuy.com/product/0/{id}" } },
  { n: "Hoobuy", t: { wd: "https://hoobuy.com/product/2/{id}", tb: "https://hoobuy.com/product/1/{id}", al: "https://hoobuy.com/product/0/{id}" } },
  { n: "Joyagoo", t: { wd: "https://joyagoo.com/product?id={id}&platform=WEIDIAN", tb: "https://joyagoo.com/product?id={id}&platform=TAOBAO", al: "https://joyagoo.com/product?id={id}&platform=ALI_1688" } },
  { n: "USFans", t: { wd: "https://www.usfans.com/product/3/{id}", tb: "https://www.usfans.com/product/2/{id}", al: "https://www.usfans.com/product/1/{id}" } },
  { n: "Superbuy", t: { "*": "https://www.superbuy.com/en/page/buy?from=search-input&url={url}" } },
  { n: "Sugargoo", t: { "*": "https://www.sugargoo.com/#/home/productDetail?productLink={url}" } },
  { n: "CSSBuy", t: { wd: "https://www.cssbuy.com/item-micro-{id}.html", tb: "https://www.cssbuy.com/item-{id}.html", al: "https://www.cssbuy.com/item-1688-{id}.html" } },
  { n: "AllChinaBuy", t: { "*": "https://www.allchinabuy.com/en/page/buy?from=search-input&url={url}" } },
  { n: "Orientdig", t: { wd: "https://orientdig.com/product/?shop_type=weidian&id={id}", tb: "https://orientdig.com/product/?shop_type=taobao&id={id}", al: "https://orientdig.com/product/?shop_type=ali_1688&id={id}" } },
  { n: "LovegoBuy", t: { wd: "https://www.lovegobuy.com/product?id={id}&shop_type=weidian", tb: "https://www.lovegobuy.com/product?id={id}&shop_type=taobao", al: "https://www.lovegobuy.com/product?id={id}&shop_type=ali_1688" } },
  { n: "OOTDBuy", t: { wd: "https://www.ootdbuy.com/goods/details?id={id}&channel=weidian", tb: "https://www.ootdbuy.com/goods/details?id={id}&channel=taobao", al: "https://www.ootdbuy.com/goods/details?id={id}&channel=1688" } },
  { n: "HipoBuy", t: { wd: "https://hipobuy.com/goods/details?id={id}&channel=WEIDIAN", tb: "https://hipobuy.com/goods/details?id={id}&channel=TAOBAO", al: "https://hipobuy.com/goods/details?id={id}&channel=1688" } },
  { n: "PonyBuy", t: { wd: "https://www.ponybuy.com/en-gb/goods?product_id={id}&platform=weidian", tb: "https://www.ponybuy.com/en-gb/goods?product_id={id}&platform=taobao", al: "https://www.ponybuy.com/en-gb/goods?product_id={id}&platform=1688" } },
  { n: "LoongBuy", t: { "*": "https://www.loongbuy.com/product-details?url={url}" } },
  { n: "iTaoBuy", t: { "*": "https://www.itaobuy.com/product-detail?url={url}" } },
  { n: "Basetao", t: { wd: "https://www.basetao.com/best-taobao-agent-service/products/agent/weidian/{id}.html", tb: "https://www.basetao.com/best-taobao-agent-service/products/agent/taobao/{id}.html", al: "https://www.basetao.com/best-taobao-agent-service/products/agent/1688/{id}.html" } },
  { n: "EastMallBuy", t: { "*": "https://eastmallbuy.com/index/item/index.html?searchlang=en&url={url}" } },
];

// Nur QC-Quellen mit echtem Produkt-Deep-Link (UUFinds/FinderQC sind
// Paste-basiert und landen sonst auf der Startseite)
export const QCDBS: Agent[] = [
  { n: "FindQC", t: { wd: "https://findqc.com/detail/WD/{id}", tb: "https://findqc.com/detail/TB/{id}", al: "https://findqc.com/detail/AL/{id}" } },
  { n: "JadeShip", t: { wd: "https://www.jadeship.com/item/weidian/{id}", tb: "https://www.jadeship.com/item/taobao/{id}", al: "https://www.jadeship.com/item/1688/{id}" } },
  { n: "Kakobuy QC", t: { "*": "https://www.kakobuy.com/item/details?url={url}" } },
  { n: "Litbuy QC", t: { wd: "https://litbuy.com/products/details?id={id}&channel=WEIDIAN", tb: "https://litbuy.com/products/details?id={id}&channel=TAOBAO", al: "https://litbuy.com/products/details?id={id}&channel=1688" } },
  { n: "Oopbuy QC", t: { wd: "https://www.oopbuy.com/product/weidian/{id}", tb: "https://www.oopbuy.com/product/1/{id}", al: "https://www.oopbuy.com/product/0/{id}" } },
  { n: "Hoobuy QC", t: { wd: "https://hoobuy.com/product/2/{id}", tb: "https://hoobuy.com/product/1/{id}", al: "https://hoobuy.com/product/0/{id}" } },
  { n: "OOTDBuy QC", t: { wd: "https://www.ootdbuy.com/goods/details?id={id}&channel=weidian", tb: "https://www.ootdbuy.com/goods/details?id={id}&channel=taobao", al: "https://www.ootdbuy.com/goods/details?id={id}&channel=1688" } },
];

export function rawUrl(it: Pick<Item, "pf" | "pid" | "u">): string {
  if (it.pf === "wd") return `https://weidian.com/item.html?itemID=${it.pid}`;
  if (it.pf === "tb") return `https://item.taobao.com/item.htm?id=${it.pid}`;
  if (it.pf === "al") return `https://detail.1688.com/offer/${it.pid}.html`;
  return it.u || "";
}

export function fillTpl(tpl: string, it: Item): string {
  return tpl.replace("{id}", it.pid || "").replace("{url}", encodeURIComponent(rawUrl(it)));
}

export function agentLink(a: Agent, it: Item): string | null {
  const tpl = it.pf ? a.t[it.pf] || a.t["*"] : rawUrl(it) ? a.t["*"] : null;
  return tpl ? fillTpl(tpl, it) : null;
}

export function itemKey(it: Item): string {
  return it.pf ? `${it.pf}:${it.pid}` : (it.u || it.n).slice(0, 300);
}
