import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FontMetadata, TypographyConfig } from '../font/font.interface';

interface User {
  id: string;
  username: string;
  avatar: string;
  createdAt: string;
}

interface ShareLink {
  id: string;
  configId: string;
  shareCode: string;
  createdAt: string;
  views: number;
}

@Injectable()
export class UserService {
  private readonly dataDir = path.join(process.cwd(), 'data');
  private users: Map<string, User> = new Map();
  private userFonts: Map<string, string[]> = new Map();
  private userConfigs: Map<string, string[]> = new Map();
  private shareLinks: Map<string, ShareLink> = new Map();
  private shareCodeToId: Map<string, string> = new Map();

  constructor() {
    this.ensureDirectories();
    this.loadData();
  }

  private ensureDirectories() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private loadData() {
    const usersPath = path.join(this.dataDir, 'users.json');
    const shareLinksPath = path.join(this.dataDir, 'shareLinks.json');

    if (fs.existsSync(usersPath)) {
      const data = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
      data.forEach((u: User) => this.users.set(u.id, u));
    } else {
      this.createDefaultUser();
    }

    if (fs.existsSync(shareLinksPath)) {
      const data = JSON.parse(fs.readFileSync(shareLinksPath, 'utf-8'));
      data.forEach((s: ShareLink) => {
        this.shareLinks.set(s.id, s);
        this.shareCodeToId.set(s.shareCode, s.id);
      });
    }
  }

  private saveData() {
    const usersPath = path.join(this.dataDir, 'users.json');
    const shareLinksPath = path.join(this.dataDir, 'shareLinks.json');

    fs.writeFileSync(usersPath, JSON.stringify(Array.from(this.users.values()), null, 2));
    fs.writeFileSync(shareLinksPath, JSON.stringify(Array.from(this.shareLinks.values()), null, 2));
  }

  private createDefaultUser() {
    const defaultUser: User = {
      id: 'default-user-' + uuidv4().slice(0, 8),
      username: '字体设计师',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=fontdesigner',
      createdAt: new Date().toISOString(),
    };
    this.users.set(defaultUser.id, defaultUser);
    this.saveData();
  }

  getDefaultUser(): User {
    return Array.from(this.users.values())[0];
  }

  getUserById(id: string): User | undefined {
    return this.users.get(id);
  }

  updateUser(id: string, updates: Partial<User>): User | undefined {
    const user = this.users.get(id);
    if (user) {
      const updated = { ...user, ...updates };
      this.users.set(id, updated);
      this.saveData();
      return updated;
    }
    return undefined;
  }

  addUserFont(userId: string, fontId: string): void {
    if (!this.userFonts.has(userId)) {
      this.userFonts.set(userId, []);
    }
    const fonts = this.userFonts.get(userId)!;
    if (!fonts.includes(fontId)) {
      fonts.push(fontId);
    }
  }

  addUserConfig(userId: string, configId: string): void {
    if (!this.userConfigs.has(userId)) {
      this.userConfigs.set(userId, []);
    }
    const configs = this.userConfigs.get(userId)!;
    if (!configs.includes(configId)) {
      configs.push(configId);
    }
  }

  removeUserFont(userId: string, fontId: string): void {
    const fonts = this.userFonts.get(userId);
    if (fonts) {
      const index = fonts.indexOf(fontId);
      if (index > -1) {
        fonts.splice(index, 1);
      }
    }
  }

  removeUserConfig(userId: string, configId: string): void {
    const configs = this.userConfigs.get(userId);
    if (configs) {
      const index = configs.indexOf(configId);
      if (index > -1) {
        configs.splice(index, 1);
      }
    }
  }

  createShareLink(configId: string): ShareLink {
    const shareCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const link: ShareLink = {
      id: uuidv4(),
      configId,
      shareCode,
      createdAt: new Date().toISOString(),
      views: 0,
    };
    this.shareLinks.set(link.id, link);
    this.shareCodeToId.set(shareCode, link.id);
    this.saveData();
    return link;
  }

  getShareLinkByCode(shareCode: string): ShareLink | undefined {
    const id = this.shareCodeToId.get(shareCode);
    if (id) {
      const link = this.shareLinks.get(id);
      if (link) {
        link.views++;
        this.saveData();
        return link;
      }
    }
    return undefined;
  }

  deleteShareLink(shareId: string): boolean {
    const link = this.shareLinks.get(shareId);
    if (link) {
      this.shareCodeToId.delete(link.shareCode);
      this.shareLinks.delete(shareId);
      this.saveData();
      return true;
    }
    return false;
  }

  getUserShareLinks(userId?: string): ShareLink[] {
    return Array.from(this.shareLinks.values());
  }

  addShareLink(userId: string, shareLink: ShareLink): void {
    this.shareLinks.set(shareLink.id, shareLink);
    this.shareCodeToId.set(shareLink.shareCode, shareLink.id);
    this.saveData();
  }

  incrementShareViews(shareCode: string): void {
    const id = this.shareCodeToId.get(shareCode);
    if (id) {
      const link = this.shareLinks.get(id);
      if (link) {
        link.views++;
        this.saveData();
      }
    }
  }
}
