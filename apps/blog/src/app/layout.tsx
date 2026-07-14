import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Under The Hood",
  url: "https://blog.mspk.me",
  description:
    "Deep technical essays on frontend internals, browser behavior, JavaScript, React, web performance, accessibility, and AI engineering.",
  publisher: {
    "@type": "Person",
    name: "Srikar Phanikumar Marti",
  },
};

export const metadata: Metadata = {
  metadataBase: new URL("https://blog.mspk.me"),
  title: {
    default: "Under The Hood | Frontend and AI Internals",
    template: "%s | Under The Hood",
  },
  description:
    "Deep technical essays on frontend internals, browser behavior, JavaScript, React, web performance, accessibility, and AI engineering.",
  applicationName: "Under The Hood",
  authors: [{ name: "Srikar Phanikumar Marti" }],
  creator: "Srikar Phanikumar Marti",
  publisher: "Under The Hood",
  category: "Technology",
  keywords: [
    "frontend engineering",
    "AI engineering",
    "browser internals",
    "JavaScript",
    "React",
    "web performance",
    "accessibility",
    "technical writing",
    "software engineering",
  ],
  alternates: {
    canonical: "/",
    types: {
      "application/rss+xml": "/rss.xml",
      "text/plain": "/llms.txt",
    },
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: "Under The Hood",
    description:
      "Deep technical essays on frontend internals, browser behavior, JavaScript, React, web performance, accessibility, and AI engineering.",
    url: "https://blog.mspk.me",
    siteName: "Under The Hood",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  twitter: {
    card: "summary",
    title: "Under The Hood",
    description:
      "Deep technical essays on frontend internals, browser behavior, JavaScript, React, web performance, accessibility, and AI engineering.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
