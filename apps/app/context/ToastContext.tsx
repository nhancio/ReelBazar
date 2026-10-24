import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { colors, radius, spacing, shadows } from '@/theme';

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

const TOAST_DURATION_MS = 2800;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++counterRef.current;
    setToasts((prev) => [
      ...prev.filter((t) => t.message !== message).slice(-1),
      { id, message, type },
    ]);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_DURATION_MS);
    timersRef.current.push(timer);
  }, []);

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
            entering={FadeInUp.duration(220)}
            exiting={FadeOutUp.duration(160)}
            style={[
              styles.toast,
              shadows.floating,
              t.type === 'success' && styles.success,
              t.type === 'error' && styles.error,
            ]}
          >
            <Ionicons
              name={
                t.type === 'success'
                  ? 'checkmark-circle'
                  : t.type === 'error'
                    ? 'alert-circle'
                    : 'sparkles'
              }
              size={16}
              color={
                t.type === 'success'
                  ? '#34d399'
                  : t.type === 'error'
                    ? '#fda4af'
                    : colors.accent
              }
            />
            <Text style={styles.text} numberOfLines={2}>
              {t.message}
            </Text>
          </Animated.View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    top: 58,
    alignItems: 'center',
    gap: spacing.xs,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
    backgroundColor: 'rgba(18, 18, 24, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255, 45, 120, 0.35)',
    maxWidth: 380,
  },
  success: {
    backgroundColor: 'rgba(12, 28, 22, 0.96)',
    borderColor: 'rgba(16, 185, 129, 0.45)',
  },
  error: {
    backgroundColor: 'rgba(34, 12, 20, 0.96)',
    borderColor: 'rgba(244, 63, 94, 0.45)',
  },
  text: {
    color: colors.textOnAccent,
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
});

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
