import { useState } from 'react';
import {
  Plus,
  Search,
  Download,
  Upload,
  MoreVertical,
  Edit2,
  Copy,
  Trash2,
  GripVertical,
  X,
  Clock,
  Grid3X3,
  List,
  LayoutGrid,
  ChevronDown,
  ChevronRight,
  Link2,
  AlertCircle,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useStore } from '@/store';
import type { Paradigm, PhaseTemplate, Level, PhaseDependency, PhaseDependencyType } from '@/types';
import { PHASE_DEPENDENCY_LABELS } from '@/types';

const levelColors: Record<Level, string> = {
  P0: '#E34D4D',
  P1: '#ED7B2F',
  P2: '#0052D9',
  P3: '#8A95A5',
};

const DEPENDENCY_TYPES: { value: PhaseDependencyType; label: string }[] = [
  { value: 'FS', label: '完成-开始 (FS)' },
  { value: 'FS_PERCENT', label: '百分比重叠 (FS-X%)' },
  { value: 'FS_OFFSET', label: '完成偏移 (FS+X天)' },
  { value: 'SS_OFFSET', label: '开始偏移 (SS+X天)' },
  { value: 'SS_PARALLEL', label: '并行 (SS-0%)' },
];

interface PhaseDependencyRowProps {
  dependency: PhaseDependency;
  phases: PhaseTemplate[];
  onUpdate: (dep: PhaseDependency) => void;
  onDelete: () => void;
  index: number;
}

function PhaseDependencyRow({ dependency, phases, onUpdate, onDelete, index }: PhaseDependencyRowProps) {
  const availablePhases = phases.filter(p => p.id !== dependency.phaseId);
  const depPhase = phases.find(p => p.id === dependency.phaseId);

  return (
    <div className="bg-white border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs text-text-secondary">
        <span className="font-medium">条件 {index + 1}</span>
        {depPhase && (
          <span className="text-primary">
            {depPhase.name} ({depPhase.manDays}天)
          </span>
        )}
      </div>
      
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs text-text-secondary mb-1">依赖环节</label>
          <select
            value={dependency.phaseId}
            onChange={(e) => onUpdate({ ...dependency, phaseId: e.target.value })}
            className="select w-full text-sm"
          >
            <option value="">选择环节</option>
            {availablePhases.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || `环节 ${p.id.slice(-4)}`}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-xs text-text-secondary mb-1">依赖类型</label>
          <select
            value={dependency.type}
            onChange={(e) => onUpdate({ ...dependency, type: e.target.value as PhaseDependencyType })}
            className="select w-full text-sm"
          >
            {DEPENDENCY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        
        {(dependency.type === 'FS_PERCENT') && (
          <div>
            <label className="block text-xs text-text-secondary mb-1">完成百分比</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={dependency.percentage || 50}
                onChange={(e) => onUpdate({ ...dependency, percentage: Math.min(100, Math.max(1, parseInt(e.target.value) || 50)) })}
                className="input w-full text-sm text-center"
                min="1"
                max="100"
              />
              <span className="text-sm text-text-muted">%</span>
            </div>
          </div>
        )}
        
        {(dependency.type === 'FS_OFFSET' || dependency.type === 'SS_OFFSET') && (
          <div>
            <label className="block text-xs text-text-secondary mb-1">偏移天数</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={dependency.offsetDays || 0}
                onChange={(e) => onUpdate({ ...dependency, offsetDays: Math.max(0, parseInt(e.target.value) || 0) })}
                className="input w-full text-sm text-center"
                min="0"
                max="365"
              />
              <span className="text-sm text-text-muted">天</span>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex justify-end">
        <button
          onClick={onDelete}
          className="text-xs text-status-error hover:underline"
        >
          删除依赖
        </button>
      </div>
    </div>
  );
}

interface SortablePhaseItemProps {
  phase: PhaseTemplate;
  phaseIndex: number;
  phases: PhaseTemplate[];
  onUpdate: (id: string, data: Partial<PhaseTemplate>) => void;
  onDelete: (id: string) => void;
  roles: string[];
}

function SortablePhaseItem({ phase, phaseIndex, phases, onUpdate, onDelete, roles }: SortablePhaseItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: phase.id,
  });

  const [showDependencies, setShowDependencies] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const addDependency = () => {
    const availablePhases = phases.filter(p => p.id !== phase.id);
    if (availablePhases.length === 0) return;
    
    const newDep: PhaseDependency = {
      phaseId: availablePhases[0].id,
      type: 'FS',
    };
    
    onUpdate(phase.id, {
      dependencies: [...(phase.dependencies || []), newDep]
    });
  };

  const updateDependency = (index: number, dep: PhaseDependency) => {
    const deps = [...(phase.dependencies || [])];
    deps[index] = dep;
    onUpdate(phase.id, { dependencies: deps });
  };

  const deleteDependency = (index: number) => {
    const deps = [...(phase.dependencies || [])];
    deps.splice(index, 1);
    onUpdate(phase.id, { dependencies: deps });
  };

  const hasDependencies = phase.dependencies && phase.dependencies.length > 0;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div
        ref={setNodeRef}
        style={style}
        className="flex flex-wrap items-center gap-2 p-3 bg-canvas"
      >
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-border rounded flex-shrink-0"
        >
          <GripVertical size={16} className="text-text-muted" />
        </button>

        <span className="text-xs text-text-muted flex-shrink-0">{phaseIndex + 1}.</span>

        <input
          type="text"
          value={phase.name}
          onChange={(e) => onUpdate(phase.id, { name: e.target.value })}
          className="input w-24 flex-shrink-0"
          placeholder="环节名"
        />

        <div className="flex items-center gap-1 flex-shrink-0">
          <input
            type="number"
            value={phase.manDays}
            onChange={(e) =>
              onUpdate(phase.id, { manDays: parseInt(e.target.value) || 0 })
            }
            className="input w-12 text-center"
            min="1"
          />
          <span className="text-xs text-text-muted">天</span>
        </div>

        <select
          value={phase.role || ''}
          onChange={(e) => onUpdate(phase.id, { role: e.target.value })}
          className="select w-20 flex-shrink-0"
        >
          <option value="">角色</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1 cursor-pointer flex-shrink-0">
          <input
            type="checkbox"
            checked={phase.isKeyNode}
            onChange={(e) =>
              onUpdate(phase.id, { isKeyNode: e.target.checked })
            }
            className="w-3 h-3 rounded border-border text-primary focus:ring-primary"
          />
          <span className="text-xs text-text-muted">关键</span>
        </label>

        <button
          onClick={() => setShowDependencies(!showDependencies)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors flex-shrink-0 ${
            hasDependencies 
              ? 'bg-blue-100 text-blue-700 border border-blue-300' 
              : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
          }`}
        >
          <Link2 size={12} />
          依赖设置
          {hasDependencies && <span className="bg-blue-600 text-white rounded px-1 text-[10px]">{phase.dependencies?.length}</span>}
        </button>

        <button
          onClick={() => onDelete(phase.id)}
          className="p-1 hover:bg-status-error/10 rounded text-text-muted hover:text-status-error transition-colors flex-shrink-0"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {showDependencies && (
        <div className="p-3 bg-white border-t border-border">
          {phaseIndex === 0 ? (
            <div className="flex items-center gap-2 text-sm text-text-muted py-2">
              <AlertCircle size={14} />
              首个环节，无需依赖（自动从项目开始日期计算）
            </div>
          ) : hasDependencies ? (
            <div className="space-y-2">
              <div className="text-xs text-text-secondary font-medium mb-2">
                依赖条件（满足所有条件后开始）：
              </div>
              {phase.dependencies?.map((dep, idx) => (
                <PhaseDependencyRow
                  key={idx}
                  dependency={dep}
                  phases={phases}
                  onUpdate={(d) => updateDependency(idx, d)}
                  onDelete={() => deleteDependency(idx)}
                  index={idx}
                />
              ))}
              <button
                onClick={addDependency}
                disabled={phases.length <= 1}
                className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={12} />
                添加依赖条件
              </button>
            </div>
          ) : (
            <div className="text-center py-3">
              <div className="text-xs text-text-muted mb-2">暂无依赖关系，将自动串行</div>
              <button
                onClick={addDependency}
                disabled={phases.length <= 1}
                className="btn btn-secondary text-xs py-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={12} />
                设置依赖
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Paradigm() {
  const { paradigms, pipelines, roles, categories, levels, addParadigm, updateParadigm, deleteParadigm } =
    useStore();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingParadigm, setEditingParadigm] = useState<Paradigm | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const filteredParadigms = paradigms.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalDays = editingParadigm?.phases.reduce((acc, p) => acc + p.manDays, 0) || 0;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && editingParadigm) {
      const oldIndex = editingParadigm.phases.findIndex((p) => p.id === active.id);
      const newIndex = editingParadigm.phases.findIndex((p) => p.id === over.id);
      const newPhases = arrayMove(editingParadigm.phases, oldIndex, newIndex);
      setEditingParadigm({ ...editingParadigm, phases: newPhases });
    }
  };

  const openModal = (paradigm?: Paradigm) => {
    if (paradigm) {
      setEditingParadigm({ ...paradigm });
    } else {
      setEditingParadigm({
        id: `new-${Date.now()}`,
        name: '',
        level: 'P2',
        category: categories[0] || '',
        phases: [
          { id: `p-${Date.now()}`, name: '', manDays: 1, canBeDependent: true, isKeyNode: false },
        ],
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingParadigm(null);
  };

  const handleSave = () => {
    if (!editingParadigm) return;

    if (editingParadigm.id.startsWith('new-')) {
      addParadigm({
        ...editingParadigm,
        id: `paradigm-${Date.now()}`,
        lastModified: new Date().toISOString().split('T')[0],
      });
    } else {
      updateParadigm(editingParadigm.id, editingParadigm);
    }
    closeModal();
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        '范式名称': '示例范式',
        '级别': 'P2',
        '分类': '研发',
        '默认管线': '支付管线',
        '环节1名称': '需求分析',
        '环节1人天': 3,
        '环节2名称': '开发',
        '环节2人天': 10,
        '环节3名称': '测试',
        '环节3人天': 5,
      },
    ];
    
    import('xlsx').then((XLSX) => {
      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '范式模板');
      XLSX.writeFile(wb, '范式导入模板.xlsx');
    });
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    import('xlsx').then((XLSX) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet);
          
          jsonData.forEach((row: any) => {
            const phases: PhaseTemplate[] = [];
            let phaseIndex = 1;
            while (row[`环节${phaseIndex}名称`]) {
              phases.push({
                id: `p-${Date.now()}-${phaseIndex}`,
                name: row[`环节${phaseIndex}名称`] || '',
                manDays: parseInt(row[`环节${phaseIndex}人天`]) || 1,
                canBeDependent: true,
                isKeyNode: false,
              });
              phaseIndex++;
            }

            addParadigm({
              id: `paradigm-${Date.now()}-${Math.random()}`,
              name: row['范式名称'] || '未命名',
              level: (row['级别'] as Level) || 'P2',
              category: row['分类'] || '研发',
              phases,
              lastModified: new Date().toISOString().split('T')[0],
            });
          });
          
          alert('导入成功！');
        } catch (error) {
          alert('导入失败，请检查文件格式');
        }
      };
      reader.readAsArrayBuffer(file);
    });

    e.target.value = '';
  };

  const updateEditingField = (field: string, value: string) => {
    if (!editingParadigm) return;
    setEditingParadigm({ ...editingParadigm, [field]: value });
  };

  const updatePhase = (id: string, data: Partial<PhaseTemplate>) => {
    if (!editingParadigm) return;
    setEditingParadigm({
      ...editingParadigm,
      phases: editingParadigm.phases.map((p) =>
        p.id === id ? { ...p, ...data } : p
      ),
    });
  };

  const deletePhase = (id: string) => {
    if (!editingParadigm) return;
    setEditingParadigm({
      ...editingParadigm,
      phases: editingParadigm.phases.filter((p) => p.id !== id),
    });
  };

  const addPhase = () => {
    if (!editingParadigm) return;
    setEditingParadigm({
      ...editingParadigm,
      phases: [
        ...editingParadigm.phases,
        { id: `p-${Date.now()}`, name: '', manDays: 1, canBeDependent: true, isKeyNode: false },
      ],
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-text-primary">开发范式</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                type="text"
                placeholder="搜索范式..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input w-64 pl-9"
              />
            </div>
            <input
              type="file"
              id="import-file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileImport}
            />
            <button 
              onClick={() => document.getElementById('import-file')?.click()} 
              className="btn btn-secondary"
            >
              <Upload size={16} />
              批量导入
            </button>
            <button onClick={downloadTemplate} className="btn btn-secondary">
              <Download size={16} />
              下载模板
            </button>
            <button onClick={() => openModal()} className="btn btn-primary">
              <Plus size={16} />
              新建范式
            </button>
          </div>
        </div>
      </header>

      {/* View Toggle */}
      <div className="flex-shrink-0 bg-white border-b border-border px-6 py-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">
            共 {filteredParadigms.length} 个范式模板
          </span>
          <div className="flex items-center gap-1 bg-canvas rounded p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white shadow-sm text-primary'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Grid3X3 size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-white shadow-sm text-primary'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 scrollbar-thin bg-canvas">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredParadigms.map((paradigm) => {
              const pipeline = pipelines.find((p) => p.id === paradigm.defaultPipeline);
              const totalDays = paradigm.phases.reduce((acc, p) => acc + p.manDays, 0);

              return (
                <div
                  key={paradigm.id}
                  className="card-hover p-0 overflow-hidden"
                >
                  {/* Color Bar */}
                  <div
                    className="h-1"
                    style={{ backgroundColor: pipeline?.color || '#0052D9' }}
                  />

                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-medium text-text-primary truncate">
                          {paradigm.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-2">
                          <span
                            className="badge"
                            style={{
                              backgroundColor: `${levelColors[paradigm.level]}20`,
                              color: levelColors[paradigm.level],
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: levelColors[paradigm.level] }}
                            />
                            {paradigm.level}
                          </span>
                          <span className="badge badge-blue">{paradigm.category}</span>
                        </div>
                      </div>
                      <div className="relative">
                        <button
                          onClick={() =>
                            setActiveMenu(activeMenu === paradigm.id ? null : paradigm.id)
                          }
                          className="p-1 hover:bg-canvas rounded"
                        >
                          <MoreVertical size={16} className="text-text-muted" />
                        </button>
                        {activeMenu === paradigm.id && (
                          <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-lg border border-border z-10">
                            <button
                              onClick={() => {
                                openModal(paradigm);
                                setActiveMenu(null);
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-canvas flex items-center gap-2"
                            >
                              <Edit2 size={14} />
                              编辑
                            </button>
                            <button className="w-full px-3 py-2 text-left text-sm hover:bg-canvas flex items-center gap-2">
                              <Copy size={14} />
                              复制
                            </button>
                            <button
                              onClick={() => {
                                deleteParadigm(paradigm.id);
                                setActiveMenu(null);
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-status-error/10 text-status-error flex items-center gap-2"
                            >
                              <Trash2 size={14} />
                              删除
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Phase Preview */}
                    <div className="flex items-center gap-1 mt-4">
                      {paradigm.phases.slice(0, 5).map((p, i) => (
                        <div
                          key={p.id}
                          className="w-2 h-2 rounded-full"
                          style={{
                            backgroundColor: p.isKeyNode
                              ? '#FFD700'
                              : '#8A95A5',
                            opacity: 0.5 + i * 0.1,
                          }}
                          title={p.name}
                        />
                      ))}
                      {paradigm.phases.length > 5 && (
                        <span className="text-xs text-text-muted ml-1">
                          +{paradigm.phases.length - 5}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                      <div className="flex items-center gap-1 text-sm text-text-secondary">
                        <Clock size={14} />
                        {totalDays}天
                      </div>
                      <span className="text-xs text-text-muted">
                        修改于 {paradigm.lastModified}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-canvas/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                    范式名称
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                    级别
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                    分类
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                    环节数
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                    总人天
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                    修改时间
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredParadigms.map((paradigm) => (
                  <tr key={paradigm.id} className="hover:bg-canvas/50">
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-text-primary">
                        {paradigm.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="badge"
                        style={{
                          backgroundColor: `${levelColors[paradigm.level]}20`,
                          color: levelColors[paradigm.level],
                        }}
                      >
                        {paradigm.level}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-text-secondary">
                        {paradigm.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-text-secondary">
                        {paradigm.phases.length} 个环节
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-text-secondary">
                        {paradigm.phases.reduce((acc, p) => acc + p.manDays, 0)} 天
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-text-muted">
                        {paradigm.lastModified}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openModal(paradigm)}
                          className="p-1.5 hover:bg-canvas rounded text-text-muted hover:text-text-primary"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button className="p-1.5 hover:bg-canvas rounded text-text-muted hover:text-text-primary">
                          <Copy size={16} />
                        </button>
                        <button
                          onClick={() => deleteParadigm(paradigm.id)}
                          className="p-1.5 hover:bg-status-error/10 rounded text-text-muted hover:text-status-error"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredParadigms.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64">
            <LayoutGrid size={48} className="text-text-muted mb-3 opacity-50" />
            <p className="text-sm text-text-secondary mb-2">暂无范式模板</p>
            <p className="text-xs text-text-muted">
              点击「新建范式」开始创建
            </p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && editingParadigm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[800px] max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">
                {editingParadigm.id.startsWith('new-') ? '新建范式模板' : '编辑范式模板'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1 hover:bg-canvas rounded transition-colors"
              >
                <X size={18} className="text-text-muted" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Left Column - Basic Info */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1.5">
                      范式名称 <span className="text-status-error">*</span>
                    </label>
                    <input
                      type="text"
                      value={editingParadigm.name}
                      onChange={(e) => updateEditingField('name', e.target.value)}
                      className="input"
                      placeholder="请输入范式名称"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1.5">
                      级别 <span className="text-status-error">*</span>
                    </label>
                    <select
                      value={editingParadigm.level}
                      onChange={(e) => updateEditingField('level', e.target.value)}
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
                      value={editingParadigm.category}
                      onChange={(e) => updateEditingField('category', e.target.value)}
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
                      默认管线
                    </label>
                    <select
                      value={editingParadigm.defaultPipeline || ''}
                      onChange={(e) =>
                        updateEditingField('defaultPipeline', e.target.value)
                      }
                      className="select"
                    >
                      <option value="">不指定</option>
                      {pipelines.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1.5">
                      描述
                    </label>
                    <textarea
                      value={editingParadigm.description || ''}
                      onChange={(e) =>
                        updateEditingField('description', e.target.value)
                      }
                      className="input h-24 resize-none"
                      placeholder="请输入范式描述"
                    />
                  </div>
                </div>

                {/* Right Column - Phases */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-text-primary">
                      环节列表
                    </label>
                    <button
                      onClick={addPhase}
                      className="btn btn-secondary text-xs py-1"
                    >
                      <Plus size={14} />
                      添加环节
                    </button>
                  </div>

                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={editingParadigm.phases.map((p) => p.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2 max-h-[450px] overflow-y-auto scrollbar-thin">
                        {editingParadigm.phases.map((phase, idx) => (
                          <SortablePhaseItem
                            key={phase.id}
                            phase={phase}
                            phaseIndex={idx}
                            phases={editingParadigm.phases}
                            onUpdate={updatePhase}
                            onDelete={deletePhase}
                            roles={roles}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>

                  <div className="mt-4 p-3 bg-primary/5 rounded-lg flex items-center justify-between">
                    <span className="text-sm text-text-secondary">总人天</span>
                    <span className="text-lg font-semibold text-primary">
                      {totalDays} 天
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={closeModal} className="btn btn-secondary">
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!editingParadigm.name}
                className="btn btn-primary"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
