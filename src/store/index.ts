import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Pipeline,
  Paradigm,
  Project,
  WorkCalendar,
  Holiday,
  Field,
  Dependency,
  Phase,
  ViewMode,
  ExportConfig,
  Notification,
  ColumnWidthPreferences,
} from '@/types';
import { DEFAULT_COLUMN_WIDTHS } from '@/types';

interface AppState {
  pipelines: Pipeline[];
  paradigms: Paradigm[];
  projects: Project[];
  workCalendars: WorkCalendar[];
  holidays: Holiday[];
  fields: Field[];
  categories: string[];
  levels: string[];
  roles: string[];
  notifications: Notification[];
  
  viewMode: ViewMode;
  selectedProjectId: string | null;
  selectedPipelineIds: string[];
  selectedPhaseIds: string[];
  selectedManagerIds: string[];
  showOnlyWithDependencies: boolean;
  
  columnWidths: ColumnWidthPreferences;
  
  exportConfig: ExportConfig;
  
  addPipeline: (pipeline: Pipeline) => void;
  updatePipeline: (id: string, data: Partial<Pipeline>) => void;
  deletePipeline: (id: string) => void;
  
  addParadigm: (paradigm: Paradigm) => void;
  updateParadigm: (id: string, data: Partial<Paradigm>) => void;
  deleteParadigm: (id: string) => void;
  
  addProject: (project: Project) => void;
  updateProject: (id: string, data: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  updatePhase: (projectId: string, phaseId: string, data: Partial<Phase>) => void;
  
  addDependency: (dependency: Dependency) => void;
  updateDependency: (id: string, data: Partial<Dependency>) => void;
  deleteDependency: (id: string) => void;
  
  addHoliday: (holiday: Holiday) => void;
  updateHoliday: (id: string, data: Partial<Holiday>) => void;
  deleteHoliday: (id: string) => void;
  
  addField: (field: Field) => void;
  updateField: (id: string, data: Partial<Field>) => void;
  deleteField: (id: string) => void;
  reorderFields: (fields: Field[]) => void;
  
  setViewMode: (mode: ViewMode) => void;
  setSelectedProject: (id: string | null) => void;
  setSelectedPipelines: (ids: string[]) => void;
  setSelectedPhases: (ids: string[]) => void;
  setSelectedManagers: (ids: string[]) => void;
  setShowOnlyWithDependencies: (show: boolean) => void;
  setColumnWidth: (mode: ViewMode, width: number) => void;
  resetColumnWidths: () => void;
  setExportConfig: (config: Partial<ExportConfig>) => void;
  
  addNotification: (notification: Notification) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
}

const defaultPipelines: Pipeline[] = [
  { id: '1', name: '支付管线', color: '#0052D9', leader: '张明' },
  { id: '2', name: '用户中心', color: '#00A870', leader: '李华' },
  { id: '3', name: '商品管线', color: '#ED7B2F', leader: '王芳' },
  { id: '4', name: '订单管线', color: '#8B5CF6', leader: '赵强' },
  { id: '5', name: '营销管线', color: '#FF6B6B', leader: '陈静' },
];

const defaultParadigms: Paradigm[] = [
  {
    id: '1',
    name: '标准研发流程',
    level: 'P1',
    category: '研发',
    description: '包含完整研发环节的标准项目模板',
    phases: [
      { id: 'p1', name: '需求分析', manDays: 3, canBeDependent: true, isKeyNode: true },
      { id: 'p2', name: 'UI设计', manDays: 5, canBeDependent: true, isKeyNode: true },
      { id: 'p3', name: '前端开发', manDays: 10, canBeDependent: true, isKeyNode: true },
      { id: 'p4', name: '后端开发', manDays: 15, canBeDependent: true, isKeyNode: true },
      { id: 'p5', name: '测试', manDays: 8, canBeDependent: true, isKeyNode: true },
      { id: 'p6', name: '上线', manDays: 2, canBeDependent: true, isKeyNode: false },
    ],
    usageCount: 12,
    lastModified: '2026-03-15',
  },
  {
    id: '2',
    name: '快速迭代流程',
    level: 'P2',
    category: '研发',
    description: '简化环节的快速迭代模板',
    phases: [
      { id: 'p1', name: '需求确认', manDays: 1, canBeDependent: true, isKeyNode: true },
      { id: 'p2', name: '开发', manDays: 8, canBeDependent: true, isKeyNode: true },
      { id: 'p3', name: '测试上线', manDays: 3, canBeDependent: true, isKeyNode: true },
    ],
    usageCount: 8,
    lastModified: '2026-03-10',
  },
  {
    id: '3',
    name: '营销活动流程',
    level: 'P2',
    category: '营销',
    description: '适用于营销活动的项目模板',
    phases: [
      { id: 'p1', name: '方案策划', manDays: 5, canBeDependent: true, isKeyNode: true },
      { id: 'p2', name: '资源准备', manDays: 3, canBeDependent: true, isKeyNode: false },
      { id: 'p3', name: '开发联调', manDays: 7, canBeDependent: true, isKeyNode: true },
      { id: 'p4', name: '活动上线', manDays: 1, canBeDependent: true, isKeyNode: true },
      { id: 'p5', name: '复盘总结', manDays: 2, canBeDependent: false, isKeyNode: false },
    ],
    usageCount: 5,
    lastModified: '2026-03-08',
  },
];

const defaultHolidays: Holiday[] = [
  { id: '1', name: '元旦', startDate: '2026-01-01', endDate: '2026-01-01', type: 'holiday', repeatYearly: true },
  { id: '2', name: '春节', startDate: '2026-01-27', endDate: '2026-02-02', type: 'holiday', repeatYearly: false, description: '春节假期7天' },
  { id: '3', name: '清明节', startDate: '2026-04-04', endDate: '2026-04-06', type: 'holiday', repeatYearly: true },
  { id: '4', name: '劳动节', startDate: '2026-05-01', endDate: '2026-05-05', type: 'holiday', repeatYearly: true },
  { id: '5', name: '国庆节', startDate: '2026-10-01', endDate: '2026-10-07', type: 'holiday', repeatYearly: true, description: '国庆黄金周假期' },
];

const defaultProjects: Project[] = [
  {
    id: '1',
    name: '支付系统升级',
    pipelineId: '1',
    paradigmId: '1',
    level: 'P0',
    category: '研发',
    startDate: '2026-03-01',
    deadline: '2026-03-31',
    status: 'in_progress',
    manager: '张明',
    progress: 45,
    phases: [
      { id: 'p1', name: '需求分析', manDays: 3, canBeDependent: true, isKeyNode: true, startDate: '2026-03-01', endDate: '2026-03-05', status: 'completed' },
      { id: 'p2', name: 'UI设计', manDays: 5, canBeDependent: true, isKeyNode: true, startDate: '2026-03-06', endDate: '2026-03-12', status: 'completed' },
      { id: 'p3', name: '前端开发', manDays: 10, canBeDependent: true, isKeyNode: true, startDate: '2026-03-13', endDate: '2026-03-26', status: 'in_progress' },
      { id: 'p4', name: '后端开发', manDays: 15, canBeDependent: true, isKeyNode: true, startDate: '2026-03-13', endDate: '2026-04-02', status: 'in_progress' },
      { id: 'p5', name: '测试', manDays: 8, canBeDependent: true, isKeyNode: true, startDate: '2026-04-03', endDate: '2026-04-14', status: 'not_started' },
      { id: 'p6', name: '上线', manDays: 2, canBeDependent: true, isKeyNode: false, startDate: '2026-04-15', endDate: '2026-04-16', status: 'not_started' },
    ],
    dependencies: [
      { id: 'd1', sourceProjectId: '2', sourcePhaseId: 'p5', targetProjectId: '1', targetPhaseId: 'p5', type: 'FS', lagDays: 0 },
    ],
    createdAt: '2026-02-20',
    updatedAt: '2026-03-18',
  },
  {
    id: '2',
    name: '用户画像2.0',
    pipelineId: '2',
    paradigmId: '1',
    level: 'P1',
    category: '研发',
    startDate: '2026-02-15',
    deadline: '2026-04-15',
    status: 'in_progress',
    manager: '李华',
    progress: 60,
    phases: [
      { id: 'p1', name: '需求分析', manDays: 3, canBeDependent: true, isKeyNode: true, startDate: '2026-02-15', endDate: '2026-02-19', status: 'completed' },
      { id: 'p2', name: 'UI设计', manDays: 5, canBeDependent: true, isKeyNode: true, startDate: '2026-02-20', endDate: '2026-02-26', status: 'completed' },
      { id: 'p3', name: '前端开发', manDays: 10, canBeDependent: true, isKeyNode: true, startDate: '2026-02-27', endDate: '2026-03-12', status: 'completed' },
      { id: 'p4', name: '后端开发', manDays: 15, canBeDependent: true, isKeyNode: true, startDate: '2026-02-27', endDate: '2026-03-19', status: 'in_progress' },
      { id: 'p5', name: '测试', manDays: 8, canBeDependent: true, isKeyNode: true, startDate: '2026-03-20', endDate: '2026-03-31', status: 'not_started' },
      { id: 'p6', name: '上线', manDays: 2, canBeDependent: true, isKeyNode: false, startDate: '2026-04-01', endDate: '2026-04-02', status: 'not_started' },
    ],
    dependencies: [],
    createdAt: '2026-02-10',
    updatedAt: '2026-03-15',
  },
  {
    id: '3',
    name: '商品详情页优化',
    pipelineId: '3',
    paradigmId: '2',
    level: 'P2',
    category: '研发',
    startDate: '2026-03-10',
    deadline: '2026-03-25',
    status: 'in_progress',
    manager: '王芳',
    progress: 30,
    phases: [
      { id: 'p1', name: '需求确认', manDays: 1, canBeDependent: true, isKeyNode: true, startDate: '2026-03-10', endDate: '2026-03-10', status: 'completed' },
      { id: 'p2', name: '开发', manDays: 8, canBeDependent: true, isKeyNode: true, startDate: '2026-03-11', endDate: '2026-03-20', status: 'in_progress' },
      { id: 'p3', name: '测试上线', manDays: 3, canBeDependent: true, isKeyNode: true, startDate: '2026-03-21', endDate: '2026-03-25', status: 'not_started' },
    ],
    dependencies: [],
    createdAt: '2026-03-05',
    updatedAt: '2026-03-18',
  },
  {
    id: '4',
    name: '618大促活动',
    pipelineId: '5',
    paradigmId: '3',
    level: 'P0',
    category: '营销',
    startDate: '2026-05-01',
    deadline: '2026-06-18',
    status: 'not_started',
    manager: '陈静',
    progress: 0,
    phases: [
      { id: 'p1', name: '方案策划', manDays: 5, canBeDependent: true, isKeyNode: true, startDate: '2026-05-01', endDate: '2026-05-07', status: 'not_started' },
      { id: 'p2', name: '资源准备', manDays: 3, canBeDependent: true, isKeyNode: false, startDate: '2026-05-08', endDate: '2026-05-12', status: 'not_started' },
      { id: 'p3', name: '开发联调', manDays: 7, canBeDependent: true, isKeyNode: true, startDate: '2026-05-13', endDate: '2026-05-21', status: 'not_started' },
      { id: 'p4', name: '活动上线', manDays: 1, canBeDependent: true, isKeyNode: true, startDate: '2026-06-18', endDate: '2026-06-18', status: 'not_started' },
      { id: 'p5', name: '复盘总结', manDays: 2, canBeDependent: false, isKeyNode: false, startDate: '2026-06-19', endDate: '2026-06-22', status: 'not_started' },
    ],
    dependencies: [],
    createdAt: '2026-03-01',
    updatedAt: '2026-03-01',
  },
];

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      columnWidths: DEFAULT_COLUMN_WIDTHS,
      pipelines: defaultPipelines,
      paradigms: defaultParadigms,
      projects: defaultProjects,
      workCalendars: [],
      holidays: defaultHolidays,
      fields: [],
      categories: ['研发', '营销', '运维', '数据分析'],
      levels: ['P0', 'P1', 'P2', 'P3'],
      roles: ['产品经理', '设计师', '前端开发', '后端开发', '测试工程师', '运维工程师'],
      notifications: [],

      viewMode: 'week',
      selectedProjectId: null,
      selectedPipelineIds: [],
      selectedPhaseIds: [],
      selectedManagerIds: [],
      showOnlyWithDependencies: false,

      exportConfig: {
        scope: 'all',
        sheets: {
          summary: true,
          phases: true,
          dependencies: true,
          holidays: true,
        },
      },

      addPipeline: (pipeline) =>
        set((state) => ({ pipelines: [...state.pipelines, pipeline] })),
      updatePipeline: (id, data) =>
        set((state) => ({
          pipelines: state.pipelines.map((p) =>
            p.id === id ? { ...p, ...data } : p
          ),
        })),
      deletePipeline: (id) =>
        set((state) => ({
          pipelines: state.pipelines.filter((p) => p.id !== id),
        })),

      addParadigm: (paradigm) =>
        set((state) => ({ paradigms: [...state.paradigms, paradigm] })),
      updateParadigm: (id, data) =>
        set((state) => ({
          paradigms: state.paradigms.map((p) =>
            p.id === id ? { ...p, ...data } : p
          ),
        })),
      deleteParadigm: (id) =>
        set((state) => ({
          paradigms: state.paradigms.filter((p) => p.id !== id),
        })),

      addProject: (project) =>
        set((state) => ({ projects: [...state.projects, project] })),
      updateProject: (id, data) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p
          ),
        })),
      deleteProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
        })),
      updatePhase: (projectId, phaseId, data) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  phases: p.phases.map((ph) =>
                    ph.id === phaseId ? { ...ph, ...data } : ph
                  ),
                }
              : p
          ),
        })),

      addDependency: (dependency) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === dependency.targetProjectId
              ? { ...p, dependencies: [...p.dependencies, dependency] }
              : p
          ),
        })),
      updateDependency: (id, data) =>
        set((state) => ({
          projects: state.projects.map((p) => ({
            ...p,
            dependencies: p.dependencies.map((d) =>
              d.id === id ? { ...d, ...data } : d
            ),
          })),
        })),
      deleteDependency: (id) =>
        set((state) => ({
          projects: state.projects.map((p) => ({
            ...p,
            dependencies: p.dependencies.filter((d) => d.id !== id),
          })),
        })),

      addHoliday: (holiday) =>
        set((state) => ({ holidays: [...state.holidays, holiday] })),
      updateHoliday: (id, data) =>
        set((state) => ({
          holidays: state.holidays.map((h) =>
            h.id === id ? { ...h, ...data } : h
          ),
        })),
      deleteHoliday: (id) =>
        set((state) => ({
          holidays: state.holidays.filter((h) => h.id !== id),
        })),

      addField: (field) =>
        set((state) => ({ fields: [...state.fields, field] })),
      updateField: (id, data) =>
        set((state) => ({
          fields: state.fields.map((f) =>
            f.id === id ? { ...f, ...data } : f
          ),
        })),
      deleteField: (id) =>
        set((state) => ({
          fields: state.fields.filter((f) => f.id !== id),
        })),
      reorderFields: (fields) => set({ fields }),

      setViewMode: (mode) => set({ viewMode: mode }),
      setSelectedProject: (id) => set({ selectedProjectId: id }),
      setSelectedPipelines: (ids) => set({ selectedPipelineIds: ids }),
      setSelectedPhases: (ids) => set({ selectedPhaseIds: ids }),
      setSelectedManagers: (ids) => set({ selectedManagerIds: ids }),
      setShowOnlyWithDependencies: (show) =>
        set({ showOnlyWithDependencies: show }),
      setColumnWidth: (mode, width) =>
        set((state) => ({
          columnWidths: { ...state.columnWidths, [mode]: width },
        })),
      resetColumnWidths: () =>
        set({ columnWidths: DEFAULT_COLUMN_WIDTHS }),
      setExportConfig: (config) =>
        set((state) => ({ exportConfig: { ...state.exportConfig, ...config } })),

      addNotification: (notification) =>
        set((state) => ({
          notifications: [notification, ...state.notifications],
        })),
      markNotificationRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),
      clearNotifications: () => set({ notifications: [] }),
    }),
    {
      name: 'scheduler-storage',
    }
  )
);
