// Type definitions for Tauri window object
declare global {
  interface Window {
    __TAURI__: {
      invoke: (command: string, args?: any) => Promise<any>;
      // Add other Tauri APIs as needed
    };
  }
}

export {};
