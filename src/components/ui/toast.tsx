'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info' | 'warning'
  duration?: number
  onClose?: () => void
}

export function Toast({ message, type = 'info', duration = 6000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(() => onClose?.(), 300) // Allow fade out animation
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  const typeStyles = {
    success: 'bg-green-50 text-green-800 border-green-200',
    error: 'bg-red-50 text-red-800 border-red-200',
    warning: 'bg-orange-50 text-orange-800 border-orange-200',
    info: 'bg-blue-50 text-blue-800 border-blue-200'
  }

  const icons = {
    success: '✅',
    error: '❌', 
    warning: '⚠️',
    info: 'ℹ️'
  }

  return (
    <div
      className={cn(
        'fixed top-20 right-4 z-50 flex items-center justify-center space-x-2 px-6 py-4 rounded-lg border shadow-lg transition-all duration-300',
        'min-w-[320px] max-w-[90vw] md:max-w-md w-full text-center',
        typeStyles[type],
        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
      )}
    >
      <span className="text-lg">{icons[type]}</span>
      <span className="text-sm font-medium w-full">{message}</span>
      <button
        onClick={() => {
          setIsVisible(false)
          setTimeout(() => onClose?.(), 300)
        }}
        className="ml-2 text-current hover:opacity-70"
      >
        ×
      </button>
    </div>
  )
}

// Toast context/hook for easy usage
interface ToastContextType {
  showToast: (message: string, type?: ToastProps['type'], duration?: number) => void
}

interface ToastContainerProps {
  position?: 'center' | 'top-right';
}

export function useToast() {
  const [toasts, setToasts] = useState<Array<ToastProps & { id: string }>>([])

  const showToast = (message: string, type: ToastProps['type'] = 'info', duration?: number) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast = {
      id,
      message,
      type,
      duration,
      onClose: () => setToasts(prev => prev.filter(t => t.id !== id))
    }
    setToasts(prev => [...prev, newToast])
    return id
  }

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const ToastContainer = ({ position = 'top-right' }: ToastContainerProps) => {
    let containerClass = ''
    if (position === 'center') {
      containerClass = 'fixed left-1/2 top-24 transform -translate-x-1/2 z-50 space-y-2 p-4 flex flex-col items-center'
    } else {
      containerClass = 'fixed top-0 right-0 z-50 space-y-2 p-4'
    }
    return (
      <div className={containerClass}>
        {toasts.map(toast => (
          <Toast key={toast.id} {...toast} />
        ))}
      </div>
    )
  }

  return { showToast, ToastContainer, dismissToast }
} 