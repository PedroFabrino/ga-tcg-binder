"use client";

import React, { useEffect, useRef, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { createQueryClient } from "@/lib/query-client";

interface QueryProviderProps {
  children: React.ReactNode;
}

export default function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(() => createQueryClient());
  const { data: session, status } = useSession();
  const previousUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (status === "loading") return;
    const currentUserId = session?.user?.id ?? null;

    if (
      previousUserIdRef.current !== undefined &&
      previousUserIdRef.current !== currentUserId
    ) {
      // User switched accounts or session cleared: purge cache immediately
      queryClient.clear();
    }

    previousUserIdRef.current = currentUserId;
  }, [session?.user?.id, status, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
