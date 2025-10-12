import { mainModelController } from '../data/main-model-controller';
import { getClientByUuid } from '../data/device-connection-handler';
import { IconData } from '../types/icon';

const ICON_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24小时

// 正在加载中的包名集合（防止重复加载）
const loadingPackages = new Set<string>();

/**
 * 获取包的图标
 * @param packageName 包名
 * @param deviceUuid 设备UUID（必须提供）
 * @returns IconData 包含 iconBase64 或 error
 */
export async function getPackageIcon(
  packageName: string,
  deviceUuid?: string
): Promise<IconData> {
  console.log('[icon-service] ===== getPackageIcon START =====');
  console.log('[icon-service] packageName:', packageName);
  console.log('[icon-service] deviceUuid:', deviceUuid);

  const { packageIcons } = mainModelController.data;
  console.log('[icon-service] Current packageIcons keys:', Object.keys(packageIcons), packageIcons);

  // 1. 检查缓存
  const cached = packageIcons[packageName];
  console.log('[icon-service] Cached data for', packageName, ':', cached ? 'EXISTS' : 'NOT FOUND');

  if (cached) {
    const isFresh = Date.now() - cached.timestamp < ICON_CACHE_DURATION;
    console.log('[icon-service] Cache fresh:', isFresh, 'timestamp:', cached.timestamp);
    if (isFresh) {
      console.log('[icon-service] Using cached icon for:', packageName);
      console.log('[icon-service] ===== getPackageIcon END (cached) =====');
      return cached;
    } else {
      console.log('[icon-service] Cache expired for:', packageName);
    }
  }

  // 2. 检查是否正在加载中
  console.log('[icon-service] Checking if already loading...');
  console.log('[icon-service] loadingPackages size:', loadingPackages.size);
  console.log('[icon-service] loadingPackages has', packageName, ':', loadingPackages.has(packageName));

  if (loadingPackages.has(packageName)) {
    console.log('[icon-service] Already loading:', packageName);
    console.log('[icon-service] Waiting for loading to complete...');
    // 等待加载完成
    const result = await waitForLoading(packageName);
    console.log('[icon-service] Wait completed, returning cached data');
    console.log('[icon-service] ===== getPackageIcon END (waited) =====');
    return result;
  }

  // 3. 标记为加载中
  console.log('[icon-service] Adding to loadingPackages:', packageName);
  loadingPackages.add(packageName);
  console.log('[icon-service] loadingPackages size after add:', loadingPackages.size);
  console.log('[icon-service] Start loading icon for:', packageName);

  try {
    // 4. 必须提供 deviceUuid
    if (!deviceUuid) {
      console.error('[icon-service] ERROR: No deviceUuid provided');
      const errorMsg = '请指定设备 UUID';
      alert(errorMsg);
      const errorData: IconData = {
        packageName,
        error: errorMsg,
        timestamp: Date.now(),
      };
      console.log('[icon-service] Setting error data to packageIcons[', packageName, ']');
      packageIcons[packageName] = errorData;
      console.log('[icon-service] ===== getPackageIcon END (error: no uuid) =====');
      return errorData;
    }

    // 5. 获取指定的客户端
    console.log('[icon-service] Getting WebSocket client for device:', deviceUuid);
    const client = getClientByUuid(deviceUuid);

    if (!client || !client.isConnected()) {
      console.error('[icon-service] ERROR: Client not found or not connected');
      const errorMsg = `设备 ${deviceUuid} 未连接或不可用`;
      alert(errorMsg);
      const errorData: IconData = {
        packageName,
        error: errorMsg,
        timestamp: Date.now(),
      };
      console.log('[icon-service] Setting error data to packageIcons[', packageName, ']');
      packageIcons[packageName] = errorData;
      console.log('[icon-service] ===== getPackageIcon END (error: no client) =====');
      return errorData;
    }

    console.log('[icon-service] WebSocket client found, calling getPackageIcon...');

    // 6. 通过 socket 获取
    const response = await client.getPackageIcon(packageName);
    console.log('[icon-service] WebSocket result received');
    console.log('[icon-service] response.iconBase64 length:', response.iconBase64?.length || 0);
    console.log('[icon-service] response.iconBase64 preview:', response.iconBase64?.substring(0, 50));

    // 7. 更新缓存
    const iconData: IconData = {
      packageName,
      iconBase64: response.iconBase64,
      timestamp: Date.now(),
    };
    console.log('[icon-service] Creating iconData object:', {
      packageName: iconData.packageName,
      iconBase64Length: iconData.iconBase64?.length,
      timestamp: iconData.timestamp
    });

    console.log('[icon-service] BEFORE SET - packageIcons[', packageName, ']:', packageIcons[packageName]);
    packageIcons[packageName] = iconData;
    console.log('[icon-service] AFTER SET - packageIcons[', packageName, ']:', packageIcons[packageName]);
    console.log('[icon-service] Verifying - all packageIcons keys:', Object.keys(packageIcons));
    console.log('[icon-service] Icon loaded successfully for:', packageName);
    console.log('[icon-service] ===== getPackageIcon END (success) =====');

    return iconData;

  } catch (error) {
    // 8. 错误处理
    console.error('[icon-service] ===== getPackageIcon ERROR =====');
    console.error('[icon-service] Failed to load icon for:', packageName, error);
    console.error('[icon-service] Error stack:', (error as Error).stack);

    const errorData: IconData = {
      packageName,
      error: error instanceof Error ? error.message : 'Failed to load icon',
      timestamp: Date.now(),
    };
    console.log('[icon-service] Setting error data to packageIcons[', packageName, ']');
    packageIcons[packageName] = errorData;
    console.log('[icon-service] ===== getPackageIcon END (exception) =====');

    return errorData;

  } finally {
    // 9. 移除加载中标记
    console.log('[icon-service] Removing from loadingPackages');
    loadingPackages.delete(packageName);
    console.log('[icon-service] loadingPackages size after delete:', loadingPackages.size);
  }
}

/**
 * 等待正在加载的图标完成
 */
async function waitForLoading(packageName: string): Promise<IconData> {
  const maxWaitTime = 10000; // 最多等待 10 秒
  const checkInterval = 100; // 每 100ms 检查一次
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const checkLoading = () => {
      const { packageIcons } = mainModelController.data;

      // 检查是否已加载完成
      if (!loadingPackages.has(packageName)) {
        const iconData = packageIcons[packageName];
        if (iconData) {
          resolve(iconData);
          return;
        }
      }

      // 检查是否超时
      if (Date.now() - startTime > maxWaitTime) {
        reject(new Error('Wait for loading timeout'));
        return;
      }

      // 继续等待
      setTimeout(checkLoading, checkInterval);
    };

    checkLoading();
  });
}

/**
 * 清除过期的缓存
 */
export function clearExpiredIconCache(): void {
  const { packageIcons } = mainModelController.data;
  const now = Date.now();
  let clearedCount = 0;

  Object.keys(packageIcons).forEach(packageName => {
    const iconData = packageIcons[packageName];
    if (iconData && now - iconData.timestamp > ICON_CACHE_DURATION) {
      delete packageIcons[packageName];
      clearedCount++;
    }
  });

  if (clearedCount > 0) {
    console.log('[icon-service] Cleared', clearedCount, 'expired icons');
  }
}

/**
 * 清除所有缓存
 */
export function clearAllIconCache(): void {
  const { packageIcons } = mainModelController.data;
  const keys = Object.keys(packageIcons);
  const count = keys.length;

  keys.forEach(key => {
    delete packageIcons[key];
  });

  console.log('[icon-service] Cleared all', count, 'cached icons');
}
