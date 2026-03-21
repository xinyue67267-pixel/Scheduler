const STORAGE_PREFIX = 'scheduler_user_';

export function getUserDataKey(uid: string): string {
  return `${STORAGE_PREFIX}${uid}_data`;
}

export function getDefaultData() {
  return {
    pipelines: [
      { id: '1', name: '支付管线', color: '#0052D9', leader: '张明' },
      { id: '2', name: '用户中心', color: '#00A870', leader: '李华' },
      { id: '3', name: '商品管线', color: '#ED7B2F', leader: '王芳' },
      { id: '4', name: '订单管线', color: '#8B5CF6', leader: '赵强' },
      { id: '5', name: '营销管线', color: '#FF6B6B', leader: '陈静' },
    ],
    paradigms: [
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
        usageCount: 0,
        lastModified: new Date().toISOString().split('T')[0],
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
        usageCount: 0,
        lastModified: new Date().toISOString().split('T')[0],
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
        usageCount: 0,
        lastModified: new Date().toISOString().split('T')[0],
      },
    ],
    projects: [],
    workCalendars: [],
    holidays: [
      { id: '1', name: '元旦', startDate: '2026-01-01', endDate: '2026-01-01', type: 'holiday', repeatYearly: true },
      { id: '2', name: '春节', startDate: '2026-01-27', endDate: '2026-02-02', type: 'holiday', repeatYearly: false, description: '春节假期7天' },
      { id: '3', name: '清明节', startDate: '2026-04-04', endDate: '2026-04-06', type: 'holiday', repeatYearly: true },
      { id: '4', name: '劳动节', startDate: '2026-05-01', endDate: '2026-05-05', type: 'holiday', repeatYearly: true },
      { id: '5', name: '国庆节', startDate: '2026-10-01', endDate: '2026-10-07', type: 'holiday', repeatYearly: true, description: '国庆黄金周假期' },
    ],
    fields: [],
    categories: ['研发', '营销', '运维', '数据分析'],
    levels: ['P0', 'P1', 'P2', 'P3'],
    roles: ['产品经理', '设计师', '前端开发', '后端开发', '测试工程师', '运维工程师'],
    notifications: [],
  };
}

export function loadUserData(uid: string): ReturnType<typeof getDefaultData> | null {
  try {
    const key = getUserDataKey(uid);
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load user data:', e);
  }
  return null;
}

export function saveUserData(uid: string, data: ReturnType<typeof getDefaultData>): void {
  try {
    const key = getUserDataKey(uid);
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save user data:', e);
  }
}
