export type ScanInput =
  | { kind: 'registration'; value: string }
  | { kind: 'bib'; value: number };

export const parseScanInput = (raw: string): ScanInput | null => {
  const value = raw.trim();
  if (!value) return null;

  if (value.startsWith('reg:')) {
    const registrationId = value.slice(4).trim();
    return registrationId ? { kind: 'registration', value: registrationId } : null;
  }

  if (/^\d+$/.test(value)) {
    return { kind: 'bib', value: Number(value) };
  }

  return { kind: 'registration', value };
};

export const assignSmallestAvailableBib = (usedBibs: number[], startFrom: number): number => {
  const used = new Set(usedBibs.filter((bib) => bib >= startFrom));
  let candidate = startFrom;

  while (used.has(candidate)) {
    candidate += 1;
  }

  return candidate;
};

export interface FrontDeskStatsInput {
  approved: number;
  checkedIn: number;
  noShow: number;
}

export interface FrontDeskStats {
  approvedTotal: number;
  checkedIn: number;
  noShow: number;
  ratePercent: number;
}

export const computeFrontDeskStats = (input: FrontDeskStatsInput): FrontDeskStats => {
  const approvedTotal = input.approved + input.checkedIn + input.noShow;
  const ratePercent = approvedTotal > 0 ? Math.round((input.checkedIn / approvedTotal) * 100) : 0;

  return {
    approvedTotal,
    checkedIn: input.checkedIn,
    noShow: input.noShow,
    ratePercent,
  };
};

export interface BatchFailure {
  id: string;
  reason: string;
}

export interface BatchRunResult {
  successIds: string[];
  failed: BatchFailure[];
}

export const makeBatchRunner = (
  mutate: (registrationId: string) => Promise<void>
): ((registrationIds: string[]) => Promise<BatchRunResult>) => {
  return async (registrationIds: string[]): Promise<BatchRunResult> => {
    const successIds: string[] = [];
    const failed: BatchFailure[] = [];

    for (const registrationId of registrationIds) {
      try {
        await mutate(registrationId);
        successIds.push(registrationId);
      } catch (error) {
        failed.push({
          id: registrationId,
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { successIds, failed };
  };
};

export interface ItemUndoToken {
  id: string;
  registrationId: string;
  createdAtMs: number;
  expiresAtMs: number;
  expiresInMs: number;
}

export interface BulkUndoToken {
  id: string;
  registrationIds: string[];
  createdAtMs: number;
  expiresAtMs: number;
  expiresInMs: number;
}

export interface UndoState {
  itemTokens: ItemUndoToken[];
  bulkTokens: BulkUndoToken[];
  startItemUndo: (registrationId: string, expiresInMs: number) => ItemUndoToken;
  startBulkUndo: (registrationIds: string[], expiresInMs: number) => BulkUndoToken;
}

const buildUndoTokenId = (): string => `undo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const createUndoState = (): UndoState => {
  const itemTokens: ItemUndoToken[] = [];
  const bulkTokens: BulkUndoToken[] = [];

  const startItemUndo = (registrationId: string, expiresInMs: number): ItemUndoToken => {
    const createdAtMs = Date.now();
    const token: ItemUndoToken = {
      id: buildUndoTokenId(),
      registrationId,
      createdAtMs,
      expiresAtMs: createdAtMs + expiresInMs,
      expiresInMs,
    };
    itemTokens.push(token);
    return token;
  };

  const startBulkUndo = (registrationIds: string[], expiresInMs: number): BulkUndoToken => {
    const createdAtMs = Date.now();
    const token: BulkUndoToken = {
      id: buildUndoTokenId(),
      registrationIds: [...registrationIds],
      createdAtMs,
      expiresAtMs: createdAtMs + expiresInMs,
      expiresInMs,
    };
    bulkTokens.push(token);
    return token;
  };

  return {
    itemTokens,
    bulkTokens,
    startItemUndo,
    startBulkUndo,
  };
};
