// Platform-split at the file level: React Native wants shadowColor/shadowOffset/
// shadowOpacity/shadowRadius (+ Android elevation), while react-native-web wants a plain
// CSS boxShadow. Metro picks shadows.web.ts on web and shadows.native.ts everywhere else,
// so this file only exists to give TypeScript the shared shape.
export type { ShadowStyle } from './shadows.native';
export { shadows } from './shadows.native';
