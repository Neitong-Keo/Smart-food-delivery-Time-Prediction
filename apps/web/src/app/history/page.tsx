import type { Metadata } from "next";

import { HistoryList } from "@/components/history/HistoryList";

export const metadata: Metadata = { title: "Prediction History" };

export default function HistoryPage() {
  return <HistoryList />;
}
