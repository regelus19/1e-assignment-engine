export type CapabilityLevel = 'CVICU' | 'ICU' | 'PCU_TELE';
export type StaffRole = 'CHG' | 'RN' | 'Preceptor' | 'Orientee' | 'MT' | 'PCT' | 'Resource';
export type StaffStatus = 'ACTIVE' | 'FLEXED' | 'ON_CALL' | 'RECALLED';
export type MTCoverageState = 'MT_PRESENT' | 'RN_COVERING_MT' | 'MT_UNFILLED';
export type PCTCoverageState = 'PCT_PRESENT' | 'PCT_NONE';
export type AcuityLevel = 'CVICU' | 'ICU' | 'PCU' | 'TELE';
export type ComplexityFlag = 'Vent' | 'Pressors' | 'Impella/IABP' | 'Fresh Post-Op' | 'HD/Dialysis' | 'Isolation' | 'Sitter/Safety' | 'High Fall Risk' | 'Confused' | 'Admission' | 'Transfer' | 'Possible DC' | 'Expected DC' | 'BLOCKED' | 'Discharge';
export interface RoomMetadata { roomNumber: string; hall: 'A' | 'B' | 'C'; zone: 'Upper' | 'Mid' | 'Lower'; isICUCapable: boolean; isSafetyPreferred: boolean; proximityGroups: string[]; adjacentRooms: string[]; }
export interface PatientRoom { roomNumber: string; isOccupied: boolean; patientStayId: string; acuity: AcuityLevel; acuityConfirmed?: boolean; flags: ComplexityFlag[]; assignedNurseId: string | null; }
export interface NurseStaff { id: string; name: string; role: StaffRole; assignedPhone: string; capability: CapabilityLevel; staffStatus: StaffStatus; plannedReturnTime?: string; actualRecallTime?: string; coveringMT?: boolean; orientationPartnerId?: string; }
export interface OnCallProviders { intensivist: string; cardiothoracic: string; acuteMI: string; cardiology: string; hospitalist: string; }
export interface AssignmentWarning { type: 'CAPABILITY' | 'DIALYSIS_ROOM' | 'WORKLOAD_RATIO' | 'GEOGRAPHY' | 'SAFETY_ROOM' | 'ACUITY_MISSING'; severity: 'HIGH' | 'MEDIUM' | 'INFO'; message: string; roomNumber?: string; nurseName?: string; }
export interface NurseRecommendationDetail { nurseId: string; nurseName: string; assignedRooms: string[]; reasons: string[]; workloadScore: number; }
export interface RecommendationResult { assignments: Record<string, string>; nurseDetails: NurseRecommendationDetail[]; warnings: AssignmentWarning[]; fitScore: number; fitLabel: 'HIGH FIT' | 'MODERATE FIT' | 'REQUIRES REVIEW'; unassignedRooms: string[]; }
export interface FinalizedShiftSnapshot { id: string; date: string; shiftType: 'Day' | 'Night'; finalizedAt: string; roster: NurseStaff[]; rooms: PatientRoom[]; onCall: OnCallProviders; fitScore: number; warnings: AssignmentWarning[]; mtState: MTCoverageState; pctState: PCTCoverageState; currentMRS: number; projectedMRS: number; }
export interface PlanBaseline extends FinalizedShiftSnapshot { savedAt: string; }
export type OperationalEventType = 'SHIFT_STARTED' | 'ROOM_OCCUPANCY_CHANGE' | 'ROOM_FLAGS_CHANGE' | 'ACUITY_CHANGE' | 'ASSIGNMENT_CHANGE' | 'STAFF_STATUS_CHANGE' | 'ROSTER_CHANGE' | 'MT_CHANGE' | 'PCT_CHANGE' | 'RECOMMENDATION_GENERATED' | 'CURRENT_SNAPSHOT';
export interface OperationalEvent { id: string; timestamp: string; shiftDate: string; shiftType: 'Day' | 'Night'; type: OperationalEventType; summary: string; roomNumber?: string; staffId?: string; beforeValue?: string; afterValue?: string; }
export interface CurrentShiftState { date: string; shiftType: 'Day' | 'Night'; roster: NurseStaff[]; rooms: PatientRoom[]; mtState: MTCoverageState; pctState: PCTCoverageState; onCall: OnCallProviders; clinicalSupervisorPresent?: boolean; lastUpdatedAt: string; }
export interface ForecastEvent { id: string; procedureType: 'CABG' | 'Valve Surgery' | 'TAVR' | 'Cath/PCI' | 'EP' | 'Direct/ED Admission' | 'Expected Admission' | 'Expected Discharge' | 'Other'; expectedTime: string; acuity: AcuityLevel; destinationLevel: string; notes: string; }
