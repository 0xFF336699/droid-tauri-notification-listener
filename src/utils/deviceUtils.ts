import { invoke } from '@tauri-apps/api/core';
import { DeviceInfo } from '../types/device';

/**
 * 获取或生成设备UUID（持久化）
 */
export async function getDeviceUUID(): Promise<string> {
  return await invoke<string>('get_device_uuid');
}

/**
 * 获取操作系统类型
 */
export async function getOSType(): Promise<string> {
  return await invoke<string>('get_os_type');
}

/**
 * 获取操作系统版本
 */
export async function getOSVersion(): Promise<string> {
  return await invoke<string>('get_os_version');
}

/**
 * 获取主机名
 */
export async function getHostname(): Promise<string> {
  return await invoke<string>('get_hostname');
}

/**
 * 获取完整的设备信息
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  const [uuid, os, osVersion, hostname] = await Promise.all([
    getDeviceUUID(),
    getOSType(),
    getOSVersion(),
    getHostname()
  ]);

  return {
    uuid,
    os,
    osVersion,
    hostname,
    timestamp: Date.now()
  };
}
