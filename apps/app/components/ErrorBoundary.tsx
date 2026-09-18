import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { Button } from './Button';

interface State {
  error: Error | null;
}

/**
 * The web app shipped without error boundaries on most routes — a render error blanked the
 * whole screen (app.MD, "Functional Gaps" #10). On native an uncaught render error is worse:
 * it hard-crashes the app in a release build. This wraps the entire tree.
 *
 * Note this catches render/lifecycle errors only. Rejected promises in event handlers still
 * need their own try/catch — which is why the like/save paths keep theirs.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // TODO(observability): forward to a crash reporter once one is wired up.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message} numberOfLines={4}>
          {error.message || 'An unexpected error occurred.'}
        </Text>
        <Button label="Try again" onPress={this.reset} style={styles.button} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.md,
  },
  message: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  button: { marginTop: spacing.xl, minWidth: 180 },
});
