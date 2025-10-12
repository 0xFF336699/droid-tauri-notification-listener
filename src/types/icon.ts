/**
 * 图标数据接口
 */
export interface IconData {
  packageName: string;
  iconBase64?: string;
  error?: string;
  timestamp: number;  // 缓存时间戳
}

/**
 * 图标缓存 Map
 * key: packageName
 * value: IconData
 */
export interface IconMap {
  [packageName: string]: IconData;
}
