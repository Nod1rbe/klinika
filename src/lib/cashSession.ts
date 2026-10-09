// Ochiq kassa smenasi — Kassa sahifasining tepa paneli va Smena tabi
// bir xil ma'lumotni ko'rsatishi uchun umumiy hook. To'lov, sotuv yoki smena
// amalidan keyin notifyCashChanged() chaqiriladi va hamma joy yangilanadi.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

const EVENT = "klinika:cash-changed";

export function notifyCashChanged(): void {
  window.dispatchEvent(new Event(EVENT));
}

export interface OpenShift {
  id: string;
  openedByName: string;
  openedAt: string;
  openingCash: number;
  expectedCash: number;
  cardTotal: number;
}

export function useOpenShift(): {
  shift: OpenShift | null;
  loaded: boolean;
  reload: () => void;
} {
  const [shift, setShift] = useState<OpenShift | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    if (!supabase) {
      setLoaded(true);
      return;
    }
    const { data } = await supabase
      .from("cash_sessions")
      .select("*")
      .eq("status", "OCHIQ")
      .limit(1);
    const row = data?.[0];
    if (!row) {
      setShift(null);
      setLoaded(true);
      return;
    }
    const { data: sum } = await supabase.rpc("cash_session_summary", {
      p_session_id: row.id,
    });
    setShift({
      id: row.id,
      openedByName: row.opened_by_name ?? "",
      openedAt: row.opened_at,
      openingCash: Number(row.opening_cash),
      expectedCash: Number(sum?.expectedCash ?? row.opening_cash),
      cardTotal: Number(sum?.cardTotal ?? 0),
    });
    setLoaded(true);
  }, []);

  useEffect(() => {
    reload();
    const onChange = () => reload();
    window.addEventListener(EVENT, onChange);
    const id = setInterval(reload, 60000);
    return () => {
      window.removeEventListener(EVENT, onChange);
      clearInterval(id);
    };
  }, [reload]);

  return { shift, loaded, reload };
}
