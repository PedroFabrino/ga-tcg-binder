import { Suspense } from "react";
import { TableLoading } from "@/components/table/table-page-shell";
import { TablePageContent } from "@/components/table/table-page-content";

/**
 * `/stage` is the Table without controls, rendered at 16:9 for window capture.
 * It shares the Seat socket and Feed with `/t/[code]`; only the editable chrome
 * is omitted. Because it is the same Seat, opening it takes over that Seat from
 * an open Table tab (the normal newest-connection-wins rule).
 */
export default function StagePage() {
  return (
    <Suspense fallback={<TableLoading />}>
      <TablePageContent mode="stage" />
    </Suspense>
  );
}
