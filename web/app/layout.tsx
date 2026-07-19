import type { Metadata } from "next";
import { Barlow_Condensed, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const disp = Barlow_Condensed({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-disp",
});
const body = IBM_Plex_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-body",
});
const mono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Kina Search",
  description:
    "Durchsuchbare Datenbank ueber 100.000+ Finds aus 75 Spreadsheets - mit Agent-Link-Converter, QC-Suche und Collections.",
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%2316222E'/%3E%3Ctext x='16' y='23' font-family='Arial Black,sans-serif' font-size='19' font-weight='900' fill='%23EDF0F2' text-anchor='middle'%3EK%3C/text%3E%3C/svg%3E",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${disp.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <script dangerouslySetInnerHTML={{ __html:
          `try{var p=JSON.parse(localStorage.getItem("prefs")||"{}");if(p.theme==="dark")document.documentElement.dataset.theme="dark";if(p.lang)document.documentElement.lang=p.lang}catch(e){}` }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
