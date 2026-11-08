import { Platform, type ViewStyle } from 'react-native';

export const colors = {
  ink: '#4a3f6b',
  soft: '#8c7fb0',
  faint: '#b9aed3',
  cream: '#fff9f3',
  white: '#ffffff',
  glass: 'rgba(255,255,255,0.78)',
  mint: '#b9e6d3',
  mintDeep: '#6fcaa5',
  lav: '#cdb4f6',
  lavDeep: '#a98be8',
  pink: '#ffc2dc',
  pinkDeep: '#ff8fb1',
  sky: '#bfe3ff',
  skyDeep: '#82c3f2',
  butter: '#ffe8a3',
  butterDeep: '#f2c75c',
  peach: '#ffd3b8',
  danger: '#e0587f',
  dangerBg: '#ffe1e8',
  okBg: '#dcf5ea',
  warnBg: '#fff1c9',
  infoBg: '#e6eeff',
} as const;

export const gradients = {
  sky: ['#ffe3f0', '#e6dcff', '#d6f2ff'] as const,
  button: ['#c3a5f5', '#ff9fc6'] as const,
  mint: ['#c9f1e0', '#bfe3ff'] as const,
  sunset: ['#ffe8a3', '#ffc2dc'] as const,
  vault: ['#e6dcff', '#ffd9ea'] as const,
};

export const radii = { sm: 14, md: 20, lg: 28, xl: 36, pill: 999 };

export const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string;
export const rounded = Platform.select({ ios: 'Avenir Next Rounded', android: 'sans-serif-medium', default: 'System' }) as string;

export const shadow = (tint: string = colors.lavDeep, lift = 12): ViewStyle => ({
  shadowColor: tint,
  shadowOpacity: 0.28,
  shadowRadius: lift,
  shadowOffset: { width: 0, height: lift / 2 },
  elevation: Math.round(lift / 2),
});

export const space = (n: number) => n * 4;
