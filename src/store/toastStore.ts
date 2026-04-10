import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastState {
  toasts: Toast[]
  addToast: (type: ToastType, message: string, duration?: number) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (type, message, duration = 4000) => {
    const id = uuidv4()
    set((state) => ({ toasts: [...state.toasts, { id, type, message, duration }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, duration)
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },
}))

// Convenience helpers
export const toast = {
  success: (msg: string) => useToastStore.getState().addToast('success', msg),
  error: (msg: string) => useToastStore.getState().addToast('error', msg),
  warning: (msg: string) => useToastStore.getState().addToast('warning', msg),
  info: (msg: string) => useToastStore.getState().addToast('info', msg),
}
