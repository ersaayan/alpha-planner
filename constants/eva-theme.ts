/**
 * Custom Eva Design System theme for Alpha Planner
 * Color palette from: https://colorhunt.co/palette/ebf4dd90ab8b5a78683b4953
 */

export const alphaTheme = {
  // Primary - Forest Green
  'color-primary-100': '#E8F0E6',
  'color-primary-200': '#D1E1CD',
  'color-primary-300': '#B0CAA9',
  'color-primary-400': '#7A9A78',
  'color-primary-500': '#5A7868',
  'color-primary-600': '#4A6556',
  'color-primary-700': '#3B5145',
  'color-primary-800': '#2D3E34',
  'color-primary-900': '#1E2A23',

  // Success - Sage Green
  'color-success-100': '#F0F5ED',
  'color-success-200': '#E0EBDA',
  'color-success-300': '#C8DBBF',
  'color-success-400': '#AECBA3',
  'color-success-500': '#90AB8B',
  'color-success-600': '#7A9575',
  'color-success-700': '#647F60',
  'color-success-800': '#4E694B',
  'color-success-900': '#385336',

  // Info - Slate Blue
  'color-info-100': '#E8EAEC',
  'color-info-200': '#D1D5D9',
  'color-info-300': '#A9B1B8',
  'color-info-400': '#6E7D88',
  'color-info-500': '#3B4953',
  'color-info-600': '#313D45',
  'color-info-700': '#283138',
  'color-info-800': '#1E262A',
  'color-info-900': '#151A1D',

  // Warning - Warm Sage
  'color-warning-100': '#F5F2E8',
  'color-warning-200': '#EBE5D1',
  'color-warning-300': '#DDD4B0',
  'color-warning-400': '#C9BC87',
  'color-warning-500': '#B5A45E',
  'color-warning-600': '#9A8B4E',
  'color-warning-700': '#7F723F',
  'color-warning-800': '#645930',
  'color-warning-900': '#494020',

  // Danger - Soft Red
  'color-danger-100': '#FCE8E8',
  'color-danger-200': '#F9D1D1',
  'color-danger-300': '#F0A8A8',
  'color-danger-400': '#E47F7F',
  'color-danger-500': '#D85656',
  'color-danger-600': '#B84848',
  'color-danger-700': '#983A3A',
  'color-danger-800': '#782D2D',
  'color-danger-900': '#581F1F',

  // Basic colors - Cream to Slate
  'color-basic-100': '#FFFFFF',
  'color-basic-200': '#F7F9F5',
  'color-basic-300': '#EBF4DD',
  'color-basic-400': '#DDE8D5',
  'color-basic-500': '#C8D9BD',
  'color-basic-600': '#90AB8B',
  'color-basic-700': '#5A7868',
  'color-basic-800': '#3B4953',
  'color-basic-900': '#2A3338',
  'color-basic-1000': '#1A2024',
  'color-basic-1100': '#0D1012',

  // Background colors
  'background-basic-color-1': '#EBF4DD',
  'background-basic-color-2': '#F7F9F5',
  'background-basic-color-3': '#FFFFFF',
  'background-basic-color-4': '#DDE8D5',

  // Text colors
  'text-basic-color': '#3B4953',
  'text-alternate-color': '#FFFFFF',
  'text-control-color': '#FFFFFF',
  'text-disabled-color': '#90AB8B',
  'text-hint-color': '#5A7868',

  // Border
  'border-basic-color-1': '#DDE8D5',
  'border-basic-color-2': '#C8D9BD',
  'border-basic-color-3': '#90AB8B',
  'border-basic-color-4': '#5A7868',
  'border-basic-color-5': '#3B4953',

  // Outline
  'outline-color': '#5A7868',
};

export const alphaDarkTheme = {
  ...alphaTheme,

  // Dark mode overrides
  'background-basic-color-1': '#1A2024',
  'background-basic-color-2': '#2A3338',
  'background-basic-color-3': '#3B4953',
  'background-basic-color-4': '#4A5A63',

  'text-basic-color': '#EBF4DD',
  'text-hint-color': '#90AB8B',
  'text-disabled-color': '#5A7868',

  'border-basic-color-1': '#3B4953',
  'border-basic-color-2': '#4A5A63',
  'border-basic-color-3': '#5A7868',
  'border-basic-color-4': '#6B8878',
  'border-basic-color-5': '#90AB8B',
};
