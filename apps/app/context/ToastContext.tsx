import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { colors, radius, spacing, shadows, TAB_BAR_HEIGHT } from '@/theme';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TOAST_DURATION_MS = 3000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++counterRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_DURATION_MS);
    timersRef.current.push(timer);
  }, []);

  // The web version leaked a setTimeout per toast on unmount. On native that fires into a
  // torn-down tree and warns, so clear them.
  useEffect(() => {
    const timers = timersRef;
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View style={styles.host} pointerEvents="none">
        {toasts.map((t) => (
          <Animated.View
            key={t.id}
            entering={FadeInDown.duration(200)}
            exiting={FadeOut.duration(150)}
            style={[
              styles.toast,
              shadows.floating,
              t.type === 'success' && styles.success,
              t.type === 'error' && styles.error,
            ]}
          >
            <Text style={styles.text}>{t.message}</Text>
          </Animated.View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: TAB_BAR_HEIGHT + spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
    zIndex: 9999,
  },
  toast: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  success: { backgroundColor: 'rgba(22,163,74,0.92)' },
  error: { backgroundColor: 'rgba(220,38,38,0.92)' },
  text: {
    color: colors.textOnAccent,
    fontSize: 14,
    fontWeight: '600',
  },
});

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
