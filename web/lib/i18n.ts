export type Lang = "de" | "en";

const S = {
  de: {
    search_ph: "Suche: Marke, Modell, Kategorie …",
    hits: "Treffer", items: "Artikel", all_cats: "Alle Kategorien",
    sort_rel: "Relevanz", sort_pa: "Preis aufsteigend", sort_pd: "Preis absteigend", sort_name: "Name A-Z",
    discover: "Entdecken", price_min: "€ min", price_max: "€ max",
    load_more: "Mehr laden", loading: "Lade Datenbank …",
    empty_title: "Nichts gefunden", empty_sub: "Andere Schreibweise oder weniger Filter versuchen.",
    footer: "Kina Search – Preise umgerechnet zum Tageskurs, ohne Gewähr. Links öffnen extern.",
    verified: "Von uns getestet", rating: "Bewertung",
    open_at: "Öffnen bei", original: "Original-Link", other_agents: "Bei anderem Agent öffnen",
    qc_photos: "QC-Fotos ansehen", copy_link: "Link kopieren", copied: "Kopiert",
    save: "Merken", saved: "Gemerkt",
    login: "Anmelden", logout: "Abmelden", submit_nav: "Einreichen", collections_nav: "Collections", admin_nav: "Admin",
    hello: "Preise anzeigen in …",
    ob_title: "Willkommen bei Kina Search", ob_sub: "Kurz einrichten – alles später oben in der Leiste änderbar.",
    ob_lang: "Sprache", ob_cur: "Währung", ob_theme: "Darstellung", ob_agent: "Dein Einkaufs-Agent",
    ob_agent_sub: "Produktlinks öffnen direkt bei deinem Agent.",
    ob_light: "Hell", ob_dark: "Dunkel", ob_done: "Los geht's",
    no_price: "Kein Preis angegeben",
  },
  en: {
    search_ph: "Search: brand, model, category …",
    hits: "results", items: "items", all_cats: "All categories",
    sort_rel: "Relevance", sort_pa: "Price low-high", sort_pd: "Price high-low", sort_name: "Name A-Z",
    discover: "Discover", price_min: "€ min", price_max: "€ max",
    load_more: "Load more", loading: "Loading database …",
    empty_title: "Nothing found", empty_sub: "Try a different spelling or fewer filters.",
    footer: "Kina Search – prices converted at daily rates, no guarantee. Links open externally.",
    verified: "Tested by us", rating: "Rating",
    open_at: "Open at", original: "Original link", other_agents: "Open with another agent",
    qc_photos: "View QC photos", copy_link: "Copy link", copied: "Copied",
    save: "Save", saved: "Saved",
    login: "Sign in", logout: "Sign out", submit_nav: "Submit", collections_nav: "Collections", admin_nav: "Admin",
    hello: "Show prices in …",
    ob_title: "Welcome to Kina Search", ob_sub: "Quick setup – everything can be changed later in the top bar.",
    ob_lang: "Language", ob_cur: "Currency", ob_theme: "Appearance", ob_agent: "Your shopping agent",
    ob_agent_sub: "Product links open directly at your agent.",
    ob_light: "Light", ob_dark: "Dark", ob_done: "Let's go",
    no_price: "No price listed",
  },
} as const;

export type TKey = keyof typeof S.de;

export function t(lang: Lang, key: TKey): string {
  return (S[lang] as Record<string, string>)[key] ?? S.de[key];
}
