import { useEffect, useState } from 'react';
import { proxyWatch } from 'fanfanlo-deep-watcher';
import { mainModelController } from '../data/main-model-controller';
import { getPackageIcon } from '../services/icon-service';
import { IconData } from '../types/icon';

/**
 * 获取包图标的 Hook
 * @param packageName 包名
 * @param deviceUuid 可选的设备UUID
 * @returns { iconBase64, error }
 */
export function usePackageIcon(packageName: string | undefined, deviceUuid?: string) {
  const { packageIcons } = mainModelController.data;
  const [iconData, setIconData] = useState<IconData | undefined>(
    packageName ? packageIcons[packageName] : undefined
  );

  // 监听缓存中该包名的图标数据变化
  useEffect(() => {
    if (!packageName) {
      setIconData(undefined);
      return;
    }

    // 初始设置
    const initialData = packageIcons[packageName];
    setIconData(initialData);

    // 监听 Map 的变化
    const { unwatch } = proxyWatch(packageIcons, packageName, (newValue: IconData) => {
      setIconData(newValue);
    });

    // 如果没有缓存，则加载
    if (!initialData) {
      console.log('[usePackageIcon] Loading icon for:', packageName);
      getPackageIcon(packageName, deviceUuid).catch(err => {
        console.error('[usePackageIcon] Failed to load icon:', packageName, err);
      });
    }

    return () => {
      unwatch();
    };
  }, [packageName, deviceUuid, packageIcons]);

  return {
    iconBase64: iconData?.iconBase64,
    error: iconData?.error,
  };
}
