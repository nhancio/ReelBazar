import type { Metadata } from "next";
import MyAcc from "../../components/MyAcc";

export const metadata: Metadata = {
  title: "What is your Instagram worth? — Rava",
  description:
    "Free Instagram worth calculator: followers, engagement rate, average views, and what to charge for 1 reel, 1 post and 1 story — plus your estimated account worth in ₹.",
  alternates: { canonical: "/myacc" },
  openGraph: {
    title: "What is your Instagram worth? — Rava",
    description: "Get your beautiful creator worth card in seconds. No signup.",
    url: "/myacc",
  },
};

export default function MyAccPage() {
  return <MyAcc />;
}
