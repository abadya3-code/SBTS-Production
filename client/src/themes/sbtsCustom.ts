/**
 * SBTS Custom Theme
 * مخصص وحديث، مستوحى من Aramco
 * 
 * الخصائص:
 * - ألوان حديثة وجذابة
 * - تصميم معاصر وديناميكي
 * - مناسب للتطبيقات الحديثة
 */

export const sbtsCustomTheme = {
  name: 'sbts-custom',
  label: 'SBTS Custom',
  description: 'Modern and custom theme inspired by Aramco',
  
  colors: {
    // Primary Colors
    primary: '#0891B2',      // سماوي (اللون الحالي)
    primaryLight: '#06B6D4', // سماوي فاتح
    primaryDark: '#0E7490',  // سماوي أغمق
    
    // Secondary Colors
    secondary: '#06B6D4',    // سماوي فاتح
    secondaryLight: '#22D3EE',
    secondaryDark: '#0891B2',
    
    // Accent Colors
    accent: '#EC4899',       // وردي
    accentLight: '#F472B6',
    accentDark: '#DB2777',
    
    // Neutral Colors
    background: '#F8FAFC',   // أبيض مع لمسة زرقاء
    surface: '#FFFFFF',      // أبيض
    border: '#E2E8F0',       // رمادي فاتح
    text: '#1E293B',         // رمادي داكن
    textLight: '#475569',    // رمادي متوسط
    textLighter: '#94A3B8',  // رمادي فاتح
    
    // Semantic Colors
    success: '#10B981',      // أخضر حديث
    successLight: '#6EE7B7',
    successDark: '#059669',
    
    warning: '#F59E0B',      // برتقالي حديث
    warningLight: '#FBBF24',
    warningDark: '#D97706',
    
    error: '#EF4444',        // أحمر حديث
    errorLight: '#F87171',
    errorDark: '#DC2626',
    
    info: '#3B82F6',         // أزرق حديث
    infoLight: '#60A5FA',
    infoDark: '#1D4ED8',
  },
  
  typography: {
    fontFamily: "'Inter', 'Segoe UI', 'Arial', sans-serif",
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  
  borderRadius: {
    none: '0',
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    full: '9999px',
  },
  
  shadows: {
    none: 'none',
    sm: '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
    md: '0 4px 6px -1px rgba(15, 23, 42, 0.1)',
    lg: '0 10px 15px -3px rgba(15, 23, 42, 0.1)',
    xl: '0 20px 25px -5px rgba(15, 23, 42, 0.1)',
  },
  
  transitions: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
  
  cssVariables: {
    '--primary': '#0891B2',
    '--primary-light': '#06B6D4',
    '--primary-dark': '#0E7490',
    '--secondary': '#06B6D4',
    '--secondary-light': '#22D3EE',
    '--secondary-dark': '#0891B2',
    '--accent': '#EC4899',
    '--accent-light': '#F472B6',
    '--accent-dark': '#DB2777',
    '--background': '#F8FAFC',
    '--surface': '#FFFFFF',
    '--border': '#E2E8F0',
    '--text': '#1E293B',
    '--text-light': '#475569',
    '--text-lighter': '#94A3B8',
    '--success': '#10B981',
    '--warning': '#F59E0B',
    '--error': '#EF4444',
    '--info': '#3B82F6',
  },
};

export type SbtsCustomTheme = typeof sbtsCustomTheme;
