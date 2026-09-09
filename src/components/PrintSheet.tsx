import React from 'react';
import { NurseStaff, PatientRoom, OnCallProviders } from '../types';

interface PrintSheetProps {
  date: string;
  shiftType: string;
  roster: NurseStaff[];
  rooms: PatientRoom[];
  onCall: OnCallProviders;
}

export const PrintSheet: React.FC<PrintSheetProps> = ({
  date,
  shiftType,
  roster,
  rooms,
  onCall
}) => {
  const getFirstName = (fullName: string) => fullName.trim().split(' ')[0] || fullName;

  const getStaffAssignmentString = (staff: NurseStaff): string => {
    if (staff.staffStatus === 'FLEXED') {
      return staff.plannedReturnTime ? `FLEXED – RETURN ${staff.plannedReturnTime}` : 'FLEXED';
    }
    if (staff.staffStatus === 'ON_CALL') {
      return 'ON CALL';
    }
    if (staff.role === 'MT') {
      return 'MT';
    }
    if (staff.role === 'PCT') {
      return 'PCT';
    }

    const assignedRooms = rooms
      .filter(r => r.assignedNurseId === staff.id)
      .map(r => r.roomNumber)
      .sort();

    if (staff.role === 'CHG') {
      return assignedRooms.length > 0 ? `CHG, ${assignedRooms.join(', ')}` : 'CHG';
    }

    if (staff.coveringMT) {
      return assignedRooms.length > 0 
        ? `${assignedRooms.join(', ')} (Covering MT)`
        : 'MT Coverage Only';
    }

    return assignedRooms.length > 0 ? assignedRooms.join(', ') : 'Unassigned';
  };

  return (
    <div className="bg-white text-black p-6 font-sans max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b-2 border-black pb-2 mb-4 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black tracking-tight">1 EAST STAFFING ASSIGNMENTS</h1>
          <p className="text-sm font-semibold text-neutral-700">Cardiac Universal Bed (CUB) Unit</p>
        </div>
        <div className="text-right">
          <p className="text-base font-bold">{date}</p>
          <p className="text-sm font-semibold uppercase">{shiftType} Shift</p>
        </div>
      </div>

      {/* Staff Assignments Table */}
      <div className="mb-6">
        <table className="w-full border-collapse border border-black text-sm">
          <thead>
            <tr className="bg-neutral-100 border-b border-black">
              <th className="border-r border-black p-2 text-left font-black w-1/4">Staff Name</th>
              <th className="border-r border-black p-2 text-left font-black w-1/2">Role / Assigned Rooms / Status</th>
              <th className="p-2 text-left font-black w-1/4">Assigned Phone</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((staff) => (
              <tr key={staff.id} className="border-b border-black">
                <td className="border-r border-black p-2 font-bold">{getFirstName(staff.name)}</td>
                <td className="border-r border-black p-2">{getStaffAssignmentString(staff)}</td>
                <td className="p-2 font-mono">{staff.assignedPhone || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* On-Call Provider Reference Block */}
      <div className="border border-black p-3">
        <h2 className="text-xs font-black uppercase tracking-wider mb-2 border-b border-black pb-1">
          On-Call Provider Reference
        </h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          <div className="flex justify-between border-b border-neutral-200 pb-0.5">
            <span className="font-bold">INTENSIVIST:</span>
            <span>{onCall.intensivist || '-'}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-200 pb-0.5">
            <span className="font-bold">CARDIOTHORACIC:</span>
            <span>{onCall.cardiothoracic || '-'}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-200 pb-0.5">
            <span className="font-bold">ACUTE MI:</span>
            <span>{onCall.acuteMI || '-'}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-200 pb-0.5">
            <span className="font-bold">CARDIOLOGY:</span>
            <span>{onCall.cardiology || '-'}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-200 pb-0.5">
            <span className="font-bold">HOSPITALIST:</span>
            <span>{onCall.hospitalist || '-'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
