import {
  CurrentShiftState,
  FinalizedShiftSnapshot,
  OperationalEvent,
  PlanBaseline,
  PlanningWorkspace,
} from '../../types';

export type ShiftType = 'Day' | 'Night';

export interface RepositoryMetadata {
  etag: string;
  lastModified: string;
  source: 'local' | 'remote';
}

export interface RepositoryResult<T> {
  data: T;
  metadata: RepositoryMetadata;
}

export class RepositoryConflictError<T> extends Error {
  readonly latest: RepositoryResult<T>;

  constructor(latest: RepositoryResult<T>, message = 'The operational record changed since it was loaded.') {
    super(message);
    this.name = 'RepositoryConflictError';
    this.latest = latest;
  }
}

export class RepositoryConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryConfigurationError';
  }
}

export interface OperationalRepository {
  loadCurrentShift(
    unitId: string,
    date?: string,
    shiftType?: ShiftType
  ): Promise<RepositoryResult<CurrentShiftState>>;

  saveCurrentShift(
    state: CurrentShiftState,
    expectedETag?: string
  ): Promise<RepositoryResult<CurrentShiftState>>;

  loadPlanningWorkspace(
    unitId: string,
    date: string,
    shiftType: ShiftType
  ): Promise<RepositoryResult<PlanningWorkspace>>;

  savePlanningWorkspace(
    workspace: PlanningWorkspace,
    expectedETag?: string
  ): Promise<RepositoryResult<PlanningWorkspace>>;

  loadPlanBaseline(
    unitId: string,
    date: string,
    shiftType: ShiftType
  ): Promise<RepositoryResult<PlanBaseline | null>>;

  savePlanBaseline(
    baseline: PlanBaseline,
    expectedETag?: string
  ): Promise<RepositoryResult<PlanBaseline>>;

  loadHistory(
    unitId: string
  ): Promise<RepositoryResult<FinalizedShiftSnapshot[]>>;

  saveFinalizedShift(
    snapshot: FinalizedShiftSnapshot,
    expectedETag?: string
  ): Promise<RepositoryResult<FinalizedShiftSnapshot[]>>;

  loadOperationalEvents(
    unitId: string,
    date?: string,
    shiftType?: ShiftType
  ): Promise<RepositoryResult<OperationalEvent[]>>;

  appendOperationalEvent(
    event: OperationalEvent
  ): Promise<RepositoryResult<OperationalEvent[]>>;
}
