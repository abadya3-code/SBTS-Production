/**
 * Themes Index
 * تصدير جميع الثيمات المتاحة
 */

export { sapCleanTheme, type SapCleanTheme } from './sapClean';
export { sbtsCustomTheme, type SbtsCustomTheme } from './sbtsCustom';
export { modernTheme, type ModernTheme } from './modern';

import { sapCleanTheme } from './sapClean';
import { sbtsCustomTheme } from './sbtsCustom';
import { modernTheme } from './modern';

/**
 * قاموس الثيمات - للوصول السريع إلى أي ثيم
 */
export const themesMap = {
  'sap-clean': sapCleanTheme,
  'sbts-custom': sbtsCustomTheme,
  'modern': modernTheme,
} as const;

/**
 * قائمة الثيمات المتاحة
 */
export const availableThemes = [
  {
    id: 'sap-clean',
    name: 'SAP Clean',
    description: 'Professional and classic theme inspired by SAP',
    theme: sapCleanTheme,
  },
  {
    id: 'sbts-custom',
    name: 'SBTS Custom',
    description: 'Modern and custom theme inspired by Aramco',
    theme: sbtsCustomTheme,
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Contemporary and advanced theme with Dark Mode',
    theme: modernTheme,
  },
] as const;

export type AvailableThemeId = typeof availableThemes[number]['id'];
