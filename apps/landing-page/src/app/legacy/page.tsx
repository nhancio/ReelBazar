import type { Metadata } from "next";
import LegacyLanding from "../../components/LegacyLanding";

export const metadata: Metadata = {
  title: "Rava — Shop From Reels",
  robots: { index: false, follow: true },
};

export default function LegacyPage() {
  return <LegacyLanding />;
}
