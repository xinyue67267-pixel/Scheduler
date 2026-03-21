import { addDays, parseISO, differenceInDays, format, subDays } from 'date-fns';
import type { PhaseTemplate, Phase, PhaseDependency, Holiday } from '@/types';

export interface CalculatedPhase extends Phase {
  calculatedStart?: string;
  calculatedEnd?: string;
  overlapDays?: number;
  triggerPoint?: { date: string; percentage: number };
}

export function isWorkingDay(date: Date, holidays: Holiday[]): boolean {
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  
  const dateStr = format(date, 'yyyy-MM-dd');
  const isHoliday = holidays.some(
    (h) => h.type === 'holiday' && dateStr >= h.startDate && dateStr <= h.endDate
  );
  
  return !isHoliday;
}

export function skipToNextWorkingDay(date: Date, holidays: Holiday[]): Date {
  let result = new Date(date);
  while (!isWorkingDay(result, holidays)) {
    result = addDays(result, 1);
  }
  return result;
}

export function skipToPrevWorkingDay(date: Date, holidays: Holiday[]): Date {
  let result = new Date(date);
  while (!isWorkingDay(result, holidays)) {
    result = subDays(result, 1);
  }
  return result;
}

export function countWorkingDays(startDate: Date, endDate: Date, holidays: Holiday[]): number {
  let count = 0;
  let current = new Date(startDate);
  
  while (current <= endDate) {
    if (isWorkingDay(current, holidays)) {
      count++;
    }
    current = addDays(current, 1);
  }
  
  return count;
}

export function getNthWorkingDayBefore(date: Date, n: number, holidays: Holiday[]): Date {
  let result = new Date(date);
  let remaining = n;
  
  while (remaining > 0) {
    result = subDays(result, 1);
    if (isWorkingDay(result, holidays)) {
      remaining--;
    }
  }
  
  return result;
}

export function getNthWorkingDayAfter(date: Date, n: number, holidays: Holiday[]): Date {
  let result = new Date(date);
  let remaining = n;
  
  while (remaining > 0) {
    result = addDays(result, 1);
    if (isWorkingDay(result, holidays)) {
      remaining--;
    }
  }
  
  return result;
}

export function calculatePhaseStartWithDependencies(
  phase: PhaseTemplate,
  phaseIndex: number,
  allPhases: PhaseTemplate[],
  calculatedPhases: Map<string, CalculatedPhase>,
  holidays: Holiday[]
): Date | null {
  if (phaseIndex === 0 || !phase.dependencies || phase.dependencies.length === 0) {
    return null;
  }

  let latestStartDate: Date | null = null;

  for (const dep of phase.dependencies) {
    const depPhase = allPhases.find(p => p.id === dep.phaseId);
    const depCalculated = calculatedPhases.get(dep.phaseId);
    
    if (!depPhase || !depCalculated?.calculatedStart || !depCalculated?.calculatedEnd) {
      continue;
    }

    const depStart = parseISO(depCalculated.calculatedStart);
    const depEnd = parseISO(depCalculated.calculatedEnd);
    const depDuration = depPhase.manDays;

    let triggerDate: Date;

    switch (dep.type) {
      case 'FS':
        triggerDate = skipToNextWorkingDay(depEnd, holidays);
        break;
        
      case 'FS_PERCENT':
        const percent = dep.percentage || 50;
        const offsetDays = Math.floor(depDuration * (percent / 100));
        let current = new Date(depStart);
        let workedDays = 0;
        while (workedDays < offsetDays) {
          current = addDays(current, 1);
          if (isWorkingDay(current, holidays)) {
            workedDays++;
          }
        }
        triggerDate = current;
        break;
        
      case 'FS_OFFSET':
        const fsOffset = dep.offsetDays || 0;
        triggerDate = skipToNextWorkingDay(addDays(depEnd, fsOffset), holidays);
        break;
        
      case 'SS_OFFSET':
        const ssOffset = dep.offsetDays || 0;
        triggerDate = addDays(depStart, ssOffset);
        if (!isWorkingDay(triggerDate, holidays)) {
          triggerDate = skipToNextWorkingDay(triggerDate, holidays);
        }
        break;
        
      case 'SS_PARALLEL':
        triggerDate = depStart;
        break;
        
      default:
        triggerDate = skipToNextWorkingDay(depEnd, holidays);
    }

    if (!latestStartDate || triggerDate > latestStartDate) {
      latestStartDate = triggerDate;
    }
  }

  return latestStartDate;
}

export function calculatePhaseEndDate(
  startDate: Date,
  manDays: number,
  holidays: Holiday[]
): Date {
  let currentDate = new Date(startDate);
  let remainingDays = manDays;

  while (remainingDays > 0) {
    currentDate = addDays(currentDate, 1);
    if (isWorkingDay(currentDate, holidays)) {
      remainingDays--;
    }
  }

  return currentDate;
}

export function calculatePhaseStartDate(
  endDate: Date,
  manDays: number,
  holidays: Holiday[]
): Date {
  let startDate = getNthWorkingDayBefore(endDate, manDays - 1, holidays);
  return skipToPrevWorkingDay(startDate, holidays);
}

export function calculatePhaseStartWithBackwardDependencies(
  phase: PhaseTemplate,
  phaseIndex: number,
  allPhases: PhaseTemplate[],
  calculatedPhases: Map<string, CalculatedPhase>,
  holidays: Holiday[]
): Date | null {
  if (!phase.dependencies || phase.dependencies.length === 0) {
    return null;
  }

  let latestStartDate: Date | null = null;

  for (const dep of phase.dependencies) {
    const depPhase = allPhases.find(p => p.id === dep.phaseId);
    const depCalculated = calculatedPhases.get(dep.phaseId);
    
    if (!depPhase || !depCalculated?.calculatedStart || !depCalculated?.calculatedEnd) {
      continue;
    }

    const depStart = parseISO(depCalculated.calculatedStart);
    const depEnd = parseISO(depCalculated.calculatedEnd);
    const depDuration = depPhase.manDays;

    let triggerDate: Date;

    switch (dep.type) {
      case 'FS':
        triggerDate = skipToPrevWorkingDay(depEnd, holidays);
        break;
        
      case 'FS_PERCENT':
        const percent = dep.percentage || 50;
        const workDaysBeforeTrigger = Math.floor(depDuration * (percent / 100));
        triggerDate = getNthWorkingDayBefore(depStart, depDuration - workDaysBeforeTrigger, holidays);
        break;
        
      case 'FS_OFFSET':
        const fsOffset = dep.offsetDays || 0;
        triggerDate = skipToPrevWorkingDay(subDays(depEnd, fsOffset), holidays);
        break;
        
      case 'SS_OFFSET':
        const ssOffset = dep.offsetDays || 0;
        triggerDate = subDays(depStart, ssOffset);
        if (!isWorkingDay(triggerDate, holidays)) {
          triggerDate = skipToPrevWorkingDay(triggerDate, holidays);
        }
        break;
        
      case 'SS_PARALLEL':
        triggerDate = depStart;
        break;
        
      default:
        triggerDate = skipToPrevWorkingDay(depEnd, holidays);
    }

    if (!latestStartDate || triggerDate < latestStartDate) {
      latestStartDate = triggerDate;
    }
  }

  return latestStartDate;
}

export function calculatePhasesWithDependencies(
  phases: PhaseTemplate[],
  startDate: Date,
  holidays: Holiday[]
): CalculatedPhase[] {
  const calculatedPhases = new Map<string, CalculatedPhase>();
  let currentDate = new Date(startDate);

  const result: CalculatedPhase[] = phases.map((phase, index) => {
    let phaseStart = new Date(currentDate);
    let triggerPoint: { date: string; percentage: number } | undefined;

    if (index > 0 && phase.dependencies && phase.dependencies.length > 0) {
      const depStart = calculatePhaseStartWithDependencies(
        phase,
        index,
        phases,
        calculatedPhases,
        holidays
      );

      if (depStart) {
        phaseStart = depStart;
        
        const dep = phase.dependencies[0];
        if (dep.type === 'FS_PERCENT' && dep.percentage) {
          triggerPoint = {
            date: format(phaseStart, 'yyyy-MM-dd'),
            percentage: dep.percentage
          };
        }
      }
    }

    if (!isWorkingDay(phaseStart, holidays)) {
      phaseStart = skipToNextWorkingDay(phaseStart, holidays);
    }

    const phaseEnd = calculatePhaseEndDate(phaseStart, phase.manDays, holidays);

    const calculated: CalculatedPhase = {
      ...phase,
      calculatedStart: format(phaseStart, 'yyyy-MM-dd'),
      calculatedEnd: format(phaseEnd, 'yyyy-MM-dd'),
      startDate: format(phaseStart, 'yyyy-MM-dd'),
      endDate: format(phaseEnd, 'yyyy-MM-dd'),
      triggerPoint,
    };

    calculatedPhases.set(phase.id, calculated);

    const hasOverlap = phase.dependencies?.some(d => 
      d.type === 'FS_PERCENT' || d.type === 'SS_PARALLEL'
    );
    
    if (hasOverlap && index > 0) {
      const prevPhase = calculatedPhases.get(phases[index - 1].id);
      if (prevPhase?.calculatedEnd) {
        const overlap = differenceInDays(phaseStart, parseISO(prevPhase.calculatedEnd));
        if (overlap > 0) {
          calculated.overlapDays = overlap;
        }
      }
    }

    currentDate = phaseEnd;

    return calculated;
  });

  return result;
}

export function calculatePhasesWithDependenciesBackward(
  phases: PhaseTemplate[],
  deadline: Date,
  holidays: Holiday[]
): CalculatedPhase[] {
  const calculatedPhases = new Map<string, CalculatedPhase>();
  let currentEndDate = new Date(deadline);

  const result: CalculatedPhase[] = [];

  for (let i = phases.length - 1; i >= 0; i--) {
    const phase = phases[i];
    
    let phaseEnd = new Date(currentEndDate);
    if (!isWorkingDay(phaseEnd, holidays)) {
      phaseEnd = skipToPrevWorkingDay(phaseEnd, holidays);
    }

    let phaseStart = calculatePhaseStartDate(phaseEnd, phase.manDays, holidays);

    if (phase.dependencies && phase.dependencies.length > 0) {
      const depStart = calculatePhaseStartWithBackwardDependencies(
        phase,
        i,
        phases,
        calculatedPhases,
        holidays
      );

      if (depStart && depStart < phaseStart) {
        phaseStart = depStart;
        phaseEnd = calculatePhaseEndDate(phaseStart, phase.manDays, holidays);
      }
    }

    const calculated: CalculatedPhase = {
      ...phase,
      calculatedStart: format(phaseStart, 'yyyy-MM-dd'),
      calculatedEnd: format(phaseEnd, 'yyyy-MM-dd'),
      startDate: format(phaseStart, 'yyyy-MM-dd'),
      endDate: format(phaseEnd, 'yyyy-MM-dd'),
    };

    calculatedPhases.set(phase.id, calculated);
    result.unshift(calculated);

    if (phase.dependencies && phase.dependencies.length > 0) {
      const earliestDepStart = calculatePhaseStartWithBackwardDependencies(
        phase,
        i,
        phases,
        calculatedPhases,
        holidays
      );
      if (earliestDepStart) {
        currentEndDate = subDays(earliestDepStart, 1);
      } else {
        currentEndDate = subDays(phaseStart, 1);
      }
    } else {
      currentEndDate = subDays(phaseStart, 1);
    }
  }

  return result;
}

export function detectCircularDependency(
  phases: PhaseTemplate[],
  phaseId: string,
  visited: Set<string> = new Set()
): boolean {
  if (visited.has(phaseId)) {
    return true;
  }
  
  visited.add(phaseId);
  
  const phase = phases.find(p => p.id === phaseId);
  if (!phase?.dependencies) {
    visited.delete(phaseId);
    return false;
  }

  for (const dep of phase.dependencies) {
    if (detectCircularDependency(phases, dep.phaseId, new Set(visited))) {
      return true;
    }
  }

  visited.delete(phaseId);
  return false;
}

export function validatePhaseDependencies(phases: PhaseTemplate[]): { valid: boolean; error?: string } {
  for (const phase of phases) {
    if (phase.dependencies) {
      for (const dep of phase.dependencies) {
        if (dep.phaseId === phase.id) {
          return { valid: false, error: `环节"${phase.name}"不能依赖自己` };
        }
        
        if (detectCircularDependency(phases, phase.id)) {
          return { valid: false, error: `检测到循环依赖，请调整环节顺序` };
        }
        
        if (dep.type === 'FS_PERCENT' && (dep.percentage || 0) < 1 || (dep.percentage || 0) > 100) {
          return { valid: false, error: `环节"${phase.name}"的百分比应在1-100之间` };
        }
        
        if ((dep.type === 'FS_OFFSET' || dep.type === 'SS_OFFSET') && (dep.offsetDays || 0) < 0) {
          return { valid: false, error: `环节"${phase.name}"的偏移天数不能为负数` };
        }
      }
    }
  }
  
  return { valid: true };
}
