import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "foia.fun | FOIA Idea Board",
  description:
    "Anonymous FOIA brainstorming board for one-night events. Submit ideas, comment, and upvote.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} antialiased`}
      >
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
          <header className="mx-auto w-full max-w-5xl px-4 pt-8 sm:px-6">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan-200/80">
              foia.fun
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">
              FOIA Idea Board
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-200/80 sm:text-base">
              Anonymous event board for FOIA request ideas. No accounts, just
              crowd-sourced signal.
            </p>
            <p className="mt-3 inline-flex items-center rounded-full border border-amber-300/60 bg-amber-200/10 px-3 py-1 text-[11px] font-medium tracking-[0.14em] text-amber-200">
              LIVE FOR ONE NIGHT
            </p>
          </header>
          <main className="mx-auto w-full max-w-5xl animate-enter px-4 pb-10 pt-6 sm:px-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
