// utils/input/remoteControl.ts
import { create } from "zustand";

export type RemoteKey = "UP" | "DOWN" | "LEFT" | "RIGHT" | "OK" | "BACK";

interface RemoteControlState {
  lastInput: RemoteKey | null;
  onRemoteInput: (key: RemoteKey) => void;
  clear: () => void;
}

export const useRemoteControlStore = create<RemoteControlState>((set) => ({
  lastInput: null,

  onRemoteInput: (key) => {
    console.log("Remote input:", key);
    set({ lastInput: key });
  },

  clear: () => set({ lastInput: null }),
}));
