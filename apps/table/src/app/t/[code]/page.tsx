import { Suspense } from "react";
import { TableLoading } from "@/components/table/table-page-shell";
import { TablePageContent } from "@/components/table/table-page-content";

export default function TablePage() {
  // `useSearchParams` needs a Suspense boundary during prerendering.
  return (
    <Suspense fallback={<TableLoading />}>
      <TablePageContent />
    </Suspense>
  );
}
