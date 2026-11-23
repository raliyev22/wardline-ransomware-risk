import type { Metadata } from "next";
import { SourcesPage } from "@/components/sources/sources-page";

export const metadata: Metadata = { title: "Sources & Assumptions" };

export default function Page() {
  return <SourcesPage />;
}
