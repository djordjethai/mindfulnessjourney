import type { Metadata } from "next";
import { Search } from "@/components/Search";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Search",
  description: "Search the Mindfulness Journey journal.",
  alternates: { canonical: absoluteUrl("/search/") },
};

export default function SearchPage(): React.JSX.Element {
  return <main className="search-page shell reading-width"><header><p className="eyebrow">Find a reflection</p><h1>Search</h1></header><Search /></main>;
}
