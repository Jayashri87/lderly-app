import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "LDERLY Care",
    short_name: "LDERLY",
    description: "Book, track, and coordinate trusted elder care for family.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#06130f",
    theme_color: "#06130f",
    categories: ["health", "lifestyle", "medical"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ],
    shortcuts: [
      {
        name: "Book care",
        short_name: "Book",
        description: "Arrange care for a parent",
        url: "/?action=book",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }]
      },
      {
        name: "Immediate assistance",
        short_name: "SOS",
        description: "Open immediate assistance",
        url: "/?action=immediate",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }]
      }
    ]
  };
}
