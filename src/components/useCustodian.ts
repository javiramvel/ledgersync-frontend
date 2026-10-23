"use client";

import { useCallback, useEffect, useState } from "react";
import { connectCustodian, disconnectCustodian, getCustodianSnapshot } from "@/app/actions/custodian";
import type { CustodianSnapshot } from "@/lib/plaid";

/** Holds the Plaid custodian snapshot shared by the reconciliation and solvency panels. */
export function useCustodian() {
  const [snapshot, setSnapshot] = useState<CustodianSnapshot | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((s: CustodianSnapshot | null) => {
    setSnapshot(s);
    setSelected((cur) => (s && !s.positions.some((p) => p.id === cur) ? s.positions[0]?.id ?? "" : cur));
  }, []);

  const settle = useCallback(
    (res: Awaited<ReturnType<typeof getCustodianSnapshot>>) => {
      if (res.ok) apply(res.data);
      else setError(res.error);
      setLoading(false);
    },
    [apply],
  );

  useEffect(() => {
    getCustodianSnapshot().then(settle);
  }, [settle]);

  const refresh = useCallback(() => {
    setLoading(true);
    return getCustodianSnapshot().then(settle);
  }, [settle]);

  const link = useCallback(
    async (publicToken: string) => {
      setLoading(true);
      setError(null);
      const res = await connectCustodian(publicToken);
      if (res.ok) apply(res.data);
      else setError(res.error);
      setLoading(false);
    },
    [apply],
  );

  const unlink = useCallback(async () => {
    await disconnectCustodian();
    apply(null);
  }, [apply]);

  const position = snapshot?.positions.find((p) => p.id === selected) ?? null;
  return { snapshot, selected, setSelected, position, loading, error, link, unlink, refresh };
}

export type Custodian = ReturnType<typeof useCustodian>;
