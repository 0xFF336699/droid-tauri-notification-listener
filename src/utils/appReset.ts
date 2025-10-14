import { invoke } from '@tauri-apps/api/core';
import i18n from 'i18next';

/**
 * @description {{t('appReset.comments.resetFunction')}}
 * {{t('appReset.comments.resetDescription')}}
 * 
 * {{t('appReset.comments.resetStrategy')}}
 */
export async function resetAppToDefaults(): Promise<void> {
  const confirmed = window.confirm(
    `${i18n.t('appReset.confirmTitle')}\n\n` +
    `${i18n.t('appReset.confirmMessage')}`
  );

  if (!confirmed) {
    return;
  }

  try {
    // 1. Clear localStorage (frontend data)
    console.log(i18n.t('appReset.logs.clearingLocalStorage'));
    localStorage.clear();
    console.log(i18n.t('appReset.logs.localStorageCleared'));
    // 2. Create reset marker (Tauri backend will delete data files on next startup)
    console.log(i18n.t('appReset.logs.creatingResetMarker'));
    const result = await invoke<string>('reset_app_to_defaults');
    console.log(i18n.t('appReset.logs.resetMarkerCreated'), 'Result:', result);

    alert(
      `${i18n.t('appReset.logs.resetMarkerCreated')}!\n\n` +
      `${result}\n\n` +
      i18n.t('appReset.logs.exitingApp')
    );

    // 3. Exit app after 3 seconds
    setTimeout(() => {
      console.log(i18n.t('appReset.logs.exitingApp'));
      window.close(); // Close window in browser
      // Exit app in Tauri
      if (window.__TAURI__) {
        invoke('exit_app');
      }
    }, 3000);
  } catch (error) {
    const errorMessage = `${i18n.t('appReset.logs.error')} ${error}`;
    console.error(errorMessage);
    alert(errorMessage);
  }
}

/**
 * @description Simple version: Only clear localStorage and reload
 * Suitable for quickly resetting the device list while preserving window settings
 */
export async function resetDevicesOnly(): Promise<void> {
  const confirmed = window.confirm(
    `${i18n.t('appReset.devices.confirmTitle')}\n\n` +
    `${i18n.t('appReset.devices.confirmMessage')}\n\n` +
    `${i18n.t('appReset.devices.irreversible')}`
  );

  if (!confirmed) {
    return;
  }

  try {
    console.log(i18n.t('appReset.devices.logs.clearing'));
    localStorage.clear();
    console.log(i18n.t('appReset.devices.logs.cleared'));

    alert(i18n.t('appReset.devices.success'));
    window.location.reload();
  } catch (error) {
    const errorMessage = `${i18n.t('appReset.devices.error')}: ${(error as Error).message}`;
    console.error(errorMessage);
    alert(errorMessage);
  }
}
