import { useState } from 'react';
import {
  FileText,
  Tag,
  List,
  Calendar,
  Layers,
  Plus,
  X,
  Edit2,
  Trash2,
  GripVertical,
  RotateCcw,
  Columns,
  AlertTriangle,
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
import { differenceInDays, parseISO, addDays, format } from 'date-fns';
import { useStore } from '@/store';
import type { Pipeline, Field, Holiday, Level, ViewMode } from '@/types';
import { COLUMN_WIDTH_LIMITS, DEFAULT_COLUMN_WIDTHS } from '@/types';

type SettingsTab = 'fields' | 'phases' | 'options' | 'calendar' | 'pipelines' | 'timeline';

const tabs = [
  { id: 'fields' as const, label: '字段管理', icon: FileText },
  { id: 'phases' as const, label: '环节库', icon: Tag },
  { id: 'options' as const, label: '选项管理', icon: List },
  { id: 'calendar' as const, label: '工作日历', icon: Calendar },
  { id: 'pipelines' as const, label: '管线管理', icon: Layers },
  { id: 'timeline' as const, label: '时间轴设置', icon: Columns },
];

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
}

function SortableItem({ id, children }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-border rounded"
      >
        <GripVertical size={16} className="text-text-muted" />
      </button>
      {children}
    </div>
  );
}

export default function Settings() {
  const {
    pipelines,
    fields,
    holidays,
    categories,
    levels,
    roles,
    addPipeline,
    updatePipeline,
    deletePipeline,
    addField,
    updateField,
    deleteField,
    reorderFields,
    addHoliday,
    updateHoliday,
    deleteHoliday,
    columnWidths,
    setColumnWidth,
    resetColumnWidths,
  } = useStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>('fields');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [newValue, setNewValue] = useState('');
  
  const [holidayForm, setHolidayForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    repeatYearly: false,
    description: '',
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const openModal = (type: string, item?: any) => {
    setModalType(type);
    setEditingItem(item || null);
    setNewValue(item?.name || item?.title || '');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalType(null);
    setEditingItem(null);
    setNewValue('');
  };

  const handleSave = () => {
    if (!newValue.trim()) return;

    switch (modalType) {
      case 'pipeline':
        if (editingItem) {
          updatePipeline(editingItem.id, { name: newValue });
        } else {
          addPipeline({
            id: `pipeline-${Date.now()}`,
            name: newValue,
            color: '#0052D9',
          });
        }
        break;
      case 'category':
        if (!categories.includes(newValue)) {
          useStore.setState({ categories: [...categories, newValue] });
        }
        break;
      case 'level':
        if (!levels.includes(newValue as Level)) {
          useStore.setState({ levels: [...levels, newValue as Level] });
        }
        break;
      case 'role':
        if (!roles.includes(newValue)) {
          useStore.setState({ roles: [...roles, newValue] });
        }
        break;
      case 'phase':
        if (editingItem) {
          updateField(editingItem.id, { name: newValue });
        } else {
          addField({
            id: `field-${Date.now()}`,
            name: newValue,
            type: 'text',
            order: fields.length,
          });
        }
        break;
    }

    closeModal();
  };

  const handleDelete = (type: string, id: string) => {
    switch (type) {
      case 'pipeline':
        deletePipeline(id);
        break;
      case 'category':
        useStore.setState({
          categories: categories.filter((c) => c !== id),
        });
        break;
      case 'level':
        useStore.setState({
          levels: levels.filter((l) => l !== id),
        });
        break;
      case 'role':
        useStore.setState({
          roles: roles.filter((r) => r !== id),
        });
        break;
      case 'phase':
        deleteField(id);
        break;
      case 'holiday':
        deleteHoliday(id);
        break;
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((f) => f.id === active.id);
      const newIndex = fields.findIndex((f) => f.id === over.id);
      const newFields = arrayMove(fields, oldIndex, newIndex).map((f, i) => ({
        ...f,
        order: i,
      }));
      reorderFields(newFields);
    }
  };

  const pipelineColors = [
    '#0052D9',
    '#00A870',
    '#ED7B2F',
    '#8B5CF6',
    '#FF6B6B',
    '#14B8A6',
    '#F59E0B',
    '#EC4899',
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold text-text-primary">设置</h1>
      </header>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Tabs */}
        <div className="w-48 flex-shrink-0 bg-white border-r border-border py-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full px-4 py-2.5 flex items-center gap-2 text-left transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary/10 text-primary border-l-2 border-primary'
                    : 'text-text-secondary hover:bg-canvas/50 border-l-2 border-transparent'
                }`}
              >
                <Icon size={18} />
                <span className="text-sm">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Panel */}
        <div className="flex-1 overflow-auto p-6 scrollbar-thin bg-canvas">
          {activeTab === 'fields' && (
            <div className="max-w-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-medium text-text-primary">字段管理</h2>
                <button
                  onClick={() => openModal('phase')}
                  className="btn btn-primary text-sm"
                >
                  <Plus size={14} />
                  新增字段
                </button>
              </div>

              <div className="card">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={fields.map((f) => f.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="divide-y divide-border">
                      {fields.length > 0 ? (
                        fields.map((field) => (
                          <div
                            key={field.id}
                            className="flex items-center justify-between px-4 py-3"
                          >
                            <SortableItem id={field.id}>
                              <span className="text-sm font-medium text-text-primary">
                                {field.name}
                              </span>
                              <span className="badge badge-blue ml-2">{field.type}</span>
                              {field.required && (
                                <span className="text-xs text-status-error ml-1">*</span>
                              )}
                            </SortableItem>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openModal('phase', field)}
                                className="p-1.5 hover:bg-canvas rounded text-text-muted hover:text-text-primary"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete('phase', field.id)}
                                className="p-1.5 hover:bg-status-error/10 rounded text-text-muted hover:text-status-error"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-8 text-center text-sm text-text-muted">
                          暂无自定义字段
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          )}

          {activeTab === 'phases' && (
            <div className="max-w-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-medium text-text-primary">环节库</h2>
                <button
                  onClick={() => openModal('phase')}
                  className="btn btn-primary text-sm"
                >
                  <Plus size={14} />
                  新增环节
                </button>
              </div>

              <div className="card p-4">
                <div className="flex flex-wrap gap-2">
                  {fields.map((field) => (
                    <span
                      key={field.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-canvas rounded-full text-sm"
                    >
                      {field.name}
                      <button
                        onClick={() => handleDelete('phase', field.id)}
                        className="ml-1 text-text-muted hover:text-status-error"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                  {fields.length === 0 && (
                    <span className="text-sm text-text-muted">暂无预设环节</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'options' && (
            <div className="max-w-2xl space-y-6">
              {/* Categories */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-medium text-text-primary">分类管理</h2>
                  <button
                    onClick={() => openModal('category')}
                    className="btn btn-secondary text-sm py-1"
                  >
                    <Plus size={14} />
                    新增
                  </button>
                </div>
                <div className="card p-4">
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                      <span
                        key={cat}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-canvas rounded-full text-sm"
                      >
                        {cat}
                        <button
                          onClick={() => handleDelete('category', cat)}
                          className="ml-1 text-text-muted hover:text-status-error"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Levels */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-medium text-text-primary">级别管理</h2>
                  <button
                    onClick={() => openModal('level')}
                    className="btn btn-secondary text-sm py-1"
                  >
                    <Plus size={14} />
                    新增
                  </button>
                </div>
                <div className="card p-4">
                  <div className="flex flex-wrap gap-2">
                    {levels.map((level) => (
                      <span
                        key={level}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-canvas rounded-full text-sm"
                      >
                        {level}
                        <button
                          onClick={() => handleDelete('level', level)}
                          className="ml-1 text-text-muted hover:text-status-error"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Roles */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-medium text-text-primary">角色管理</h2>
                  <button
                    onClick={() => openModal('role')}
                    className="btn btn-secondary text-sm py-1"
                  >
                    <Plus size={14} />
                    新增
                  </button>
                </div>
                <div className="card p-4">
                  <div className="flex flex-wrap gap-2">
                    {roles.map((role) => (
                      <span
                        key={role}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-canvas rounded-full text-sm"
                      >
                        {role}
                        <button
                          onClick={() => handleDelete('role', role)}
                          className="ml-1 text-text-muted hover:text-status-error"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="max-w-3xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-medium text-text-primary">节假日配置</h2>
                <button
                  onClick={() => {
                    setEditingItem(null);
                    setHolidayForm({
                      name: '',
                      startDate: '',
                      endDate: '',
                      repeatYearly: false,
                      description: '',
                    });
                    setShowModal(true);
                    setModalType('holiday-range');
                  }}
                  className="btn btn-primary text-sm"
                >
                  <Plus size={14} />
                  新增节假日
                </button>
              </div>

              <div className="card overflow-hidden">
                <table className="w-full">
                  <thead className="bg-canvas/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                        节假日名称
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                        日期范围
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                        天数
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                        每年重复
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                        说明
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {holidays.map((holiday) => {
                      const days = differenceInDays(parseISO(holiday.endDate), parseISO(holiday.startDate)) + 1;
                      return (
                        <tr key={holiday.id} className="hover:bg-canvas/50">
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium text-text-primary">
                              {holiday.name}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-text-secondary">
                              {holiday.startDate} ~ {holiday.endDate}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-text-secondary">
                              {days}天
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-text-muted">
                              {holiday.repeatYearly ? '是' : '否'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-text-muted">
                              {holiday.description || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleDelete('holiday', holiday.id)}
                                className="p-1.5 hover:bg-status-error/10 rounded text-text-muted hover:text-status-error"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {holidays.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-text-muted">
                    暂无节假日配置
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'pipelines' && (
            <div className="max-w-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-medium text-text-primary">管线管理</h2>
                <button
                  onClick={() => openModal('pipeline')}
                  className="btn btn-primary text-sm"
                >
                  <Plus size={14} />
                  新增管线
                </button>
              </div>

              <div className="card overflow-hidden">
                <table className="w-full">
                  <thead className="bg-canvas/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                        管线名称
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                        颜色
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                        负责人
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pipelines.map((pipeline) => (
                      <tr key={pipeline.id} className="hover:bg-canvas/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: pipeline.color }}
                            />
                            <span className="text-sm font-medium text-text-primary">
                              {pipeline.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {pipelineColors.map((color) => (
                              <button
                                key={color}
                                onClick={() =>
                                  updatePipeline(pipeline.id, { color })
                                }
                                className={`w-5 h-5 rounded ${
                                  pipeline.color === color
                                    ? 'ring-2 ring-offset-1 ring-primary'
                                    : ''
                                }`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-text-secondary">
                            {pipeline.leader || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openModal('pipeline', pipeline)}
                              className="p-1.5 hover:bg-canvas rounded text-text-muted hover:text-text-primary"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete('pipeline', pipeline.id)}
                              className="p-1.5 hover:bg-status-error/10 rounded text-text-muted hover:text-status-error"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 时间轴设置 */}
          {activeTab === 'timeline' && (
            <div className="max-w-2xl">
              <h2 className="text-base font-medium text-text-primary mb-4">时间轴设置</h2>
              
              <div className="card p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-text-primary mb-4">列宽设置</h3>
                  <div className="space-y-4">
                    {(['day', 'week', 'month'] as ViewMode[]).map((mode) => {
                      const limits = COLUMN_WIDTH_LIMITS[mode];
                      const modeLabel = mode === 'day' ? '日视图' : mode === 'week' ? '周视图' : '月视图';
                      return (
                        <div key={mode} className="flex items-center gap-4">
                          <span className="w-24 text-sm text-text-secondary">{modeLabel}</span>
                          <input
                            type="range"
                            min={limits.min}
                            max={limits.max}
                            value={columnWidths[mode]}
                            onChange={(e) => setColumnWidth(mode, parseInt(e.target.value))}
                            className="flex-1 h-2 bg-canvas rounded-lg appearance-none cursor-pointer"
                          />
                          <input
                            type="number"
                            min={limits.min}
                            max={limits.max}
                            value={columnWidths[mode]}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (val >= limits.min && val <= limits.max) {
                                setColumnWidth(mode, val);
                              }
                            }}
                            className="input w-20 text-center"
                          />
                          <span className="text-sm text-text-muted">px</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-border">
                  <button
                    onClick={resetColumnWidths}
                    className="btn btn-secondary"
                  >
                    <RotateCcw size={16} />
                    恢复默认
                  </button>
                  <span className="text-sm text-text-muted">
                    默认: 日视图80px / 周视图120px / 月视图160px
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[480px]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-text-primary">
                {modalType === 'pipeline' && (editingItem ? '编辑管线' : '新增管线')}
                {modalType === 'category' && '新增分类'}
                {modalType === 'level' && '新增级别'}
                {modalType === 'role' && '新增角色'}
                {modalType === 'phase' && (editingItem ? '编辑环节' : '新增环节')}
                {modalType === 'holiday-range' && '新增节假日'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1 hover:bg-canvas rounded transition-colors"
              >
                <X size={18} className="text-text-muted" />
              </button>
            </div>

            {modalType === 'holiday-range' ? (
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">
                    节假日名称 <span className="text-status-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={holidayForm.name}
                    onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                    className="input"
                    placeholder="如：国庆节"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1.5">
                      开始日期 <span className="text-status-error">*</span>
                    </label>
                    <input
                      type="date"
                      value={holidayForm.startDate}
                      onChange={(e) => setHolidayForm({ ...holidayForm, startDate: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1.5">
                      结束日期 <span className="text-status-error">*</span>
                    </label>
                    <input
                      type="date"
                      value={holidayForm.endDate}
                      onChange={(e) => setHolidayForm({ ...holidayForm, endDate: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>

                {holidayForm.startDate && holidayForm.endDate && (
                  <div className="p-3 bg-primary/5 rounded-lg">
                    <span className="text-sm text-primary">
                      共 {differenceInDays(parseISO(holidayForm.endDate), parseISO(holidayForm.startDate)) + 1} 天
                    </span>
                  </div>
                )}

                {holidayForm.endDate && holidayForm.startDate && 
                 holidayForm.endDate < holidayForm.startDate && (
                  <div className="flex items-center gap-2 p-3 bg-status-error/10 rounded-lg text-status-error text-sm">
                    <AlertTriangle size={16} />
                    结束日期不能早于开始日期
                  </div>
                )}

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={holidayForm.repeatYearly}
                    onChange={(e) => setHolidayForm({ ...holidayForm, repeatYearly: e.target.checked })}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-text-primary">每年重复（如春节）</span>
                </label>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">
                    说明（可选）
                  </label>
                  <input
                    type="text"
                    value={holidayForm.description}
                    onChange={(e) => setHolidayForm({ ...holidayForm, description: e.target.value })}
                    className="input"
                    placeholder="如：国庆黄金周假期"
                  />
                </div>
              </div>
            ) : (
              <div className="p-5">
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  名称 <span className="text-status-error">*</span>
                </label>
                <input
                  type="text"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="input"
                  placeholder="请输入名称"
                  autoFocus
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
              <button onClick={closeModal} className="btn btn-secondary">
                取消
              </button>
              {modalType === 'holiday-range' ? (
                <button
                  onClick={() => {
                    if (holidayForm.name && holidayForm.startDate && holidayForm.endDate && 
                        holidayForm.endDate >= holidayForm.startDate) {
                      addHoliday({
                        id: `holiday-${Date.now()}`,
                        name: holidayForm.name,
                        startDate: holidayForm.startDate,
                        endDate: holidayForm.endDate,
                        type: 'holiday',
                        repeatYearly: holidayForm.repeatYearly,
                        description: holidayForm.description,
                      });
                      closeModal();
                    }
                  }}
                  disabled={!holidayForm.name || !holidayForm.startDate || !holidayForm.endDate || 
                            holidayForm.endDate < holidayForm.startDate}
                  className="btn btn-primary"
                >
                  保存
                </button>
              ) : (
                <button onClick={handleSave} className="btn btn-primary">
                  保存
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
