import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { createMemoryPreferenceStore, ThemeProvider, type ThemePreference } from '../../theme';

/** Renderiza dentro de un ThemeProvider con la preferencia pedida (default: claro). */
export function renderThemed(ui: ReactElement, preference: ThemePreference = 'light') {
  const store = createMemoryPreferenceStore(preference);
  return render(<ThemeProvider store={store}>{ui}</ThemeProvider>);
}
