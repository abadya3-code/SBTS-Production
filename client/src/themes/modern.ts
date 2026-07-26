/**
 * Modern Theme
 * معاصر ومتطور مع Dark Mode
 * 
 * الخصائص:
 * - ألوان جريئة وحديثة
 * - تصميم متطور وديناميكي
 * - Dark Mode كافتراضي
 * - مناسب للتطبيقات المتقدمة
 */

export const modernTheme = {
  name: 'modern',
  label: 'Modern',
  description: 'Contemporary and advanced theme with Dark Mode',
  isDarkMode: true,
  
  colors: {
    // Primary Colors
    primary: '#7C3AED',      // بنفسجي
    primaryLight: '#A78BFA', // بنفسجي فاتح
    primaryDark: '#6D28D9',  // بنفسجي أغمق
    
    // Secondary Colors
    secondary: '#A78BFA',    // بنفسجي فاتح
    secondaryLight: '#C4B5FD',
    secondaryDark: '#7C3AED',
    
    // Accent Colors
    accent: '#06B6D4',       // سماوي
    accentLight: '#22D3EE',
    accentDark: '#0891B2',
    
    // Neutral Colors (Dark Mode)
    background: '#0F172A',   // أسود مع لمسة زرقاء
    surface: '#1E293B',      // رمادي داكن
    border: '#334155',       // رمادي متوسط
    text: '#F1F5F9',         // أبيض فاتح
    textLight: '#CBD5E1',    // رمادي فاتح
    textLighter: '#94A3B8',  // رمادي متوسط
    
    // Semantic Colors
    success: '#34D399',      // أخضر نيون
    successLight: '#6EE7B7',
    successDark: '#10B981',
    
    warning: '#FBBF24',      // ذهبي
    warningLight: '#FCD34D',
    warningDark: '#F59E0B',
    
    error: '#F87171',        // أحمر فاتح
    errorLight: '#FCA5A5',
    errorDark: '#EF4444',
    
    info: '#60A5FA',         // أزرق فاتح
    infoLight: '#93C5FD',
    infoDark: '#3B82F6',
  },
  
  typography: {
    fontFamily: "'Poppins', 'Inter', 'Segoe UI', 'Arial', sans-serif",
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
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },
  
  shadows: {
    none: 'none',
    sm: '0 1px 3px 0 rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.6)',
  },
  
  transitions: {
    fast: '150ms cubic-bezier(0.34, 1.56, 0.64, 1)',
    normal: '300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
    slow: '500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  
  cssVariables: {
    '--primary': '#7C3AED',
    '--primary-light': '#A78BFA',
    '--primary-dark': '#6D28D9',
    '--secondary': '#A78BFA',
    '--secondary-light': '#C4B5FD',
    '--secondary-dark': '#7C3AED',
    '--accent': '#06B6D4',
    '--accent-light': '#22D3EE',
    '--accent-dark': '#0891B2',
    '--background': '#0F172A',
    '--surface': '#1E293B',
    '--border': '#334155',
    '--text': '#F1F5F9',
    '--text-light': '#CBD5E1',
    '--text-lighter': '#94A3B8',
    '--success': '#34D399',
    '--warning': '#FBBF24',
    '--error': '#F87171',
    '--info': '#60A5FA',
  },
};

export type ModernTheme = typeof modernTheme;
