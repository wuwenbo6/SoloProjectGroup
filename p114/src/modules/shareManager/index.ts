import type { SharedWork, Skeleton, RenderState, ShareConfig, Comment } from '../../types';

export class ShareManager {
  private works: Map<string, SharedWork> = new Map();
  private currentUserId: string;
  private currentUserName: string;

  constructor(userId: string, userName: string) {
    this.currentUserId = userId;
    this.currentUserName = userName;
    this.initializeSampleWorks();
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private initializeSampleWorks(): void {
    const sampleSkeleton1: Skeleton = {
      id: 'sample_1',
      name: '传统八角花灯',
      nodes: [],
      edges: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const sampleWork1: SharedWork = {
      id: this.generateId(),
      title: '传统八角花灯',
      description: '经典中国传统八角花灯，采用竹制骨架，纸质灯罩，寓意吉祥如意。适合春节、元宵节等传统节日悬挂。',
      authorId: 'system',
      authorName: '花灯大师',
      skeleton: sampleSkeleton1,
      likes: 128,
      views: 1024,
      tags: ['传统', '八角', '春节', '经典'],
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      isPublic: true,
      allowRemix: true,
      remixCount: 15,
    };

    const sampleSkeleton2: Skeleton = {
      id: 'sample_2',
      name: '现代简约花灯',
      nodes: [],
      edges: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const sampleWork2: SharedWork = {
      id: this.generateId(),
      title: '现代简约花灯',
      description: '融合现代设计理念的简约风格花灯，适合现代家居装饰。线条简洁，光影效果出众。',
      authorId: 'system',
      authorName: '设计师小明',
      skeleton: sampleSkeleton2,
      likes: 256,
      views: 2048,
      tags: ['现代', '简约', '家居', '设计'],
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      isPublic: true,
      allowRemix: true,
      remixCount: 32,
    };

    this.works.set(sampleWork1.id, sampleWork1);
    this.works.set(sampleWork2.id, sampleWork2);
  }

  publishWork(
    skeleton: Skeleton,
    config: ShareConfig,
    renderState?: RenderState
  ): SharedWork {
    const work: SharedWork = {
      id: this.generateId(),
      title: config.title,
      description: config.description,
      authorId: this.currentUserId,
      authorName: this.currentUserName,
      skeleton: JSON.parse(JSON.stringify(skeleton)),
      renderState: renderState ? JSON.parse(JSON.stringify(renderState)) : undefined,
      likes: 0,
      views: 0,
      tags: [...config.tags],
      createdAt: new Date(),
      isPublic: config.isPublic,
      allowRemix: config.allowRemix,
      remixCount: 0,
    };

    this.works.set(work.id, work);
    return work;
  }

  getWork(workId: string): SharedWork | undefined {
    const work = this.works.get(workId);
    if (work) {
      work.views++;
      return {
        ...work,
        skeleton: JSON.parse(JSON.stringify(work.skeleton)),
        renderState: work.renderState ? JSON.parse(JSON.stringify(work.renderState)) : undefined,
      };
    }
    return undefined;
  }

  getAllWorks(): SharedWork[] {
    return Array.from(this.works.values()).map(w => ({
      ...w,
      skeleton: { ...w.skeleton, nodes: [], edges: [] },
      renderState: undefined,
    }));
  }

  getPublicWorks(): SharedWork[] {
    return this.getAllWorks().filter(w => w.isPublic);
  }

  getUserWorks(userId?: string): SharedWork[] {
    const targetUserId = userId || this.currentUserId;
    return this.getAllWorks().filter(w => w.authorId === targetUserId);
  }

  updateWork(workId: string, updates: Partial<SharedWork>): boolean {
    const work = this.works.get(workId);
    if (!work || work.authorId !== this.currentUserId) return false;

    Object.assign(work, updates);
    return true;
  }

  deleteWork(workId: string): boolean {
    const work = this.works.get(workId);
    if (!work || work.authorId !== this.currentUserId) return false;
    return this.works.delete(workId);
  }

  likeWork(workId: string): boolean {
    const work = this.works.get(workId);
    if (!work) return false;
    work.likes++;
    return true;
  }

  unlikeWork(workId: string): boolean {
    const work = this.works.get(workId);
    if (!work || work.likes <= 0) return false;
    work.likes--;
    return true;
  }

  remixWork(workId: string, newTitle: string): SharedWork | null {
    const originalWork = this.works.get(workId);
    if (!originalWork || !originalWork.allowRemix) return null;

    const remixedWork: SharedWork = {
      id: this.generateId(),
      title: newTitle,
      description: `基于「${originalWork.title}」的改编作品\n\n${originalWork.description}`,
      authorId: this.currentUserId,
      authorName: this.currentUserName,
      skeleton: JSON.parse(JSON.stringify(originalWork.skeleton)),
      renderState: originalWork.renderState ? JSON.parse(JSON.stringify(originalWork.renderState)) : undefined,
      likes: 0,
      views: 0,
      tags: [...originalWork.tags, '改编'],
      createdAt: new Date(),
      isPublic: true,
      allowRemix: true,
      remixCount: 0,
      parentId: workId,
    };

    originalWork.remixCount++;
    this.works.set(remixedWork.id, remixedWork);
    return remixedWork;
  }

  searchWorks(query: string): SharedWork[] {
    const lowerQuery = query.toLowerCase();
    return this.getPublicWorks().filter(work =>
      work.title.toLowerCase().includes(lowerQuery) ||
      work.description.toLowerCase().includes(lowerQuery) ||
      work.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      work.authorName.toLowerCase().includes(lowerQuery)
    );
  }

  getWorksByTag(tag: string): SharedWork[] {
    const lowerTag = tag.toLowerCase();
    return this.getPublicWorks().filter(work =>
      work.tags.some(t => t.toLowerCase() === lowerTag)
    );
  }

  getAllTags(): string[] {
    const tagSet = new Set<string>();
    for (const work of this.works.values()) {
      work.tags.forEach(tag => tagSet.add(tag));
    }
    return Array.from(tagSet);
  }

  getPopularWorks(limit: number = 10): SharedWork[] {
    return this.getPublicWorks()
      .sort((a, b) => b.likes - a.likes)
      .slice(0, limit);
  }

  getRecentWorks(limit: number = 10): SharedWork[] {
    return this.getPublicWorks()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  getWorkCount(): { total: number; public: number; user: number } {
    const allWorks = this.getAllWorks();
    return {
      total: allWorks.length,
      public: allWorks.filter(w => w.isPublic).length,
      user: allWorks.filter(w => w.authorId === this.currentUserId).length,
    };
  }

  exportWork(workId: string): string | null {
    const work = this.works.get(workId);
    if (!work) return null;

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      work: {
        id: work.id,
        title: work.title,
        description: work.description,
        authorName: work.authorName,
        skeleton: work.skeleton,
        renderState: work.renderState,
        tags: work.tags,
      },
    };

    return JSON.stringify(exportData, null, 2);
  }

  importWork(jsonString: string): SharedWork | null {
    try {
      const data = JSON.parse(jsonString);
      if (!data.work || !data.work.skeleton) {
        throw new Error('无效的导出数据格式');
      }

      const importedWork: SharedWork = {
        id: this.generateId(),
        title: `${data.work.title} (导入)`,
        description: data.work.description,
        authorId: this.currentUserId,
        authorName: this.currentUserName,
        skeleton: data.work.skeleton,
        renderState: data.work.renderState,
        likes: 0,
        views: 0,
        tags: [...(data.work.tags || []), '导入'],
        createdAt: new Date(),
        isPublic: false,
        allowRemix: true,
        remixCount: 0,
      };

      this.works.set(importedWork.id, importedWork);
      return importedWork;
    } catch (error) {
      console.error('导入作品失败:', error);
      return null;
    }
  }

  addComment(workId: string, content: string): Comment | null {
    const work = this.works.get(workId);
    if (!work) return null;

    const comment: Comment = {
      id: this.generateId(),
      userId: this.currentUserId,
      userName: this.currentUserName,
      content,
      createdAt: new Date(),
      likes: 0,
    };

    return comment;
  }

  getRemixChain(workId: string): SharedWork[] {
    const chain: SharedWork[] = [];
    let currentId: string | undefined = workId;

    while (currentId) {
      const work = this.works.get(currentId);
      if (!work) break;
      chain.unshift(work);
      currentId = work.parentId;
    }

    return chain;
  }

  getRemixes(workId: string): SharedWork[] {
    return this.getPublicWorks().filter(w => w.parentId === workId);
  }

  setWorkVisibility(workId: string, isPublic: boolean): boolean {
    const work = this.works.get(workId);
    if (!work || work.authorId !== this.currentUserId) return false;
    work.isPublic = isPublic;
    return true;
  }

  setWorkRemixAllowed(workId: string, allowRemix: boolean): boolean {
    const work = this.works.get(workId);
    if (!work || work.authorId !== this.currentUserId) return false;
    work.allowRemix = allowRemix;
    return true;
  }

  getTrendingTags(limit: number = 10): { tag: string; count: number }[] {
    const tagCounts = new Map<string, number>();

    for (const work of this.getPublicWorks()) {
      for (const tag of work.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  suggestTags(title: string, description: string): string[] {
    const suggestions: string[] = [];
    const text = (title + ' ' + description).toLowerCase();

    const keywordMap: { [key: string]: string[] } = {
      '传统': ['传统', '古典', '古风'],
      '现代': ['现代', '简约', '设计'],
      '春节|元宵': ['节日', '春节', '灯笼'],
      '宫灯': ['宫灯', '古典', '豪华'],
      '走马灯': ['走马灯', '动态', '传统'],
      '兔子|兔': ['兔子灯', '可爱', '生肖'],
      '荷花|莲花': ['荷花灯', '莲花', '水上'],
    };

    for (const [keyword, tags] of Object.entries(keywordMap)) {
      if (new RegExp(keyword).test(text)) {
        suggestions.push(...tags);
      }
    }

    return [...new Set(suggestions)].slice(0, 5);
  }

  generateShareLink(workId: string): string {
    const work = this.works.get(workId);
    if (!work) return '';
    return `https://lantern-editor.com/work/${workId}`;
  }

  generateShareText(workId: string): string {
    const work = this.works.get(workId);
    if (!work) return '';

    return `🎨 【${work.title}】\n` +
           `${work.description}\n\n` +
           `作者: ${work.authorName}\n` +
           `标签: ${work.tags.join('、')}\n` +
           `${this.generateShareLink(workId)}`;
  }
}
