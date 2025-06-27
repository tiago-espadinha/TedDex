import { createContext, useContext } from 'react';

export interface ToastMsg {
  text: string;
  action?: { label: string; href: string };
}

export const ToastCtx = createContext<(msg: ToastMsg) => void>(() => {});

export const useToast = () => useContext(ToastCtx);
