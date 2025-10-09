import { useProxyWatch } from 'fanfanlo-deep-watcher';
import { mainModelController } from '../data/main-model-controller';
import { DeviceCard } from './DeviceCard';

export function DeviceList() {
  const [enabledDevices] = useProxyWatch(
    mainModelController.data,
    'enabledDevices',
    mainModelController.data.enabledDevices
  );

  if (enabledDevices.length === 0) {
    return (
      <div className="empty-state" style={{
        padding: '40px 20px',
        textAlign: 'center',
        color: '#666'
      }}>
        <p>暂无启用的设备</p>
      </div>
    );
  }

  return (
    <div className="device-list" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      padding: '16px'
    }}>
      {enabledDevices.map(conn => (
        <DeviceCard
          key={conn.device.uuid}
          connection={conn}
        />
      ))}
    </div>
  );
}
