import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { SITE_NAME, SITE_SUBTITLE, SITE_URL } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — ${SITE_SUBTITLE}`, template: `%s — ${SITE_NAME}` },
  description: "Personal reflections on mindfulness, meditation, yoga, life in Thailand, and the journey toward inner peace.",
  icons: {
    icon: "/wp-content/uploads/2018/12/cropped-sajtmala-32x32.jpg",
    apple: "/wp-content/uploads/2018/12/cropped-sajtmala-180x180.jpg",
  },
  openGraph: { type: "website", siteName: SITE_NAME, title: SITE_NAME, description: SITE_SUBTITLE },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <Header />
        <div id="main-content">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
