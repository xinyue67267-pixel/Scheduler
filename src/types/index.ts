export type Level = 'P0' | 'P1' | 'P2' | 'P3';

export type ProjectStatus = 'not_started' | 'in_progress' | 'delayed' | 'completed';

export type PhaseStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue';

export type DependencyType = 'FS' | 'SS' | 'FF';

export type PhaseDependencyType = 'FS' | 'FS_PERCENT' | 'FS_OFFSET' | 'SS_OFFSET' | 'SS_PARALLEL';

export const PHASE_DEPENDENCY_LABELS: Record<PhaseDependencyType, string> = {
  'FS': '完成-开始 (FS)',
  'FS_PERCENT': '百分比重叠 (FS-X%)',
  'FS_OFFSET': '完成偏移 (FS+X天)',
  'SS_OFFSET': '开始偏移 (SS+X天)',
  'SS_PARALLEL': '并行 (SS-0%)',
};

export const PHASE_DEPENDENCY_ICONS: Record<PhaseDependencyType, string> = {
  'FS': '→',
  'FS_PERCENT': '⤳',
  'FS_OFFSET': '→+',
  'SS_OFFSET': '↷+',
  'SS_PARALLEL': '↷',
};

export type ViewMode = 'day' | 'week' | 'month';

export type CalendarType = 'global' | 'custom';

export interface Pipeline {
  id: string;
  name: string;
  color: string;
  leader?: string;
  projectCount?: number;
}

export interface Phase {
  id: string;
  name: string;
  manDays: number;
  role?: string;
  canBeDependent?: boolean;
  isKeyNode?: boolean;
  startDate?: string;
  endDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  status?: PhaseStatus;
  assignee?: string;
  dependencies?: PhaseDependency[];
}

export interface PhaseDependency {
  phaseId: string;
  type: PhaseDependencyType;
  percentage?: number;
  offsetDays?: number;
}

export interface PhaseTemplate {
  id: string;
  name: string;
  manDays: number;
  role?: string;
  canBeDependent: boolean;
  isKeyNode: boolean;
  dependencies?: PhaseDependency[];
}

export interface Dependency {
  id: string;
  sourceProjectId: string;
  sourcePhaseId: string;
  targetProjectId: string;
  targetPhaseId: string;
  type: DependencyType;
  lagDays?: number;
  description?: string;
  status?: 'normal' | 'blocked' | 'completed';
}

export interface Holiday {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  type: 'holiday' | 'workday';
  repeatYearly?: boolean;
  description?: string;
}

export interface ColumnWidthPreferences {
  day: number;
  week: number;
  month: number;
}

export const DEFAULT_COLUMN_WIDTHS: ColumnWidthPreferences = {
  day: 80,
  week: 120,
  month: 160,
};

export const COLUMN_WIDTH_LIMITS = {
  day: { min: 60, max: 150 },
  week: { min: 80, max: 240 },
  month: { min: 100, max: 300 },
};

export interface WorkCalendar {
  id: string;
  name: string;
  workDays: number[];
  holidays: Holiday[];
  isDefault?: boolean;
}

export interface Paradigm {
  id: string;
  name: string;
  level: Level;
  category: string;
  defaultPipeline?: string;
  description?: string;
  phases: PhaseTemplate[];
  usageCount?: number;
  lastModified?: string;
}

export interface Project {
  id: string;
  name: string;
  pipelineId: string;
  paradigmId?: string;
  level: Level;
  category: string;
  startDate?: string;
  deadline?: string;
  status: ProjectStatus;
  manager?: string;
  phases: Phase[];
  progress?: number;
  dependencies: Dependency[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ExportConfig {
  scope: 'all' | 'pipeline' | 'project';
  pipelineIds?: string[];
  projectIds?: string[];
  dateRange?: { start: string; end: string };
  sheets: {
    summary: boolean;
    phases: boolean;
    dependencies: boolean;
    holidays: boolean;
  };
}

export interface Field {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiSelect' | 'person';
  required?: boolean;
  options?: string[];
  order: number;
}

export interface Notification {
  id: string;
  type: 'dependency_change' | 'phase_reminder' | 'deadline_warning';
  title: string;
  message: string;
  projectId?: string;
  phaseId?: string;
  read: boolean;
  createdAt: string;
}
