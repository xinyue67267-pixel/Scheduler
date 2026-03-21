import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { addDays, parseISO, differenceInDays, format } from 'date-fns';
import {
  Search,
  Download,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronRight,
  Plus,
  ZoomIn,
  ZoomOut,
  Link2,
  RotateCcw,
} from 'lucide-react';
import {
  format,
  addDays,
  addWeeks,
  addMonths,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  isWeekend,
  isSameDay,
  differenceInDays,
  parseISO,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useStore } from '@/store';
import type { Project, Phase, Dependency, ViewMode } from '@/types';
import ExportModal from '@/components/Export/ExportModal';

const levelColors: Record<string, string> = {
  P0: '#E34D4D',
  P1: '#ED7B2F',
  P2: '#0052D9',
  P3: '#8A95A5',
};

const statusColors: Record<string, string> = {
  not_started: '#8A95A5',
  in_progress: '#0052D9',
  completed: '#00A870',
  overdue: '#E34D4D',
};

const statusLabels: Record<string, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  completed: '已完成',
  overdue: '逾期',
};

export default function Timeline() {
  const {
    projects,
    pipelines,
    holidays,
    viewMode,
    setViewMode,
    selectedPipelineIds,
    setSelectedPipelines,
    showOnlyWithDependencies,
    setShowOnlyWithDependencies,
    columnWidths,
    updatePhase,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPipelines, setExpandedPipelines] = useState<string[]>(
    pipelines.map((p) => p.id)
  );
  const [showExportModal, setShowExportModal] = useState(false);
  const [scrollX, setScrollX] = useState(0);
  const [zoom, setZoom] = useState(1);
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [draggingPhase, setDraggingPhase] = useState<{ projectId: string; phaseId: string; type: 'move' | 'resize-left' | 'resize-right' } | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartDate, setDragStartDate] = useState<string | null>(null);
  const [dragStartEndDate, setDragStartEndDate] = useState<string | null>(null);
  
  const today = new Date();

  const viewConfig = useMemo(() => {
    const configs = {
      day: {
        start: addDays(today, -30),
        end: addDays(today, 90),
        baseWidth: columnWidths.day,
      },
      week: {
        start: addWeeks(today, -12),
        end: addWeeks(today, 36),
        baseWidth: columnWidths.week,
      },
      month: {
        start: addMonths(today, -12),
        end: addMonths(today, 24),
        baseWidth: columnWidths.month,
      },
    };
    return configs[viewMode];
  }, [viewMode, columnWidths, today]);

  const timeUnits = useMemo(() => {
    const { start, end } = viewConfig;
    switch (viewMode) {
      case 'day':
        return eachDayOfInterval({ start, end });
      case 'week':
        return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
      case 'month':
        return eachMonthOfInterval({ start, end });
    }
  }, [viewConfig, viewMode]);

  const unitWidth = viewConfig.baseWidth * zoom;
  const totalWidth = timeUnits.length * unitWidth;

  const filteredProjects = useMemo(() => {
    let filtered = [...projects];
    if (selectedPipelineIds.length > 0) {
      filtered = filtered.filter((p) => selectedPipelineIds.includes(p.pipelineId));
    }
    if (showOnlyWithDependencies) {
      filtered = filtered.filter((p) => p.dependencies.length > 0);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.phases.some((ph) => ph.name.toLowerCase().includes(query))
      );
    }
    return filtered;
  }, [projects, selectedPipelineIds, showOnlyWithDependencies, searchQuery]);

  const groupedProjects = useMemo(() => {
    const grouped: Record<string, Project[]> = {};
    pipelines.forEach((pipeline) => {
      grouped[pipeline.id] = filteredProjects.filter((p) => p.pipelineId === pipeline.id);
    });
    return grouped;
  }, [filteredProjects, pipelines]);

  const getDateOffset = useCallback(
    (date: Date | string): number => {
      const d = typeof date === 'string' ? parseISO(date) : date;
      const daysDiff = differenceInDays(d, viewConfig.start);
      const divisor = viewMode === 'day' ? 1 : viewMode === 'week' ? 7 : 30;
      return (daysDiff / divisor) * unitWidth;
    },
    [viewConfig.start, unitWidth, viewMode]
  );

  const getPhaseWidth = useCallback(
    (start: string, end: string): number => {
      const startD = parseISO(start);
      const endD = parseISO(end);
      const days = differenceInDays(endD, startD) + 1;
      const divisor = viewMode === 'day' ? 1 : viewMode === 'week' ? 7 : 30;
      return Math.max((days / divisor) * unitWidth, 40);
    },
    [unitWidth, viewMode]
  );

  const isDateInHoliday = (date: Date): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return holidays.some(
      (h) => h.type === 'holiday' && dateStr >= h.startDate && dateStr <= h.endDate
    );
  };

  const getHolidayInfo = (date: Date): string | null => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const holiday = holidays.find(
      (h) => h.type === 'holiday' && dateStr >= h.startDate && dateStr <= h.endDate
    );
    return holiday ? holiday.name : null;
  };

  const isWorkingDay = (date: Date): boolean => {
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
    const dateStr = format(date, 'yyyy-MM-dd');
    return !holidays.some(
      (h) => h.type === 'holiday' && dateStr >= h.startDate && dateStr <= h.endDate
    );
  };

  const skipToNextWorkingDay = (date: Date): Date => {
    let result = new Date(date);
    while (!isWorkingDay(result)) {
      result = addDays(result, 1);
    }
    return result;
  };

  const calculatePhaseEndDate = (startDate: Date, manDays: number): Date => {
    let currentDate = new Date(startDate);
    let remainingDays = manDays;
    while (remainingDays > 0) {
      currentDate = addDays(currentDate, 1);
      if (isWorkingDay(currentDate)) {
        remainingDays--;
      }
    }
    return currentDate;
  };

  const calculateNewPhaseStart = (
    phase: { manDays: number; dependencies?: { phaseId: string; type: string; percentage?: number; offsetDays?: number }[] },
    allPhases: { id: string; startDate?: string; endDate?: string; manDays: number }[],
    baseEndDate: Date,
    holidays: { startDate: string; endDate: string; type: string }[]
  ): Date => {
    if (!phase.dependencies || phase.dependencies.length === 0) {
      return skipToNextWorkingDay(baseEndDate);
    }

    let latestStartDate: Date | null = null;

    for (const dep of phase.dependencies) {
      const depPhase = allPhases.find(p => p.id === dep.phaseId);
      if (!depPhase?.startDate || !depPhase?.endDate) continue;

      const depStart = parseISO(depPhase.startDate);
      const depEnd = parseISO(depPhase.endDate);

      let triggerDate: Date;

      switch (dep.type) {
        case 'FS':
          triggerDate = skipToNextWorkingDay(depEnd);
          break;
        case 'FS_PERCENT':
          const percent = dep.percentage || 50;
          const offsetDays = Math.floor(depPhase.manDays * (percent / 100));
          let current = new Date(depStart);
          let workedDays = 0;
          while (workedDays < offsetDays) {
            current = addDays(current, 1);
            if (isWorkingDay(current)) workedDays++;
          }
          triggerDate = current;
          break;
        case 'FS_OFFSET':
          triggerDate = skipToNextWorkingDay(addDays(depEnd, dep.offsetDays || 0));
          break;
        case 'SS_OFFSET':
          triggerDate = addDays(depStart, dep.offsetDays || 0);
          if (!isWorkingDay(triggerDate)) triggerDate = skipToNextWorkingDay(triggerDate);
          break;
        case 'SS_PARALLEL':
          triggerDate = depStart;
          break;
        default:
          triggerDate = skipToNextWorkingDay(depEnd);
      }

      if (!latestStartDate || triggerDate > latestStartDate) {
        latestStartDate = triggerDate;
      }
    }

    return latestStartDate || skipToNextWorkingDay(baseEndDate);
  };

  const togglePipeline = (pipelineId: string) => {
    setExpandedPipelines((prev) =>
      prev.includes(pipelineId) ? prev.filter((id) => id !== pipelineId) : [...prev, pipelineId]
    );
  };

  const handleBodyScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    setScrollX(scrollLeft);
    if (headerRef.current) {
      headerRef.current.scrollLeft = scrollLeft;
    }
  };

  const handleListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (bodyRef.current) {
      bodyRef.current.scrollTop = scrollTop;
    }
  };

  const toggleProject = (projectId: string) => {
    setCollapsedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const handlePhaseMouseDown = (
    e: React.MouseEvent,
    projectId: string,
    phaseId: string,
    type: 'move' | 'resize-left' | 'resize-right',
    startDate?: string,
    endDate?: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingPhase({ projectId, phaseId, type });
    setDragStartX(e.clientX);
    setDragStartDate(startDate || null);
    setDragStartEndDate(endDate || null);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!draggingPhase || !dragStartDate) return;

      const deltaX = e.clientX - dragStartX;
      const daysDelta = Math.round(deltaX / unitWidth);
      
      const { projectId, phaseId, type } = draggingPhase;
      const project = projects.find(p => p.id === projectId);
      if (!project) return;

      const phaseIndex = project.phases.findIndex(p => p.id === phaseId);
      if (phaseIndex === -1) return;

      const phase = project.phases[phaseIndex];
      if (!phase.startDate || !phase.endDate) return;

      const startDate = parseISO(phase.startDate);
      const endDate = parseISO(phase.endDate);

      let newStartDate: Date;
      let newEndDate: Date;

      if (type === 'move') {
        newStartDate = addDays(startDate, daysDelta);
        newEndDate = addDays(endDate, daysDelta);
      } else if (type === 'resize-left') {
        newStartDate = addDays(startDate, daysDelta);
        if (newStartDate >= endDate) {
          newStartDate = addDays(endDate, -1);
        }
        newEndDate = endDate;
      } else {
        newEndDate = addDays(endDate, daysDelta);
        if (newEndDate <= startDate) {
          newEndDate = addDays(startDate, 1);
        }
        newStartDate = startDate;
      }

      updatePhase(projectId, phaseId, {
        startDate: format(newStartDate, 'yyyy-MM-dd'),
        endDate: format(newEndDate, 'yyyy-MM-dd'),
      });

      const dependentPhases = project.phases.filter(
        (p, i) => i > phaseIndex && p.dependencies?.some(d => d.phaseId === phaseId)
      );

      let currentEndDate = newEndDate;
      dependentPhases.forEach((depPhase, idx) => {
        const depPhaseIndex = project.phases.findIndex(p => p.id === depPhase.id);
        const newPhaseStart = calculateNewPhaseStart(depPhase, project.phases, currentEndDate, holidays);
        const newPhaseEnd = calculatePhaseEndDate(newPhaseStart, depPhase.manDays, holidays);
        
        updatePhase(projectId, depPhase.id, {
          startDate: format(newPhaseStart, 'yyyy-MM-dd'),
          endDate: format(newPhaseEnd, 'yyyy-MM-dd'),
        });
        
        currentEndDate = newPhaseEnd;
      });
    },
    [draggingPhase, dragStartDate, unitWidth, projects, updatePhase, holidays]
  );

  const handleMouseUp = useCallback(() => {
    setDraggingPhase(null);
    setDragStartDate(null);
    setDragStartEndDate(null);
  }, []);

  useEffect(() => {
    if (draggingPhase) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingPhase, handleMouseMove, handleMouseUp]);

  return (
    <div className="flex flex-col h-full bg-gray-100">
      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-gray-800">时间轴</h1>

          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 rounded p-0.5">
            {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  viewMode === mode ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {mode === 'day' ? '日' : mode === 'week' ? '周' : '月'}
              </button>
            ))}
          </div>

          {/* Zoom Controls */}
          <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="p-1.5 hover:bg-gray-100 rounded">
            <ZoomOut size={18} className="text-gray-600" />
          </button>
          <span className="text-xs text-gray-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(2, z + 0.25))} className="p-1.5 hover:bg-gray-100 rounded">
            <ZoomIn size={18} className="text-gray-600" />
          </button>

          <div className="flex-1" />

          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜索项目/环节..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 h-8 pl-9 pr-3 rounded border border-gray-300 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Export */}
          <button onClick={() => setShowExportModal(true)} className="px-3 py-1.5 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50">
            <Download size={14} className="inline mr-1" />
            导出
          </button>

          {/* New Project */}
          <button className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
            <Plus size={14} className="inline mr-1" />
            新建项目
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-4 mt-3">
          <span className="text-sm text-gray-600">管线:</span>
          <div className="flex gap-1">
            {pipelines.map((pipeline) => {
              const isSelected = selectedPipelineIds.includes(pipeline.id);
              return (
                <button
                  key={pipeline.id}
                  onClick={() => {
                    setSelectedPipelines(
                      isSelected ? selectedPipelineIds.filter((id) => id !== pipeline.id) : [...selectedPipelineIds, pipeline.id]
                    );
                  }}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    isSelected ? 'text-white' : 'bg-gray-100 text-gray-600 hover:text-gray-800'
                  }`}
                  style={isSelected ? { backgroundColor: pipeline.color } : undefined}
                >
                  {pipeline.name}
                </button>
              );
            })}
            <button
              onClick={() => setSelectedPipelines([])}
              className="px-2 py-1 rounded text-xs text-gray-400 hover:text-gray-600"
            >
              全部
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showOnlyWithDependencies}
              onChange={(e) => setShowOnlyWithDependencies(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
            只看有依赖的项目
          </label>

          <div className="flex-1" />

          <span className="text-xs text-gray-500">
            共 {filteredProjects.length} 个项目，{filteredProjects.filter((p) => p.dependencies.length > 0).length} 个有依赖
          </span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Project List */}
        <div className="w-72 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <span className="text-xs font-medium text-gray-500 uppercase">项目列表</span>
          </div>
          <div className="flex-1 overflow-y-auto" ref={listRef} onScroll={handleListScroll}>
            {pipelines.map((pipeline) => {
              const pipelineProjects = groupedProjects[pipeline.id] || [];
              const isExpanded = expandedPipelines.includes(pipeline.id);
              return (
                <div key={pipeline.id}>
                  <button
                    onClick={() => togglePipeline(pipeline.id)}
                    className="w-full px-4 py-2 flex items-center gap-2 hover:bg-gray-50 transition-colors"
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pipeline.color }} />
                    <span className="text-sm font-medium text-gray-800 flex-1 text-left">{pipeline.name}</span>
                    <span className="text-xs text-gray-400">{pipelineProjects.length}</span>
                  </button>

                  {isExpanded &&
                    pipelineProjects.map((project) => {
                      const isCollapsed = collapsedProjects.has(project.id);
                      const phaseCount = project.phases.filter(p => p.startDate && p.endDate).length;
                      const phaseHeight = phaseCount > 0 ? phaseCount * 32 : 0;
                      const rowHeight = isCollapsed ? 48 : 48 + phaseHeight;
                      return (
                        <div 
                          key={project.id} 
                          className="border-l-2 border-transparent hover:border-blue-300"
                        >
                          <div 
                            className="pl-8 pr-4 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                            style={{ height: 48 }}
                            onClick={() => toggleProject(project.id)}
                          >
                            {isCollapsed ? (
                              <ChevronRight size={12} className="text-gray-400 flex-shrink-0" />
                            ) : (
                              <ChevronDown size={12} className="text-gray-400 flex-shrink-0" />
                            )}
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-sm text-gray-800 truncate">{project.name}</span>
                              <span
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: levelColors[project.level] }}
                                title={project.level}
                              />
                            </div>
                            <span className="text-xs text-gray-400 flex-shrink-0">{phaseCount}环节</span>
                          </div>
                          {!isCollapsed && (
                            <div className="pl-10 pr-4 pb-2">
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-400">{project.manager}</span>
                                {project.dependencies.length > 0 && (
                                  <span className="flex items-center gap-0.5 text-xs text-blue-600">
                                    <Link2 size={10} />
                                    {project.dependencies.length}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${project.progress || 0}%`, backgroundColor: pipeline.color }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Timeline Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Timeline Header - synced scroll with body */}
          <div 
            className="flex-shrink-0 bg-white border-b border-gray-200 overflow-hidden"
          >
            <div 
              className="overflow-x-auto scrollbar-thin"
              ref={headerRef}
              onScroll={(e) => {
                const scrollLeft = e.currentTarget.scrollLeft;
                if (bodyRef.current) {
                  bodyRef.current.scrollLeft = scrollLeft;
                }
              }}
            >
              <div className="relative" style={{ width: totalWidth, minHeight: 56 }}>
                {timeUnits.map((unit, index) => (
                  <div
                    key={index}
                    className={`absolute top-0 bottom-0 flex flex-col items-center justify-center border-r border-gray-200 ${
                      isSameDay(unit, today) || (viewMode === 'week' && index === 0) ? 'bg-blue-50' : ''
                    } ${isWeekend(unit) && viewMode === 'day' ? 'bg-gray-50' : ''}`}
                    style={{ left: index * unitWidth, width: unitWidth }}
                  >
                    <span className={`text-xs ${isSameDay(unit, today) ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>
                      {viewMode === 'day'
                        ? format(unit, 'MM/dd')
                        : viewMode === 'week'
                        ? `${format(unit, 'MM/dd')}~${format(addDays(unit, 6), 'MM/dd')}`
                        : format(unit, 'yyyy年MM月')}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {viewMode === 'day'
                        ? format(unit, 'EEE', { locale: zhCN })
                        : viewMode === 'week'
                        ? `第${index + 1}周`
                        : format(unit, 'M月', { locale: zhCN })}
                    </span>
                    {getHolidayInfo(unit) && (
                      <span className="text-[10px] text-red-500 mt-0.5">{getHolidayInfo(unit)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Timeline Body */}
          <div 
            className="flex-1 overflow-auto scrollbar-thin" 
            onScroll={handleBodyScroll}
            ref={bodyRef}
          >
            <div className="relative" style={{ width: totalWidth, minHeight: '100%' }}>
              {/* Grid Lines */}
              {timeUnits.map((_, index) => (
                <div
                  key={index}
                  className="absolute top-0 bottom-0 w-px bg-gray-200"
                  style={{ left: index * unitWidth }}
                />
              ))}

              {/* Today Line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-10"
                style={{ left: getDateOffset(today) }}
              />

              {/* Project Rows */}
              {pipelines.map((pipeline) => {
                const pipelineProjects = groupedProjects[pipeline.id] || [];
                if (!expandedPipelines.includes(pipeline.id)) return null;

                let currentTop = 0;
                const rows: { project: Project; top: number; height: number }[] = [];
                
                pipelineProjects.forEach((project) => {
                  const isCollapsed = collapsedProjects.has(project.id);
                  const phaseCount = project.phases.filter(p => p.startDate && p.endDate).length;
                  const phaseHeight = phaseCount > 0 ? phaseCount * 32 : 0;
                  const rowHeight = isCollapsed ? 48 : 48 + phaseHeight;
                  rows.push({ project, top: currentTop, height: rowHeight, isCollapsed, phaseCount });
                  currentTop += rowHeight;
                });

                return (
                  <div key={pipeline.id} className="relative" style={{ height: currentTop }}>
                    {rows.map(({ project, top, height, isCollapsed, phaseCount }) => (
                      <div 
                        key={project.id} 
                        className="absolute left-0 right-0 border-b border-gray-200"
                        style={{ top, height }}
                      >
                        {/* Project Header */}
                        <div className="absolute left-0 right-0 h-12 flex items-center px-3 bg-gray-50 border-b border-gray-200">
                          <button
                            onClick={() => toggleProject(project.id)}
                            className="p-1 hover:bg-gray-200 rounded mr-1"
                          >
                            {isCollapsed ? (
                              <ChevronRight size={14} className="text-gray-500" />
                            ) : (
                              <ChevronDown size={14} className="text-gray-500" />
                            )}
                          </button>
                          <span className="w-2.5 h-2.5 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: pipeline.color }} />
                          <span className="text-sm font-medium text-gray-700 truncate">{project.name}</span>
                          <span className="ml-2 text-xs text-gray-400">{phaseCount}环节</span>
                        </div>

                        {/* Phase Bars */}
                        {!isCollapsed && (
                          <div className="absolute left-0 right-0 pt-12 px-2 pb-2" style={{ height: height - 48 }}>
                            {project.phases.map((phase, phaseIndex) => {
                              if (!phase.startDate || !phase.endDate) return null;
                              const barLeft = getDateOffset(phase.startDate);
                              const barWidth = getPhaseWidth(phase.startDate, phase.endDate);
                              const barTop = phaseIndex * 32 + 4;
                              const color = statusColors[phase.status || 'not_started'];
                              
                              const hasDependency = phase.dependencies && phase.dependencies.length > 0;
                              const depType = hasDependency ? phase.dependencies[0].type : null;
                              const depPercent = phase.dependencies?.[0]?.percentage;
                              const isDragging = draggingPhase?.phaseId === phase.id;

                              return (
                                <div
                                  key={phase.id}
                                  className={`absolute h-7 rounded flex items-center text-xs text-white transition-shadow ${isDragging ? 'shadow-lg z-20' : 'hover:shadow-md cursor-move'}`}
                                  style={{
                                    left: barLeft,
                                    width: barWidth,
                                    top: barTop,
                                    backgroundColor: color,
                                  }}
                                  title={`${phase.name}: ${phase.startDate} - ${phase.endDate}${hasDependency ? ` (依赖触发)` : ''}`}
                                >
                                  {/* Left resize handle */}
                                  <div
                                    className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 rounded-l"
                                    onMouseDown={(e) => handlePhaseMouseDown(e, project.id, phase.id, 'resize-left', phase.startDate, phase.endDate)}
                                  />
                                  
                                  {/* Phase content - drag to move */}
                                  <div
                                    className="flex-1 flex items-center px-2 overflow-hidden"
                                    onMouseDown={(e) => handlePhaseMouseDown(e, project.id, phase.id, 'move', phase.startDate, phase.endDate)}
                                  >
                                    <span className="truncate">{phase.name}</span>
                                    {phase.isKeyNode && <span className="ml-1 text-yellow-200">★</span>}
                                    {hasDependency && (
                                      <span className="ml-1 text-white/70 text-[10px]">
                                        {depType === 'FS' && '→'}
                                        {depType === 'FS_PERCENT' && `⤳${depPercent}%`}
                                        {depType === 'FS_OFFSET' && '→+'}
                                        {depType === 'SS_OFFSET' && '↷+'}
                                        {depType === 'SS_PARALLEL' && '↷'}
                                      </span>
                                    )}
                                  </div>
                                  
                                  {/* Right resize handle */}
                                  <div
                                    className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 rounded-r"
                                    onMouseDown={(e) => handlePhaseMouseDown(e, project.id, phase.id, 'resize-right', phase.startDate, phase.endDate)}
                                  />
                                </div>
                              );
                            })}
                            
                            {/* Dependency Lines */}
                            {project.phases.map((phase, phaseIndex) => {
                              if (!phase.dependencies || phase.dependencies.length === 0 || phaseIndex === 0) return null;
                              
                              const dep = phase.dependencies[0];
                              const sourcePhase = project.phases.find(p => p.id === dep.phaseId);
                              if (!sourcePhase?.startDate || !sourcePhase?.endDate) return null;
                              
                              const sourceBarTop = project.phases.indexOf(sourcePhase) * 32 + 7.5;
                              const targetBarTop = phaseIndex * 32 + 7.5;
                              const sourceEndLeft = getDateOffset(sourcePhase.endDate) + 2;
                              const targetStartLeft = getDateOffset(phase.startDate || sourcePhase.endDate);
                              
                              const lineColor = '#94a3b8';
                              
                              return (
                                <svg
                                  key={`dep-${phase.id}`}
                                  className="absolute pointer-events-none"
                                  style={{
                                    left: 0,
                                    top: 0,
                                    width: '100%',
                                    height: '100%',
                                    overflow: 'visible',
                                  }}
                                >
                                  <path
                                    d={`M ${sourceEndLeft} ${sourceBarTop} 
                                        C ${sourceEndLeft + 20} ${sourceBarTop},
                                          ${targetStartLeft - 20} ${targetBarTop},
                                          ${targetStartLeft} ${targetBarTop}`}
                                    fill="none"
                                    stroke={lineColor}
                                    strokeWidth="1.5"
                                    strokeDasharray={dep.type === 'FS_PERCENT' || dep.type === 'SS_PARALLEL' ? '4,2' : 'none'}
                                  />
                                  <circle
                                    cx={targetStartLeft}
                                    cy={targetBarTop}
                                    r="3"
                                    fill={lineColor}
                                  />
                                </svg>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && <ExportModal onClose={() => setShowExportModal(false)} />}
    </div>
  );
}
