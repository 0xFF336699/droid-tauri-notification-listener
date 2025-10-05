import { Connection } from './connection';

const STORAGE_KEY = 'socket_connections';

/**
 * 连接配置的本地存储管理类
 */
export class ConnectionStorage {
  /**
   * 获取所有连接
   */
  static getAll(): Connection[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        return [];
      }
      return JSON.parse(data) as Connection[];
    } catch (error) {
      console.error('Failed to load connections from localStorage:', error);
      return [];
    }
  }

  /**
   * 保存所有连接
   */
  static saveAll(connections: Connection[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
    } catch (error) {
      console.error('Failed to save connections to localStorage:', error);
      throw error;
    }
  }

  /**
   * 添加新连接
   */
  static add(connection: Connection): void {
    const connections = this.getAll();
    connections.push(connection);
    this.saveAll(connections);
  }

  /**
   * 更新连接
   */
  static update(id: string, updates: Partial<Connection>): void {
    const connections = this.getAll();
    const index = connections.findIndex(c => c.id === id);
    if (index !== -1) {
      connections[index] = { ...connections[index], ...updates };
      this.saveAll(connections);
    }
  }

  /**
   * 删除连接
   */
  static remove(id: string): void {
    const connections = this.getAll();
    const filtered = connections.filter(c => c.id !== id);
    this.saveAll(filtered);
  }

  /**
   * 根据ID获取连接
   */
  static getById(id: string): Connection | undefined {
    const connections = this.getAll();
    return connections.find(c => c.id === id);
  }

  /**
   * 获取所有已启用的连接
   */
  static getEnabled(): Connection[] {
    return this.getAll().filter(c => c.enabled);
  }

  /**
   * 迁移旧的单连接配置到新结构
   */
  static migrateFromOldConfig(): void {
    const oldHost = localStorage.getItem('socket_host');
    const oldToken = localStorage.getItem('socket_token');

    if (oldHost && oldHost.trim()) {
      // 检查是否已经有连接了
      const existing = this.getAll();
      if (existing.length === 0) {
        // 创建一个新连接来保存旧配置
        const connection: Connection = {
          id: `migrated-${Date.now()}`,
          name: '已迁移的连接',
          host: oldHost,
          token: oldToken || undefined,
          enabled: true,
          createdAt: Date.now()
        };
        this.add(connection);

        // 删除旧配置
        localStorage.removeItem('socket_host');
        localStorage.removeItem('socket_token');

        console.log('Migrated old connection config to new structure');
      }
    }
  }
}
