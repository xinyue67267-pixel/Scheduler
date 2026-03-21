import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  format,
  addDays,
  addWeeks,
  addMonths,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  isSameDay,
  differenceInCalendarDays,
  startOfMonth,
  startOfDay,
  startOfWeek,
  isWithinInterval,
  parseISO,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  Search,
  Download,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Calendar,
  Filter,
} from 'lucide-react';
import { useStore } from '@/store';
import type { Project, ViewMode, Phase } from '@/types';
import ExportModal from '@/components/Export/ExportModal';

/**
 * --- Timeline Architecture v2.0 ---
 * 1. Linear Mapping: Dates are mapped to pixels via timeUnits index.
 * 2. Unified Scroll: Sidebar and Canvas sync vertically via refs.
 * 3. Interaction: Dragging uses a preview state for high performance.
 * 4. Geometry: All elements (Header, Grid, Phase, Deps) share the same coordinate logic.
 */

// UI Constants
const SIDEBAR_WIDTH = 280;
const HEADER_HEIGHT = 64;
const ROW_PROJECT_HEIGHT = 44;
const ROW_PHASE_HEIGHT = 36;

const STATUS_COLORS: Record<string, string> = {
  not_started: '#94a3b8', // slate-400
  in_progress: '#3b82f6', // blue-500
  completed: '#10b981',   // emerald-500
  overdue: '#ef4444',     // red-500
};

export default function Timeline() {
  const {
    projects,
    pipelines,
    viewMode,
    setViewMode,
    selectedPipelineIds,
    columnWidths,
    updatePhase,
  } = useStore();

  // --- UI State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [zoom, setZoom] = useState(1);
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [showExportModal, setShowExportModal] = useState(false);
  
  // Drag State
  const [dragging, setDragging] = useState<{
    projectId: string;
    phaseId: string;
    type: 'move' | 'resize-left' | 'resize-right';
    originalStart: string;
    originalEnd: string;
    startX: number;
  } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ start: string; end: string } | null>(null);

  // Refs
  const sidebarRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => startOfDay(new Date()), []);

  // --- 1. Coordinate System ---
  const timeUnits = useMemo(() => {
    const start = viewMode === 'day' 
      ? addDays(today, -30) 
      : viewMode === 'week' 
      ? startOfWeek(addWeeks(today, -12), { weekStartsOn: 1 })
      : startOfMonth(addMonths(today, -6));
    
    const end = addMonths(start, 24);
    
    if (viewMode === 'day') return eachDayOfInterval({ start, end });
    if (viewMode === 'week') return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
    return eachMonthOfInterval({ start, end });
  }, [viewMode, today]);

  const unitWidth = useMemo(() => columnWidths[viewMode] * zoom, [columnWidths, viewMode, zoom]);
  const totalWidth = timeUnits.length * unitWidth;

  const getPixelOffset = useCallback((dateInput: string | Date | undefined | null) => {
    if (!dateInput || timeUnits.length === 0) return 0;
    let date: Date;
    try {
      date = startOfDay(typeof dateInput === 'string' ? parseISO(dateInput) : dateInput);
      if (isNaN(date.getTime())) return 0;
    } catch (e) { return 0; }

    const rangeStart = timeUnits[0];
    if (date < rangeStart) return 0;

    // 统一索引查找逻辑，确保 Header 和环节块完全对齐
    let unitIndex = -1;
    if (viewMode === 'day') {
      unitIndex = differenceInCalendarDays(date, rangeStart);
    } else if (viewMode === 'week') {
      unitIndex = Math.floor(differenceInCalendarDays(date, rangeStart) / 7);
    } else {
      unitIndex = timeUnits.findIndex((u, idx) => {
        const next = timeUnits[idx + 1] || addMonths(u, 1);
        return date >= u && date < next;
      });
    }

    if (unitIndex === -1) return 0;
    if (unitIndex >= timeUnits.length) return totalWidth;

    const currentUnitStart = timeUnits[unitIndex];
    const nextUnitStart = timeUnits[unitIndex + 1] || (
      viewMode === 'day' ? addDays(currentUnitStart, 1) :
      viewMode === 'week' ? addDays(currentUnitStart, 7) :
      addMonths(currentUnitStart, 1)
    );

    const unitTotalDays = differenceInCalendarDays(nextUnitStart, currentUnitStart);
    const dayOffset = differenceInCalendarDays(date, currentUnitStart);
    const progress = unitTotalDays > 0 ? dayOffset / unitTotalDays : 0;

    return (unitIndex + progress) * unitWidth;
  }, [viewMode, unitWidth, timeUnits, totalWidth]);

  const getPhaseWidth = useCallback((start: string, end: string) => {
    const startDate = parseISO(start);
    const endDate = parseISO(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 24;

    const s = getPixelOffset(startDate);
    const e = getPixelOffset(addDays(endDate, 1));
    return Math.max(e - s, 24);
  }, [getPixelOffset]);

  // --- 2. Data Processing ---
  const filteredData = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return pipelines.map(pipeline => {
      const pipeProjects = projects.filter(p => 
        p.pipelineId === pipeline.id && 
        (selectedPipelineIds.length === 0 || selectedPipelineIds.includes(pipeline.id)) &&
        (p.name.toLowerCase().includes(query) || p.phases.some(ph => ph.name.toLowerCase().includes(query)))
      );
      return { ...pipeline, projects: pipeProjects };
    }).filter(p => p.projects.length > 0);
  }, [pipelines, projects, selectedPipelineIds, searchQuery]);

  // Flatten layout for vertical sync
  const layoutRows = useMemo(() => {
    const rows: any[] = [];
    filteredData.forEach(pipeline => {
      pipeline.projects.forEach(project => {
        const isCollapsed = collapsedProjects.has(project.id);
        const phases = project.phases.filter(ph => ph.startDate && ph.endDate);
        
        rows.push({ type: 'project', data: project, pipelineColor: pipeline.color });
        if (!isCollapsed) {
          phases.forEach(phase => rows.push({ type: 'phase', data: phase, projectId: project.id }));
        }
      });
    });
    return rows;
  }, [filteredData, collapsedProjects]);

  // --- 3. Interaction Handlers ---
  const handleVerticalScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (e.currentTarget === sidebarRef.current && canvasRef.current) {
      canvasRef.current.scrollTop = scrollTop;
    } else if (e.currentTarget === canvasRef.current && sidebarRef.current) {
      sidebarRef.current.scrollTop = scrollTop;
    }
  }, []);

  const handleMouseDown = (e: React.MouseEvent, projectId: string, phase: Phase, type: any) => {
    e.preventDefault();
    if (!phase.startDate || !phase.endDate) return;
    setDragging({
      projectId,
      phaseId: phase.id,
      type,
      originalStart: phase.startDate,
      originalEnd: phase.endDate,
      startX: e.clientX,
    });
  };

  useEffect(() => {
    if (!dragging) return;

    const onMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragging.startX;
      const dayWidth = viewMode === 'day' ? unitWidth : viewMode === 'week' ? unitWidth / 7 : unitWidth / 30.4;
      const daysDiff = Math.round(deltaX / dayWidth);

      const start = parseISO(dragging.originalStart);
      const end = parseISO(dragging.originalEnd);

      let newStart = start;
      let newEnd = end;

      if (dragging.type === 'move') {
        newStart = addDays(start, daysDiff);
        newEnd = addDays(end, daysDiff);
      } else if (dragging.type === 'resize-left') {
        newStart = addDays(start, daysDiff);
        if (newStart > end) newStart = end;
      } else {
        newEnd = addDays(end, daysDiff);
        if (newEnd < start) newEnd = start;
      }

      setDragPreview({
        start: format(newStart, 'yyyy-MM-dd'),
        end: format(newEnd, 'yyyy-MM-dd'),
      });
    };

    const onMouseUp = () => {
      if (dragPreview) {
        updatePhase(dragging.projectId, dragging.phaseId, {
          startDate: dragPreview.start,
          endDate: dragPreview.end,
        });
        // cascade logic can be added here
      }
      setDragging(null);
      setDragPreview(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging, dragPreview, unitWidth, viewMode, updatePhase]);

  // --- 4. Render Helpers ---
  const renderHeader = () => (
    <div className="sticky top-0 z-30 flex bg-white border-b border-gray-200" style={{ height: HEADER_HEIGHT, width: totalWidth }}>
      {timeUnits.map((unit, i) => {
        const isCurrent = viewMode === 'day' 
          ? isSameDay(unit, today)
          : viewMode === 'week'
          ? isWithinInterval(today, { start: unit, end: addDays(unit, 6) })
          : unit.getMonth() === today.getMonth() && unit.getFullYear() === today.getFullYear();

        return (
          <div 
            key={i} 
            className={`absolute top-0 bottom-0 flex flex-col items-center justify-center border-r border-gray-100 ${isCurrent ? 'bg-blue-50/50' : ''}`}
            style={{ left: i * unitWidth, width: unitWidth }}
          >
            <span className={`text-[11px] font-bold ${isCurrent ? 'text-blue-600' : 'text-gray-500'}`}>
              {viewMode === 'day'
                ? format(unit, 'MM/dd')
                : viewMode === 'week'
                ? `${format(unit, 'MM/dd')}-${format(addDays(unit, 6), 'MM/dd')}`
                : format(unit, 'yyyy/MM')}
            </span>
            <span className="text-[10px] text-gray-400 mt-0.5">
              {viewMode === 'day' ? format(unit, 'EEE', { locale: zhCN }) : format(unit, 'MM/dd')}
            </span>
          </div>
        );
      })}
    </div>
  );

  const renderCanvasContent = () => {
    let currentTop = 0;
    const positions = new Map<string, { top: number; left: number; width: number }>();

    const content = layoutRows.map((row, idx) => {
      const top = currentTop;
      const height = row.type === 'project' ? ROW_PROJECT_HEIGHT : ROW_PHASE_HEIGHT;
      currentTop += height;

      if (row.type === 'project') {
        return <div key={`p-${row.data.id}`} className="absolute left-0 right-0 border-b border-gray-50 bg-gray-50/30" style={{ top, height }} />;
      }

      const phase = row.data;
      const isDragging = dragging?.phaseId === phase.id;
      const displayStart = isDragging && dragPreview ? dragPreview.start : phase.startDate;
      const displayEnd = isDragging && dragPreview ? dragPreview.end : phase.endDate;
      
      const left = getPixelOffset(displayStart);
      const width = getPhaseWidth(displayStart, displayEnd);
      positions.set(phase.id, { top, left, width });

      return (
        <div key={`ph-${phase.id}`} className="absolute left-0 right-0 border-b border-gray-50 group" style={{ top, height }}>
          <div 
            className={`absolute top-1.5 bottom-1.5 rounded shadow-sm flex items-center px-2 text-[10px] text-white cursor-move z-10 transition-all ${isDragging ? 'ring-2 ring-yellow-400 z-20 scale-[1.02] shadow-lg' : 'hover:shadow-md'}`}
            style={{ left, width, backgroundColor: STATUS_COLORS[phase.status || 'not_started'] }}
            onMouseDown={e => handleMouseDown(e, row.projectId, phase, 'move')}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/30" onMouseDown={e => { e.stopPropagation(); handleMouseDown(e, row.projectId, phase, 'resize-left'); }} />
            <span className="truncate select-none font-medium">{phase.name}</span>
            <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/30" onMouseDown={e => { e.stopPropagation(); handleMouseDown(e, row.projectId, phase, 'resize-right'); }} />
          </div>
        </div>
      );
    });

    return { content, positions, totalHeight: currentTop };
  };

  const { content: canvasItems, positions: phasePositions, totalHeight } = renderCanvasContent();

  const renderDependencies = () => (
    <svg className="absolute inset-0 pointer-events-none overflow-visible z-0">
      {projects.map(project => 
        project.phases.map(phase => {
          if (!phase.dependencies || phase.dependencies.length === 0) return null;
          const targetPos = phasePositions.get(phase.id);
          if (!targetPos) return null;

          return phase.dependencies.map(dep => {
            const sourcePos = phasePositions.get(dep.phaseId);
            if (!sourcePos) return null;

            const startX = sourcePos.left + sourcePos.width;
            const startY = sourcePos.top + ROW_PHASE_HEIGHT / 2;
            const endX = targetPos.left;
            const endY = targetPos.top + ROW_PHASE_HEIGHT / 2;

            return (
              <path
                key={`${dep.phaseId}-${phase.id}`}
                d={`M ${startX} ${startY} C ${startX + 24} ${startY}, ${endX - 24} ${endY}, ${endX} ${endY}`}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="1.5"
                strokeDasharray={dep.type === 'FS_PERCENT' ? '4,2' : 'none'}
              />
            );
          });
        })
      )}
    </svg>
  );

  return (
    <div className="flex flex-col h-full bg-white font-sans text-slate-900">
      {/* 1. Enhanced Toolbar */}
      <header className="flex-shrink-0 h-16 border-b border-slate-200 flex items-center px-6 gap-6 bg-white z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg text-white"><Calendar size={20}/></div>
          <h1 className="font-extrabold text-lg tracking-tight">Timeline <span className="text-blue-600">Pro</span></h1>
        </div>
        
        <nav className="flex bg-slate-100 p-1 rounded-xl">
          {(['day', 'week', 'month'] as ViewMode[]).map(m => (
            <button 
              key={m} 
              onClick={() => setViewMode(m)}
              className={`px-5 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === m ? 'bg-white shadow-md text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {m === 'day' ? '日' : m === 'week' ? '周' : '月'}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 border-l border-slate-200 pl-6">
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"><ZoomOut size={18}/></button>
          <span className="text-[13px] font-bold text-slate-600 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"><ZoomIn size={18}/></button>
        </div>

        <div className="flex-1" />
        
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16}/>
          <input 
            className="w-72 pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
            placeholder="搜索项目名称或环节..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        
        <button 
          onClick={() => setShowExportModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200"
        >
          <Download size={16}/> 导出报告
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* 2. Synchronized Sidebar */}
        <aside className="flex-shrink-0 border-r border-slate-200 flex flex-col bg-white z-20" style={{ width: SIDEBAR_WIDTH }}>
          <div className="h-[64px] flex-shrink-0 border-b border-slate-200 flex items-center px-5 bg-slate-50/50 font-black text-[10px] text-slate-400 uppercase tracking-[0.2em]">
            <Filter size={12} className="mr-2"/> Navigation
          </div>
          <div 
            ref={sidebarRef}
            onScroll={handleVerticalScroll}
            className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide select-none"
          >
            {layoutRows.map((row, idx) => (
              <div 
                key={idx} 
                className={`flex items-center px-4 border-b border-slate-100 transition-colors ${row.type === 'project' ? 'h-[44px] bg-slate-50/30' : 'h-[36px] hover:bg-blue-50/30'}`}
              >
                {row.type === 'project' ? (
                  <>
                    <button 
                      onClick={() => setCollapsedProjects(prev => {
                        const next = new Set(prev);
                        if (next.has(row.data.id)) next.delete(row.data.id); else next.add(row.data.id);
                        return next;
                      })}
                      className="p-1 hover:bg-slate-200 rounded transition-colors mr-2"
                    >
                      <div className={`transition-transform duration-200 ${collapsedProjects.has(row.data.id) ? '' : 'rotate-90'}`}>
                        <ChevronRight size={14} className="text-slate-400" />
                      </div>
                    </button>
                    <span className="w-2 h-2 rounded-full mr-3 shadow-sm" style={{ backgroundColor: row.pipelineColor }} />
                    <span className="text-sm font-bold text-slate-700 truncate">{row.data.name}</span>
                  </>
                ) : (
                  <>
                    <div className="w-8 flex justify-center"><div className="w-0.5 h-4 bg-slate-200" /></div>
                    <span className="text-[13px] text-slate-500 truncate font-medium italic">{row.data.name}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* 3. Reconstructed Canvas */}
        <main 
          className="flex-1 overflow-auto relative bg-[#f8fafc] scroll-smooth" 
          ref={canvasRef}
          onScroll={handleVerticalScroll}
        >
          <div style={{ width: totalWidth, minHeight: '100%', position: 'relative' }}>
            {renderHeader()}
            
            <div className="relative" style={{ height: totalHeight }}>
              {/* Background Grid */}
              <div className="absolute inset-0 pointer-events-none">
                {timeUnits.map((_, i) => (
                  <div key={i} className="absolute top-0 bottom-0 border-r border-slate-200/60" style={{ left: i * unitWidth, width: unitWidth }} />
                ))}
                <div className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-10 shadow-[0_0_8px_rgba(59,130,246,0.5)]" style={{ left: getPixelOffset(today) }} />
              </div>

              {renderDependencies()}
              {canvasItems}
            </div>
          </div>
        </main>
      </div>

      {showExportModal && <ExportModal onClose={() => setShowExportModal(false)} />}
    </div>
  );
}
