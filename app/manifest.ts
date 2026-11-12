import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Šah – turniri i igrači",
    short_name: "Šah",
    description: "Šahovski turniri u Hrvatskoj po dobnim skupinama i praćenje igrača",
    lang: "hr",
    start_url: "/",
    display: "standalone",
    background_color: "#eef1f3",
    theme_color: "#0e6655",
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
  };
}
