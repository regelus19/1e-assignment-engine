import { MRS_CONFIG } from '../../config/mrs';
import {
  CurrentShiftState,
  FinalizedShiftSnapshot,
  OperationalEvent,
  PlanningWorkspace,
} from '../../types';
import { StorageService } from '../storage';
import {
  OperationalRepository,
  RepositoryMetadata,
  RepositoryResult,
  ShiftType,
} from './types';

const localMetadata = (scope: string, lastModified?: string): RepositoryMetadata => {
  const modified = lastModified || new Date().toISOString();
  return {
    etag: `local:${scope}:${modified}`,
    lastModified: modified,
    source: 'local',
  };
};

export class LocalOperationalRepository implements OperationalRepository {
  async loadCurrentShift(
    _unitId: string,
    _date?: string,
    _shiftType?: ShiftType
  ): Promise<RepositoryResult<CurrentShiftState>> {
    const data = StorageService.loadCurrentShift();
    return { data, metadata: localMetadata('live', data.lastUpdatedAt) };
  }

  async saveCurrentShift(
    state: CurrentShiftState,
    _expectedETag?: string
  ): Promise<RepositoryResult<CurrentShiftState>> {
    StorageService.saveCurrentShift(state);
    const data = StorageService.loadCurrentShift();
    return { data, metadata: localMetadata('live', data.lastUpdatedAt) };
  }

  async loadPlanningWorkspace(
    _unitId: string,
    date: string,
    _shiftType: ShiftType
  ): Promise<RepositoryResult<PlanningWorkspace>> {
    const data = StorageService.loadPlanningWorkspace(date, MRS_CONFIG.target);
    return { data, metadata: localMetadata('plan', data.lastUpdatedAt) };
  }

  async savePlanningWorkspace(
    workspace: PlanningWorkspace,
    _expectedETag?: string
  ): Promise<RepositoryResult<PlanningWorkspace>> {
    const data = StorageService.savePlanningWorkspace(workspace);
    return { data, metadata: localMetadata('plan', data.lastUpdatedAt) };
  }

  async loadHistory(
    _unitId: string
  ): Promise<RepositoryResult<FinalizedShiftSnapshot[]>> {
    const data = StorageService.loadHistory();
    const lastModified = data[0]?.finalizedAt;
    return { data, metadata: localMetadata('history', lastModified) };
  }

  async saveFinalizedShift(
    snapshot: FinalizedShiftSnapshot,
    _expectedETag?: string
  ): Promise<RepositoryResult<FinalizedShiftSnapshot[]>> {
    StorageService.saveFinalizedShift(snapshot);
    const data = StorageService.loadHistory();
    return { data, metadata: localMetadata('history', snapshot.finalizedAt) };
  }

  async loadOperationalEvents(
    _unitId: string,
    date: string,
    shiftType: ShiftType
  ): Promise<RepositoryResult<OperationalEvent[]>> {
    const data = StorageService.loadOperationalEvents().filter(
      event => event.shiftDate === date && event.shiftType === shiftType
    );
    const lastModified = data[0]?.timestamp;
    return { data, metadata: localMetadata('events', lastModified) };
  }

  async appendOperationalEvent(
    event: OperationalEvent
  ): Promise<RepositoryResult<OperationalEvent[]>> {
    StorageService.appendOperationalEvent(event);
    const data = StorageService.loadOperationalEvents().filter(
      item => item.shiftDate === event.shiftDate && item.shiftType === event.shiftType
    );
    return { data, metadata: localMetadata('events', event.timestamp) };
  }
}
