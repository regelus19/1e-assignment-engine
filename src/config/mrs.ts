export interface MRSThresholdConfig {
  target: number;
  isProvisional: boolean;
  thresholds: {
    green: { max: number; label: string };
    yellow: { max: number; label: string };
    orange: { max: number; label: string };
    red: { min: number; label: string };
  };
}

export const MRS_CONFIG: MRSThresholdConfig = {
  target: 11.972,
  isProvisional: true,
  thresholds: {
    green: { max: 12.10, label: 'Favorable / Within Expected Operating Range' },
    yellow: { max: 12.45, label: 'Watch / Moderate Variance' },
    orange: { max: 12.80, label: 'Staffing / Productivity Pressure' },
    red: { min: 12.81, label: 'Significant Staffing / Productivity Concern' },
  }
};

export function getMRSStatus(value: number): {
  color: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
  label: string;
  variance: number;
  varianceStr: string;
} {
  const variance = Math.round((value - MRS_CONFIG.target) * 1000) / 1000;
  const varianceStr = variance > 0 ? `+${variance.toFixed(3)}` : `${variance.toFixed(3)}`;

  if (value <= MRS_CONFIG.thresholds.green.max) {
    return { color: 'GREEN', label: MRS_CONFIG.thresholds.green.label, variance, varianceStr };
  } else if (value <= MRS_CONFIG.thresholds.yellow.max) {
    return { color: 'YELLOW', label: MRS_CONFIG.thresholds.yellow.label, variance, varianceStr };
  } else if (value <= MRS_CONFIG.thresholds.orange.max) {
    return { color: 'ORANGE', label: MRS_CONFIG.thresholds.orange.label, variance, varianceStr };
  } else {
    return { color: 'RED', label: MRS_CONFIG.thresholds.red.label, variance, varianceStr };
  }
}
