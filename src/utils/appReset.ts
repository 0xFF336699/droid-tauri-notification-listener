import { invoke } from '@tauri-apps/api/core';

/**
 * 重置应用到默认状态
 * 清除所有数据：
 * - LocalStorage（设备列表、过滤配置等前端数据）
 * - Tauri本地数据目录（窗口状态等后端数据）
 *
 * 使用标记文件策略解决Windows文件锁定问题：
 * 1. 清理LocalStorage
 * 2. 创建重置标记文件
 * 3. 退出应用
 * 4. 下次启动时自动删除数据文件
 */
export async function resetAppToDefaults(): Promise<void> {
  const confirmed = window.confirm(
    '确定要重置应用到初始状态吗？\n\n' +
    '这将清除：\n' +
    '- 所有已保存的设备\n' +
    '- 窗口位置和大小设置\n' +
    '- 所有过滤器设置\n' +
    '- 所有应用设置\n\n' +
    '应用将关闭，重新启动后生效。\n\n' +
    '此操作不可撤销！'
  );

  if (!confirmed) {
    return;
  }

  try {
    console.log('[appReset] Starting app reset...');

    // 1. 清理LocalStorage（前端数据）
    console.log('[appReset] Clearing localStorage...');
    localStorage.clear();
    console.log('[appReset] LocalStorage cleared');

    // 2. 创建重置标记（Tauri后端会在下次启动时删除数据文件）
    console.log('[appReset] Creating reset marker...');
    const result = await invoke<string>('reset_app_to_defaults');
    console.log('[appReset] Reset marker result:', result);

    alert(
      '重置标记已创建！\n\n' +
      result + '\n\n' +
      '应用即将关闭，请重新启动以完成重置。'
    );

    // 3. 退出应用
    console.log('[appReset] Exiting application...');
    await invoke('exit_app');
  } catch (error) {
    console.error('[appReset] Reset failed:', error);

    // 如果失败，至少LocalStorage已经清理了，重新加载也能达到部分效果
    alert(
      '重置过程遇到问题，但前端数据已清空。\n\n' +
      '错误: ' + (error as Error).message + '\n\n' +
      '应用将重新加载。'
    );
    window.location.reload();
  }
}

/**
 * 简单版本：只清理LocalStorage并重新加载
 * 适用于快速重置设备列表，但保留窗口设置
 */
export async function resetDevicesOnly(): Promise<void> {
  const confirmed = window.confirm(
    '确定要清空所有设备吗？\n\n' +
    '这将清除所有已保存的设备，但保留窗口设置。\n\n' +
    '此操作不可撤销！'
  );

  if (!confirmed) {
    return;
  }

  try {
    console.log('[appReset] Clearing devices only...');
    localStorage.clear();
    console.log('[appReset] LocalStorage cleared');

    alert('设备数据已清空！\n应用将重新加载。');
    window.location.reload();
  } catch (error) {
    console.error('[appReset] Reset devices failed:', error);
    alert('清空失败: ' + (error as Error).message);
  }
}
