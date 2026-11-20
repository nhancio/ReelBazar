import type { Metadata } from "next";
import MyAcc from "../components/MyAcc";

export const metadata: Metadata = {
  title: "What is your Instagram worth? — Rava",
  description:
    "Free Instagram worth calculator: followers, engagement rate, average views, and what to charge for 1 reel, 1 post and 1 story — plus your estimated account worth in ₹.",
  alternates: { canonical: "/myacc" },
};

// For today, rava.one opens straight on the Instagram-worth tool.
// The previous landing page is preserved untouched in components/LegacyLanding.tsx
// and still reachable at /legacy — restore it by rendering <LegacyLanding /> here.
export default function Home() {
  return <MyAcc />;
}
