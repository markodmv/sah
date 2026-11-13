import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Aktivnost from "./Aktivnost";

const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin", "latin-ext"], weight: ["600", "800"] });
const body = IBM_Plex_Sans({ variable: "--font-body", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ variable: "--font-mono", subsets: ["latin", "latin-ext"], weight: ["500"] });

export const metadata: Metadata = {
  title: "Šah",
  description: "Šahovski turniri u Hrvatskoj po dobnim skupinama i praćenje igrača",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Šah" },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#192024" },
  ],
};

// Odabrana tema se postavlja prije prvog crtanja, da stranica ne bljesne zadanim bojama
const POSTAVI_TEMU = `try{var t=localStorage.getItem("sah.tema");if(t&&t!=="zelena")document.documentElement.dataset.tema=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="hr" className={`${display.variable} ${body.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: POSTAVI_TEMU }} />
      </head>
      <body>
        {children}
        <Aktivnost />
      </body>
    </html>
  );
}
