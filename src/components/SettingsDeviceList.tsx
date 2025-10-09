import { useProxyWatch } from 'fanfanlo-deep-watcher';
import { mainModelController } from '../data/main-model-controller';
import { DeviceCard } from './DeviceCard';
import { EmptyDeviceState } from './EmptyDeviceState';

export function SettingsDeviceList() {
  const [allDevices] = useProxyWatch(
    mainModelController.data,
    'allDevices',
    mainModelController.data.allDevices
  );

  if (allDevices.length === 0) {
    return <EmptyDeviceState />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {allDevices.map(conn => {
        console.log('[SettingsDeviceList] Rendering DeviceCard for:', conn.device.uuid);
        return (
          <DeviceCard
            key={conn.device.uuid}
            connection={conn}
          />
        );
      })}
    </div>
  );
}
