import { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  X,
  Link2,
  Check,
  AlertTriangle,
  ArrowRight,
  Clock,
  Calendar,
  Users,
  Calculator,
} from 'lucide-react';
import {
  format,
  parseISO,
  addDays,
  differenceInDays,
  isAfter,
  isBefore,
} from 'date-fns';
import { useStore } from '@/store';
import type { Project, Dependency, Phase, DependencyType, PhaseTemplate } from '@/types';
import { calculatePhasesWithDependencies, calculatePhasesWithDependenciesBackward } from '@/utils/phaseCalculator';

const statusLabels: Record<string, { label: string; color: string }> = {
  not_started: { label: '未开始', color: 'text-text-muted' },
  in_progress: { label: '进行中', color: 'text-primary' },
  delayed: { label: '已延期', color: 'text-status-error' },
  completed: { label: '已完成', color: 'text-status-success' },
};

const dependencyTypeLabels: Record<DependencyType, string> = {
  FS: '完成-开始',
  SS: '开始-开始',
  FF: '完成-完成',
};

export default function Requirements() {
  const {
    projects,
    pipelines,
    paradigms,
    holidays,
    levels,
    categories,
    addProject,
    updateProject,
    deleteProject,
    updatePhase,
    addDependency,
    updateDependency,
    deleteDependency,
  } = useStore();

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'dependency' | 'preview'>('basic');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Partial<Project> | null>(null);
  const [showDepModal, setShowDepModal] = useState(false);
  const [newDep, setNewDep] = useState<Partial<Dependency>>({});
  const [depError, setDepError] = useState<string | null>(null);
  const [expandedPipelines, setExpandedPipelines] = useState<string[]>(
    pipelines.map((p) => p.id)
  );

  const filteredProjects = useMemo(() => {
    if (!searchQuery) return projects;
    const query = searchQuery.toLowerCase();
    return projects.filter((p) => p.name.toLowerCase().includes(query));
  }, [projects, searchQuery]);

  const groupedProjects = useMemo(() => {
    const grouped: Record<string, Project[]> = {};
    pipelines.forEach((pipeline) => {
      grouped[pipeline.id] = filteredProjects.filter(
        (p) => p.pipelineId === pipeline.id
      );
    });
    return grouped;
  }, [filteredProjects, pipelines]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId),
    [projects, selectedProjectId]
  );

  const selectedParadigm = useMemo(
    () => paradigms.find((p) => p.id === editingProject?.paradigmId),
    [paradigms, editingProject]
  );

  const togglePipeline = (pipelineId: string) => {
    setExpandedPipelines((prev) =>
      prev.includes(pipelineId)
        ? prev.filter((id) => id !== pipelineId)
        : [...prev, pipelineId]
    );
  };

  const calculateBackward = (
    deadline: string,
    phases: Phase[],
    calendar: typeof holidays
  ) => {
    let currentDate = parseISO(deadline);
    const result: Phase[] = [];

    for (let i = phases.length - 1; i >= 0; i--) {
      const phase = { ...phases[i] };
      let workDaysLeft = phase.manDays;

      while (workDaysLeft > 0) {
        currentDate = addDays(currentDate, -1);
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const isHoliday = calendar.some(
          (h) => h.date === dateStr && h.type === 'holiday'
        );
        const dayOfWeek = currentDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        if (!isHoliday && !isWeekend) {
          workDaysLeft--;
        }
      }

      phase.endDate = format(currentDate, 'yyyy-MM-dd');
      const startDate = addDays(currentDate, phase.manDays - 1);
      phase.startDate = format(startDate, 'yyyy-MM-dd');

      result.unshift(phase);
      currentDate = startDate;
    }

    return result;
  };

  const openNewProjectModal = () => {
    setEditingProject({
      id: `project-${Date.now()}`,
      name: '',
      pipelineId: pipelines[0]?.id || '',
      level: 'P2',
      category: categories[0] || '',
      status: 'not_started',
      phases: [],
      dependencies: [],
    });
    setShowModal(true);
  };

  const handleParadigmChange = (paradigmId: string) => {
    const paradigm = paradigms.find((p) => p.id === paradigmId);
    if (!paradigm || !editingProject) return;

    const phases: Phase[] = paradigm.phases.map((p) => ({
      ...p,
      startDate: undefined,
      endDate: undefined,
      status: 'not_started',
    }));

    if (editingProject.startDate) {
      const startDate = parseISO(editingProject.startDate);
      const calculatedPhases = calculatePhasesWithDependencies(
        paradigm.phases,
        startDate,
        holidays
      );
      const resultPhases = calculatedPhases.map(cp => ({
        ...cp,
        status: 'not_started' as const,
      }));
      setEditingProject({ ...editingProject, paradigmId, phases: resultPhases });
    } else if (editingProject.deadline) {
      const calculatedPhases = calculateBackward(
        editingProject.deadline,
        phases,
        holidays
      );
      setEditingProject({ ...editingProject, paradigmId, phases: calculatedPhases });
    } else {
      setEditingProject({ ...editingProject, paradigmId, phases });
    }
  };

  const handleStartDateChange = (startDateStr: string) => {
    if (!editingProject || !selectedParadigm) return;

    const startDate = parseISO(startDateStr);
    const calculatedPhases = calculatePhasesWithDependencies(
      selectedParadigm.phases,
      startDate,
      holidays
    );
    const resultPhases = calculatedPhases.map(cp => ({
      ...cp,
      status: 'not_started' as const,
    }));
    
    const lastPhase = resultPhases[resultPhases.length - 1];
    const deadline = lastPhase?.endDate;
    
    setEditingProject({ ...editingProject, startDate: startDateStr, deadline, phases: resultPhases });
  };

  const handleDeadlineChange = (deadline: string) => {
    if (!editingProject || !selectedParadigm) return;

    const deadlineDate = parseISO(deadline);
    const calculatedPhases = calculatePhasesWithDependenciesBackward(
      selectedParadigm.phases,
      deadlineDate,
      holidays
    );
    
    const resultPhases = calculatedPhases.map(cp => ({
      ...cp,
      status: 'not_started' as const,
    }));
    
    const firstPhase = resultPhases[0];
    const startDate = firstPhase?.startDate;
    
    setEditingProject({ ...editingProject, deadline, startDate, phases: resultPhases });
  };

  const handleSaveProject = () => {
    if (!editingProject?.name || !editingProject.pipelineId) return;

    const projectToSave: Project = {
      id: editingProject.id!,
      name: editingProject.name,
      pipelineId: editingProject.pipelineId,
      paradigmId: editingProject.paradigmId,
      level: editingProject.level as Project['level'],
      category: editingProject.category,
      startDate: editingProject.startDate,
      deadline: editingProject.deadline,
      status: editingProject.status as Project['status'],
      manager: editingProject.manager,
      phases: editingProject.phases || [],
      dependencies: editingProject.dependencies || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (selectedProject) {
      updateProject(projectToSave.id, projectToSave);
    } else {
      addProject(projectToSave);
      setSelectedProjectId(projectToSave.id);
    }

    setShowModal(false);
    setEditingProject(null);
  };

  const validateDependency = (dep: Partial<Dependency>): string | null => {
    if (!dep.sourceProjectId || !dep.sourcePhaseId || !dep.targetPhaseId) {
      return '请完整填写依赖信息';
    }

    const sourceProject = projects.find((p) => p.id === dep.sourceProjectId);
    if (!sourceProject) return '被依赖项目不存在';

    const sourcePhase = sourceProject.phases.find((p) => p.id === dep.sourcePhaseId);
    const targetPhase = selectedProject?.phases.find((p) => p.id === dep.targetPhaseId);

    if (!sourcePhase || !targetPhase) return '环节不存在';

    if (sourcePhase.endDate && targetPhase.startDate) {
      if (isAfter(parseISO(sourcePhase.endDate), parseISO(targetPhase.startDate))) {
        return '时间不满足依赖条件';
      }
    }

    return null;
  };

  const handleAddDependency = () => {
    if (!selectedProject || !newDep.sourceProjectId || !newDep.sourcePhaseId || !newDep.targetPhaseId) {
      return;
    }

    const error = validateDependency(newDep);
    if (error) {
      setDepError(error);
      return;
    }

    addDependency({
      id: `dep-${Date.now()}`,
      sourceProjectId: newDep.sourceProjectId,
      sourcePhaseId: newDep.sourcePhaseId,
      targetProjectId: selectedProject.id,
      targetPhaseId: newDep.targetPhaseId,
      type: newDep.type || 'FS',
      lagDays: newDep.lagDays,
    });

    setNewDep({});
    setShowDepModal(false);
    setDepError(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-text-primary">需求</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                type="text"
                placeholder="搜索需求..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input w-64 pl-9"
              />
            </div>
            <button onClick={openNewProjectModal} className="btn btn-primary">
              <Plus size={16} />
              新建需求
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Project List */}
        <div className="w-80 flex-shrink-0 bg-white border-r border-border flex flex-col">
          <div className="p-3 border-b border-border bg-canvas/50">
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
              项目列表
            </span>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {pipelines.map((pipeline) => {
              const pipelineProjects = groupedProjects[pipeline.id] || [];
              const isExpanded = expandedPipelines.includes(pipeline.id);

              return (
                <div key={pipeline.id}>
                  <button
                    onClick={() => togglePipeline(pipeline.id)}
                    className="w-full px-3 py-2 flex items-center gap-2 hover:bg-canvas/50 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown size={14} className="text-text-muted" />
                    ) : (
                      <ChevronRight size={14} className="text-text-muted" />
                    )}
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: pipeline.color }}
                    />
                    <span className="text-sm font-medium text-text-primary flex-1 text-left">
                      {pipeline.name}
                    </span>
                    <span className="text-xs text-text-muted">
                      {pipelineProjects.length}
                    </span>
                  </button>

                  {isExpanded &&
                    pipelineProjects.map((project) => (
                      <button
                        key={project.id}
                        onClick={() => setSelectedProjectId(project.id)}
                        className={`w-full px-4 py-3 text-left border-l-2 transition-colors hover:bg-canvas/50 ${
                          selectedProjectId === project.id
                            ? 'border-primary bg-primary/5'
                            : 'border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-text-primary truncate">
                            {project.name}
                          </span>
                          <span
                            className={`text-xs ${statusLabels[project.status].color}`}
                          >
                            {statusLabels[project.status].label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-text-muted">
                          {project.startDate && project.deadline && (
                            <span className="flex items-center gap-1">
                              <Calendar size={12} />
                              {project.startDate} - {project.deadline}
                            </span>
                          )}
                          {project.dependencies.length > 0 && (
                            <span className="flex items-center gap-1 text-primary">
                              <Link2 size={12} />
                              {project.dependencies.length}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 h-1 bg-canvas rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${project.progress || 0}%` }}
                          />
                        </div>
                      </button>
                    ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedProject ? (
            <>
              {/* Tabs */}
              <div className="flex-shrink-0 bg-white border-b border-border px-6">
                <div className="flex gap-6">
                  {[
                    { id: 'basic', label: '基本信息' },
                    { id: 'dependency', label: '依赖关系' },
                    { id: 'preview', label: '甘特预览' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === tab.id
                          ? 'border-primary text-primary'
                          : 'border-transparent text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-auto p-6 scrollbar-thin">
                {activeTab === 'basic' && (
                  <div className="max-w-2xl space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1.5">
                          项目名称
                        </label>
                        <input
                          type="text"
                          value={selectedProject.name}
                          onChange={(e) =>
                            updateProject(selectedProject.id, { name: e.target.value })
                          }
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1.5">
                          所属管线
                        </label>
                        <select
                          value={selectedProject.pipelineId}
                          onChange={(e) =>
                            updateProject(selectedProject.id, {
                              pipelineId: e.target.value,
                            })
                          }
                          className="select"
                        >
                          {pipelines.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1.5">
                          级别
                        </label>
                        <select
                          value={selectedProject.level}
                          onChange={(e) =>
                            updateProject(selectedProject.id, {
                              level: e.target.value as Project['level'],
                            })
                          }
                          className="select"
                        >
                          {levels.map((l) => (
                            <option key={l} value={l}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1.5">
                          分类
                        </label>
                        <select
                          value={selectedProject.category}
                          onChange={(e) =>
                            updateProject(selectedProject.id, {
                              category: e.target.value,
                            })
                          }
                          className="select"
                        >
                          {categories.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1.5">
                          开始时间
                        </label>
                        <input
                          type="date"
                          value={selectedProject.startDate || ''}
                          onChange={(e) =>
                            updateProject(selectedProject.id, {
                              startDate: e.target.value,
                            })
                          }
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1.5">
                          预期上线时间
                        </label>
                        <input
                          type="date"
                          value={selectedProject.deadline || ''}
                          onChange={(e) =>
                            updateProject(selectedProject.id, {
                              deadline: e.target.value,
                            })
                          }
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1.5">
                          负责人
                        </label>
                        <input
                          type="text"
                          value={selectedProject.manager || ''}
                          onChange={(e) =>
                            updateProject(selectedProject.id, {
                              manager: e.target.value,
                            })
                          }
                          className="input"
                          placeholder="请输入负责人"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1.5">
                          状态
                        </label>
                        <select
                          value={selectedProject.status}
                          onChange={(e) =>
                            updateProject(selectedProject.id, {
                              status: e.target.value as Project['status'],
                            })
                          }
                          className="select"
                        >
                          <option value="not_started">未开始</option>
                          <option value="in_progress">进行中</option>
                          <option value="delayed">已延期</option>
                          <option value="completed">已完成</option>
                        </select>
                      </div>
                    </div>

                    {/* Phases */}
                    <div>
                      <h3 className="text-sm font-medium text-text-primary mb-3">
                        环节配置
                      </h3>
                      <div className="space-y-2">
                        {selectedProject.phases.map((phase, index) => (
                          <div
                            key={phase.id}
                            className="flex items-center gap-3 p-3 bg-canvas rounded-lg"
                          >
                            <span className="text-sm text-text-muted w-6">
                              {index + 1}
                            </span>
                            <span className="text-sm font-medium text-text-primary w-24">
                              {phase.name}
                            </span>
                            <span className="text-sm text-text-secondary">
                              {phase.manDays} 天
                            </span>
                            <input
                              type="date"
                              value={phase.startDate || ''}
                              onChange={(e) =>
                                updatePhase(selectedProject.id, phase.id, {
                                  startDate: e.target.value,
                                })
                              }
                              className="input w-36"
                            />
                            <span className="text-text-muted">-</span>
                            <input
                              type="date"
                              value={phase.endDate || ''}
                              onChange={(e) =>
                                updatePhase(selectedProject.id, phase.id, {
                                  endDate: e.target.value,
                                })
                              }
                              className="input w-36"
                            />
                            <select
                              value={phase.status || 'not_started'}
                              onChange={(e) =>
                                updatePhase(selectedProject.id, phase.id, {
                                  status: e.target.value as Phase['status'],
                                })
                              }
                              className="select w-28"
                            >
                              <option value="not_started">未开始</option>
                              <option value="in_progress">进行中</option>
                              <option value="completed">已完成</option>
                              <option value="overdue">逾期</option>
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'dependency' && (
                  <div className="max-w-2xl">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-text-primary">
                        依赖配置
                      </h3>
                      <button
                        onClick={() => setShowDepModal(true)}
                        className="btn btn-primary text-sm py-1"
                      >
                        <Plus size={14} />
                        新增依赖
                      </button>
                    </div>

                    {selectedProject.dependencies.length > 0 ? (
                      <div className="space-y-3">
                        {selectedProject.dependencies.map((dep) => {
                          const sourceProject = projects.find(
                            (p) => p.id === dep.sourceProjectId
                          );
                          const sourcePhase = sourceProject?.phases.find(
                            (p) => p.id === dep.sourcePhaseId
                          );

                          return (
                            <div
                              key={dep.id}
                              className="p-4 bg-canvas rounded-lg flex items-center justify-between"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-text-primary">
                                    {sourceProject?.name}
                                  </span>
                                  <ArrowRight size={14} className="text-text-muted" />
                                  <span className="text-sm text-text-secondary">
                                    {sourcePhase?.name}
                                  </span>
                                </div>
                                <span className="badge badge-blue">
                                  {dependencyTypeLabels[dep.type]}
                                </span>
                                {dep.lagDays && dep.lagDays > 0 && (
                                  <span className="text-xs text-text-muted">
                                    滞后 {dep.lagDays} 天
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => deleteDependency(dep.id)}
                                className="p-1 hover:bg-status-error/10 rounded text-text-muted hover:text-status-error"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Link2 size={48} className="mx-auto text-text-muted mb-3 opacity-50" />
                        <p className="text-sm text-text-secondary mb-2">
                          暂无依赖关系
                        </p>
                        <p className="text-xs text-text-muted">
                          点击「新增依赖」开始配置
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'preview' && (
                  <div>
                    <h3 className="text-sm font-medium text-text-primary mb-4">
                      甘特图预览
                    </h3>
                    <div className="bg-canvas rounded-lg p-4 overflow-x-auto">
                      <div className="min-w-[600px]">
                        {selectedProject.phases.map((phase, index) => (
                          <div
                            key={phase.id}
                            className="flex items-center h-10 border-b border-border last:border-b-0"
                          >
                            <div className="w-32 text-sm text-text-primary">
                              {phase.name}
                            </div>
                            <div className="flex-1 relative h-6 bg-white rounded">
                              {phase.startDate && phase.endDate && (
                                <div
                                  className="absolute h-full rounded bg-primary/80 flex items-center px-2 text-xs text-white"
                                  style={{
                                    left: `${(new Date(phase.startDate).getTime() - new Date(selectedProject.startDate || phase.startDate).getTime()) / (new Date(selectedProject.deadline || phase.endDate).getTime() - new Date(selectedProject.startDate || phase.startDate).getTime()) * 100}%`,
                                    width: `${(new Date(phase.endDate).getTime() - new Date(phase.startDate).getTime()) / (new Date(selectedProject.deadline || phase.endDate).getTime() - new Date(selectedProject.startDate || phase.startDate).getTime()) * 100}%`,
                                  }}
                                >
                                  {phase.startDate} - {phase.endDate}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Users size={48} className="mx-auto text-text-muted mb-3 opacity-50" />
                <p className="text-sm text-text-secondary">
                  请从左侧选择一个项目
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Project Modal */}
      {showModal && editingProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[600px] max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">新建需求</h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingProject(null);
                }}
                className="p-1 hover:bg-canvas rounded"
              >
                <X size={18} className="text-text-muted" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  项目名称 <span className="text-status-error">*</span>
                </label>
                <input
                  type="text"
                  value={editingProject.name || ''}
                  onChange={(e) =>
                    setEditingProject({ ...editingProject, name: e.target.value })
                  }
                  className="input"
                  placeholder="请输入项目名称"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">
                    所属管线 <span className="text-status-error">*</span>
                  </label>
                  <select
                    value={editingProject.pipelineId || ''}
                    onChange={(e) =>
                      setEditingProject({ ...editingProject, pipelineId: e.target.value })
                    }
                    className="select"
                  >
                    {pipelines.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">
                    关联范式
                  </label>
                  <select
                    value={editingProject.paradigmId || ''}
                    onChange={(e) => handleParadigmChange(e.target.value)}
                    className="select"
                  >
                    <option value="">选择范式模板</option>
                    {paradigms.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">
                    级别
                  </label>
                  <select
                    value={editingProject.level || 'P2'}
                    onChange={(e) =>
                      setEditingProject({
                        ...editingProject,
                        level: e.target.value as Project['level'],
                      })
                    }
                    className="select"
                  >
                    {levels.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">
                    分类
                  </label>
                  <select
                    value={editingProject.category || ''}
                    onChange={(e) =>
                      setEditingProject({ ...editingProject, category: e.target.value })
                    }
                    className="select"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">
                    预期上线时间 (DDL) <span className="text-status-error">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={editingProject.deadline || ''}
                      onChange={(e) => handleDeadlineChange(e.target.value)}
                      className="input flex-1"
                    />
                    <button
                      onClick={() => {
                        if (editingProject.deadline) {
                          handleDeadlineChange(editingProject.deadline);
                        }
                      }}
                      disabled={!editingProject.deadline || !selectedParadigm}
                      className="btn btn-secondary whitespace-nowrap"
                      title="重新计算环节日期"
                    >
                      <Calculator size={14} />
                      重算
                    </button>
                  </div>
                  {!editingProject.deadline && selectedParadigm && (
                    <p className="text-xs text-status-warning mt-1">
                      请输入截止日期以计算环节起止时间
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">
                    开始时间（计算得出）
                  </label>
                  <input
                    type="text"
                    value={editingProject.startDate || '输入截止日期后自动计算'}
                    readOnly
                    className="input bg-gray-50 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">
                    负责人
                  </label>
                  <input
                    type="text"
                    value={editingProject.manager || ''}
                    onChange={(e) =>
                      setEditingProject({ ...editingProject, manager: e.target.value })
                    }
                    className="input"
                    placeholder="请输入负责人"
                  />
                </div>
              </div>

              {editingProject.phases && editingProject.phases.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-text-primary">
                      环节排期
                    </label>
                    {editingProject.startDate && editingProject.deadline && (
                      <span className="text-xs text-primary font-medium">
                        {editingProject.startDate} 至 {editingProject.deadline}
                        （共 {differenceInDays(parseISO(editingProject.deadline), parseISO(editingProject.startDate)) + 1} 天）
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {editingProject.phases.map((phase, index) => {
                      const depPhase = selectedParadigm?.phases.find(p => 
                        phase.dependencies?.[0]?.phaseId === p.id
                      );
                      const dep = phase.dependencies?.[0];
                      const hasDates = phase.startDate && phase.endDate;
                      
                      return (
                        <div
                          key={phase.id}
                          className={`flex items-center gap-3 p-2 rounded ${
                            hasDates ? 'bg-canvas' : 'bg-status-warning/10 border border-status-warning/30'
                          }`}
                        >
                          <span className="text-sm text-text-muted w-6">{index + 1}.</span>
                          <span className="text-sm font-medium text-text-primary w-20 truncate">
                            {phase.name}
                          </span>
                          <span className="text-sm text-text-secondary">{phase.manDays}天</span>
                          {hasDates ? (
                            <span className="text-xs text-primary font-medium">
                              {phase.startDate} - {phase.endDate}
                            </span>
                          ) : (
                            <span className="text-xs text-status-warning">
                              需输入截止日期计算
                            </span>
                          )}
                          {dep && depPhase && (
                            <span className="text-xs text-text-muted flex items-center gap-1 ml-auto">
                              <ArrowRight size={10} />
                              依赖{depPhase.name}
                              {dep.type === 'FS_PERCENT' && ` ${dep.percentage}%`}
                              {dep.type === 'FS_OFFSET' && ` +${dep.offsetDays}天`}
                              {dep.type === 'SS_OFFSET' && ` +${dep.offsetDays}天`}
                              {dep.type === 'SS_PARALLEL' && ' 并行'}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingProject(null);
                }}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleSaveProject}
                disabled={!editingProject.name || !editingProject.deadline}
                className="btn btn-primary"
                title={!editingProject.deadline ? '请先输入截止日期' : ''}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Dependency Modal */}
      {showDepModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[480px]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">新增依赖</h2>
              <button
                onClick={() => {
                  setShowDepModal(false);
                  setNewDep({});
                  setDepError(null);
                }}
                className="p-1 hover:bg-canvas rounded"
              >
                <X size={18} className="text-text-muted" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  被依赖项目 <span className="text-status-error">*</span>
                </label>
                <select
                  value={newDep.sourceProjectId || ''}
                  onChange={(e) => {
                    const project = projects.find((p) => p.id === e.target.value);
                    setNewDep({
                      ...newDep,
                      sourceProjectId: e.target.value,
                      sourcePhaseId: '',
                    });
                  }}
                  className="select"
                >
                  <option value="">选择项目</option>
                  {projects
                    .filter((p) => p.id !== selectedProjectId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  被依赖环节 <span className="text-status-error">*</span>
                </label>
                <select
                  value={newDep.sourcePhaseId || ''}
                  onChange={(e) =>
                    setNewDep({ ...newDep, sourcePhaseId: e.target.value })
                  }
                  className="select"
                  disabled={!newDep.sourceProjectId}
                >
                  <option value="">选择环节</option>
                  {projects
                    .find((p) => p.id === newDep.sourceProjectId)
                    ?.phases.filter((ph) => ph.canBeDependent)
                    .map((ph) => (
                      <option key={ph.id} value={ph.id}>
                        {ph.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  依赖本项目环节 <span className="text-status-error">*</span>
                </label>
                <select
                  value={newDep.targetPhaseId || ''}
                  onChange={(e) =>
                    setNewDep({ ...newDep, targetPhaseId: e.target.value })
                  }
                  className="select"
                >
                  <option value="">选择环节</option>
                  {selectedProject?.phases.map((ph) => (
                    <option key={ph.id} value={ph.id}>
                      {ph.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  依赖类型
                </label>
                <div className="flex gap-2">
                  {(['FS', 'SS', 'FF'] as DependencyType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setNewDep({ ...newDep, type })}
                      className={`flex-1 py-2 rounded border text-sm font-medium transition-colors ${
                        newDep.type === type
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-text-secondary hover:border-primary'
                      }`}
                    >
                      {dependencyTypeLabels[type]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  滞后天数
                </label>
                <input
                  type="number"
                  value={newDep.lagDays || 0}
                  onChange={(e) =>
                    setNewDep({ ...newDep, lagDays: parseInt(e.target.value) || 0 })
                  }
                  className="input"
                  min="0"
                />
              </div>

              {depError && (
                <div className="flex items-center gap-2 p-3 rounded bg-status-error/10 text-status-error text-sm">
                  <AlertTriangle size={16} />
                  {depError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button
                onClick={() => {
                  setShowDepModal(false);
                  setNewDep({});
                  setDepError(null);
                }}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button onClick={handleAddDependency} className="btn btn-primary">
                确认创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
