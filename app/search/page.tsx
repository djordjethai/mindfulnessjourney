import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { Search } from "@/components/Search";
import { absoluteUrl } from "@/lib/seo";
import { searchStructuredData } from "@/lib/structured-data";

const description = "Search the Mindfulness Journey journal.";

export const metadata: Metadata = {
  title: "Search",
  description,
  alternates: { canonical: absoluteUrl("/search/") },
};

export default function SearchPage(): React.JSX.Element {
  return <main className="search-page shell reading-width"><JsonLd data={searchStructuredData(description)} /><header><p className="eyebrow">Find a reflection</p><h1>Search</h1></header><Search /></main>;
}
