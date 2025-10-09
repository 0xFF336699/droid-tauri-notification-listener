export function EmptyDeviceState() {
  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#f8f9fa',
      borderRadius: '4px',
      textAlign: 'center',
      color: '#666'
    }}>
      <p>暂无设备</p>
      <p style={{ fontSize: '14px', marginTop: '8px' }}>
        请点击"+ 添加连接"扫码添加设备
      </p>
    </div>
  );
}
