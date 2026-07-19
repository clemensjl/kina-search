"use client";
import { SessionProvider } from "next-auth/react";
import PrefsProvider from "@/components/Prefs";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PrefsProvider>{children}</PrefsProvider>
    </SessionProvider>
  );
}
