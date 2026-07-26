/**
 * SAP Clean Theme
 * احترافي وكلاسيكي، مستوحى من SAP
 * 
 * الخصائص:
 * - ألوان محافظة وموثوقة
 * - تصميم بسيط وواضح
 * - مناسب للبيئات الاحترافية
 */

export const sapCleanTheme = {
  name: 'sap-clean',
  label: 'SAP Clean',
  description: 'Professional and classic theme inspired by SAP',
  
  colors: {
    // Primary Colors
    primary: '#003366',      // أزرق داكن SAP
    primaryLight: '#0066CC', // أزرق فاتح
    primaryDark: '#001F3F',  // أزرق أغمق
    
    // Secondary Colors
    secondary: '#00A0DF',    // أزرق فاتح
    secondaryLight: '#33B5E5',
    secondaryDark: '#0078B8',
    
    // Accent Colors
    accent: '#F0AD4E',       // برتقالي
    accentLight: '#F5C26B',
    accentDark: '#E89B2C',
    
    // Neutral Colors
    background: '#F5F5F5',   // رمادي فاتح
    surface: '#FFFFFF',      // أبيض
    border: '#CCCCCC',       // رمادي متوسط
    text: '#333333',         // أسود داكن
    textLight: '#666666',    // رمادي داكن
    textLighter: '#999999',  // رمادي فاتح
    
    // Semantic Colors
    success: '#5CB85C',      // أخضر
    successLight: '#7FD07F',
    successDark: '#3D8B3D',
    
    warning: '#F0AD4E',      // برتقالي
    warningLight: '#F5C26B',
    warningDark: '#E89B2C',
    
    error: '#D9534F',        // أحمر
    errorLight: '#E27A77',
    errorDark: '#C9302C',
    
    info: '#5BC0DE',         // سماوي
    infoLight: '#85D4E8',
    infoDark: '#31B0D5',
  },
  
  typography: {
    fontFamily: "'Segoe UI', 'Arial', sans-serif",
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
    sm: '2px',
    md: '4px',
    lg: '6px',
    xl: '8px',
    full: '9999px',
  },
  
  shadows: {
    none: 'none',
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  },
  
  transitions: {
    fast: '150ms ease-in-out',
    normal: '300ms ease-in-out',
    slow: '500ms ease-in-out',
  },
  
  cssVariables: {
    '--primary': '#003366',
    '--primary-light': '#0066CC',
    '--primary-dark': '#001F3F',
    '--secondary': '#00A0DF',
    '--secondary-light': '#33B5E5',
    '--secondary-dark': '#0078B8',
    '--accent': '#F0AD4E',
    '--accent-light': '#F5C26B',
    '--accent-dark': '#E89B2C',
    '--background': '#F5F5F5',
    '--surface': '#FFFFFF',
    '--border': '#CCCCCC',
    '--text': '#333333',
    '--text-light': '#666666',
    '--text-lighter': '#999999',
    '--success': '#5CB85C',
    '--warning': '#F0AD4E',
    '--error': '#D9534F',
    '--info': '#5BC0DE',
  },
};

export type SapCleanTheme = typeof sapCleanTheme;
