// Generate a unique device ID for tracking approved devices
export const getDeviceId = (): string => {
  let deviceId = localStorage.getItem("device_id");
  
  if (!deviceId) {
    // Generate a unique ID based on browser fingerprint
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('fingerprint', 2, 2);
      const canvasData = canvas.toDataURL();
      deviceId = btoa(canvasData).substring(0, 32);
    } else {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    
    localStorage.setItem("device_id", deviceId);
  }
  
  return deviceId;
};
