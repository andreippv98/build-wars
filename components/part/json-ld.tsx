import { jsonLdString, type JsonLd as JsonLdData } from "@/lib/seo/json-ld";

/** Emits structured data for search engines. */
export function JsonLd({ data }: { data: JsonLdData | JsonLdData[] }) {
  return (
    <script
      type="application/ld+json"
      // The string is built by jsonLdString, which escapes "<".
      dangerouslySetInnerHTML={{ __html: jsonLdString(data) }}
    />
  );
}
