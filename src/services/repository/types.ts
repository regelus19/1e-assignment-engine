import {
  CurrentShiftState,
  FinalizedShiftSnapshot,
  OperationalEvent,
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

  loadHistory(
    unitId: string
  ): Promise<RepositoryResult<FinalizedShiftSnapshot[]>>;

  saveFinalizedShift(
    snapshot: FinalizedShiftSnapshot,
    expectedETag?: string
  ): Promise<RepositoryResult<FinalizedShiftSnapshot[]>>;

  loadOperationalEvents(
    unitId: string,
    date: string,
    shiftType: ShiftType
  ): Promise<RepositoryResult<OperationalEvent[]>>;

  appendOperationalEvent(
    event: OperationalEvent
  ): Promise<RepositoryResult<OperationalEvent[]>>;
}
