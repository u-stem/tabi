import { and, eq, inArray } from "drizzle-orm";
import type { db as rootDb } from "../db/index";
import { schedules } from "../db/schema";

export type AnchorInput = {
  scheduleId: string;
  anchor: "before" | "after" | null;
  anchorSourceId: string | null;
};

export type AnchorValidateResult = { ok: true } | { ok: false; status: 400; message: string };

// Accepts either the root Drizzle client or a transaction handle; both expose
// `query.schedules.findMany` with the same shape.
type DbOrTx = typeof rootDb | Parameters<Parameters<typeof rootDb.transaction>[0]>[0];

export async function validateAnchors(
  dbOrTx: DbOrTx,
  tripId: string,
  patternId: string,
  anchors: AnchorInput[],
): Promise<AnchorValidateResult> {
  for (const a of anchors) {
    if ((a.anchor === null) !== (a.anchorSourceId === null)) {
      return {
        ok: false,
        status: 400,
        message: "anchor と anchorSourceId は両方セットか両方 null にしてください",
      };
    }
    if (a.anchorSourceId && a.anchorSourceId === a.scheduleId) {
      return { ok: false, status: 400, message: "anchorSourceId は自分自身を指せません" };
    }
  }

  const targetIds = anchors.map((a) => a.scheduleId);
  if (targetIds.length > 0) {
    const targets = await dbOrTx.query.schedules.findMany({
      where: and(inArray(schedules.id, targetIds), eq(schedules.dayPatternId, patternId)),
      columns: { id: true },
    });
    if (targets.length !== targetIds.length) {
      return { ok: false, status: 400, message: "anchor の対象が pattern に存在しません" };
    }
  }

  const sourceIds = anchors.map((a) => a.anchorSourceId).filter((id): id is string => id !== null);
  if (sourceIds.length === 0) return { ok: true };

  const sources = await dbOrTx.query.schedules.findMany({
    where: and(inArray(schedules.id, sourceIds), eq(schedules.tripId, tripId)),
    columns: { id: true, endDayOffset: true },
  });
  const sourceMap = new Map(sources.map((s) => [s.id, s]));
  for (const a of anchors) {
    if (a.anchorSourceId === null) continue;
    const source = sourceMap.get(a.anchorSourceId);
    if (!source) {
      return { ok: false, status: 400, message: "anchorSourceId が trip 内に存在しません" };
    }
    if (!source.endDayOffset || source.endDayOffset <= 0) {
      return {
        ok: false,
        status: 400,
        message: "anchorSourceId は endDayOffset > 0 の schedule でなければなりません",
      };
    }
  }
  return { ok: true };
}
