import { useState } from 'react';
import { X, Download, Check, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useStore } from '@/store';
import { format } from 'date-fns';

interface ExportModalProps {
  onClose: () => void;
}

export default function ExportModal({ onClose }: ExportModalProps) {
  const { projects, pipelines, holidays, paradigms, exportConfig, setExportConfig } =
    useStore();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportSuccess, setExportSuccess] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);

    const workbook = XLSX.utils.book_new();

    // Project Summary Sheet
    if (exportConfig.sheets.summary) {
      setExportProgress(20);
      await new Promise((r) => setTimeout(r, 300));
      const summaryData = projects.map((p) => ({
        项目名称: p.name,
        管线: pipelines.find((pl) => pl.id === p.pipelineId)?.name || '',
        级别: p.level,
        分类: p.category,
        负责人: p.manager || '',
        开始时间: p.startDate || '',
        DDL: p.deadline || '',
        状态: p.status === 'not_started' ? '未开始' :
              p.status === 'in_progress' ? '进行中' :
              p.status === 'delayed' ? '已延期' : '已完成',
        依赖项目数: p.dependencies.filter((d) => d.sourceProjectId === p.id).length,
        被依赖项目数: p.dependencies.filter((d) => d.targetProjectId === p.id).length,
      }));
      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, '项目汇总');
    }

    // Phase Details Sheet
    if (exportConfig.sheets.phases) {
      setExportProgress(40);
      await new Promise((r) => setTimeout(r, 300));
      const phaseData: Record<string, string | number>[] = [];
      projects.forEach((p) => {
        p.phases.forEach((ph) => {
          phaseData.push({
            项目名称: p.name,
            环节名称: ph.name,
            计划开始: ph.startDate || '',
            计划结束: ph.endDate || '',
            实际开始: ph.actualStartDate || '',
            实际结束: ph.actualEndDate || '',
            参考人天: ph.manDays,
            负责人: ph.assignee || '',
            状态: ph.status === 'not_started' ? '未开始' :
                  ph.status === 'in_progress' ? '进行中' :
                  ph.status === 'completed' ? '已完成' : '逾期',
          });
        });
      });
      const phaseSheet = XLSX.utils.json_to_sheet(phaseData);
      XLSX.utils.book_append_sheet(workbook, phaseSheet, '环节明细');
    }

    // Dependencies Sheet
    if (exportConfig.sheets.dependencies) {
      setExportProgress(60);
      await new Promise((r) => setTimeout(r, 300));
      const depData: Record<string, string | number>[] = [];
      projects.forEach((p) => {
        p.dependencies.forEach((d) => {
          const sourceProject = projects.find((pr) => pr.id === d.sourceProjectId);
          const targetProject = projects.find((pr) => pr.id === d.targetProjectId);
          const sourcePhase = sourceProject?.phases.find((ph) => ph.id === d.sourcePhaseId);
          const targetPhase = targetProject?.phases.find((ph) => ph.id === d.targetPhaseId);

          if (sourceProject && targetProject && sourcePhase && targetPhase) {
            depData.push({
              源项目: sourceProject.name,
              源环节: sourcePhase.name,
              目标项目: targetProject.name,
              目标环节: targetPhase.name,
              依赖类型: d.type,
              滞后天数: d.lagDays || 0,
              状态: d.status === 'normal' ? '正常' :
                    d.status === 'blocked' ? '阻塞' : '已完成',
            });
          }
        });
      });
      const depSheet = XLSX.utils.json_to_sheet(depData);
      XLSX.utils.book_append_sheet(workbook, depSheet, '依赖关系');
    }

    // Holidays Sheet
    if (exportConfig.sheets.holidays) {
      setExportProgress(80);
      await new Promise((r) => setTimeout(r, 300));
      const holidayData = holidays.map((h) => ({
        节假日名称: h.name,
        日期: h.date,
        类型: h.type === 'holiday' ? '节假日' : '调休',
        每年重复: h.repeatYearly ? '是' : '否',
      }));
      const holidaySheet = XLSX.utils.json_to_sheet(holidayData);
      XLSX.utils.book_append_sheet(workbook, holidaySheet, '节假日配置');
    }

    setExportProgress(90);
    await new Promise((r) => setTimeout(r, 300));

    // Generate file
    const fileName = `甘特图_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    setExportProgress(100);
    setTimeout(() => {
      setIsExporting(false);
      setExportSuccess(true);
      setTimeout(onClose, 1500);
    }, 500);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[480px]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">导出甘特图</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-canvas rounded transition-colors"
          >
            <X size={18} className="text-text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Export Scope */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              导出范围
            </label>
            <div className="space-y-2">
              {[
                { value: 'all', label: '全部数据' },
                { value: 'pipeline', label: '选择管线' },
                { value: 'project', label: '选择项目' },
              ].map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="scope"
                    value={option.value}
                    checked={exportConfig.scope === option.value}
                    onChange={(e) =>
                      setExportConfig({ scope: e.target.value as typeof exportConfig.scope })
                    }
                    className="w-4 h-4 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-text-primary">{option.label}</span>
                </label>
              ))}
            </div>

            {exportConfig.scope === 'pipeline' && (
              <div className="mt-3 ml-6 space-y-2">
                {pipelines.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportConfig.pipelineIds?.includes(p.id)}
                      onChange={(e) => {
                        const ids = exportConfig.pipelineIds || [];
                        setExportConfig({
                          pipelineIds: e.target.checked
                            ? [...ids, p.id]
                            : ids.filter((i) => i !== p.id),
                        });
                      }}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="text-sm text-text-secondary">{p.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Export Content */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              导出内容
            </label>
            <div className="space-y-2">
              {[
                { key: 'summary', label: '项目汇总', desc: '包含项目基本信息、状态、依赖数量' },
                { key: 'phases', label: '环节明细', desc: '包含所有环节的起止时间、负责人、状态' },
                { key: 'dependencies', label: '依赖关系', desc: '包含依赖连线详情、类型、状态' },
                { key: 'holidays', label: '节假日配置', desc: '包含节假日和调休日期' },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-canvas/50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={exportConfig.sheets[item.key as keyof typeof exportConfig.sheets]}
                    onChange={(e) => {
                      setExportConfig({
                        sheets: {
                          ...exportConfig.sheets,
                          [item.key]: e.target.checked,
                        },
                      });
                    }}
                    className="w-4 h-4 mt-0.5 rounded border-border text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="text-sm font-medium text-text-primary">{item.label}</span>
                    <p className="text-xs text-text-muted mt-0.5">{item.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Progress */}
          {isExporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">正在生成导出文件...</span>
                <span className="text-primary font-medium">{exportProgress}%</span>
              </div>
              <div className="h-2 bg-canvas rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Success */}
          {exportSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-status-success/10 text-status-success">
              <Check size={18} />
              <span className="text-sm font-medium">导出成功！文件已开始下载</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="btn btn-secondary">
            取消
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="btn btn-primary"
          >
            {isExporting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                导出中...
              </>
            ) : (
              <>
                <Download size={16} />
                导出
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
