import { createContext, useContext } from 'react';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}

export type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(true));

export function useConfirm() {
  return useContext(ConfirmContext);
}
