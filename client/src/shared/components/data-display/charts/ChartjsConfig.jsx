// Import Chart.js
import { Chart, Tooltip } from 'chart.js';
// Import Tailwind config
import { adjustColorOpacity, getCssVariable } from '@/lib/chartUtils';

Chart.register(Tooltip);

// Define Chart.js default settings
Chart.defaults.font.family = '"Inter", sans-serif';
Chart.defaults.font.weight = 500;
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.displayColors = false;
Chart.defaults.plugins.tooltip.mode = 'nearest';
Chart.defaults.plugins.tooltip.intersect = false;
Chart.defaults.plugins.tooltip.position = 'nearest';
Chart.defaults.plugins.tooltip.caretSize = 0;
Chart.defaults.plugins.tooltip.caretPadding = 20;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.padding = 8;

// Function that generates a gradient for line charts
export const chartAreaGradient = (ctx, chartArea, colorStops) => {
  if (!ctx || !chartArea || !colorStops || colorStops.length === 0) {
    return 'transparent';
  }
  const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
  colorStops.forEach(({ stop, color }) => {
    gradient.addColorStop(stop, color);
  });
  return gradient;
};

export const chartColors = {
  textColor: {
    light: getCssVariable('--color-foreground-muted') || '#94a3b8',
    dark: getCssVariable('--color-foreground-muted') || '#94a3b8',
  },
  gridColor: {
    light: getCssVariable('--color-chart-grid') || '#e2e8f0',
    dark: getCssVariable('--color-chart-grid') || 'rgba(51, 65, 85, 0.60)',
  },
  backdropColor: {
    light: getCssVariable('--color-white') || '#ffffff',
    dark: getCssVariable('--color-surface-raised') || '#1f2937',
  },
  tooltipTitleColor: {
    light: getCssVariable('--color-foreground') || '#0f172a',
    dark: getCssVariable('--color-foreground') || '#f8fafc',
  },
  tooltipBodyColor: {
    light: getCssVariable('--color-foreground-secondary') || '#64748b',
    dark: getCssVariable('--color-foreground-secondary') || '#cbd5e1',
  },
  tooltipBgColor: {
    light: getCssVariable('--color-chart-tooltip-bg') || '#ffffff',
    dark: getCssVariable('--color-chart-tooltip-bg') || '#1f2937',
  },
  tooltipBorderColor: {
    light: getCssVariable('--color-chart-tooltip-border') || '#e2e8f0',
    dark: getCssVariable('--color-chart-tooltip-border') || '#334155',
  },
  series: {
    chart1: getCssVariable('--color-chart-1') || '#C65D3A',
    chart2: getCssVariable('--color-chart-2') || '#D4A373',
    chart3: getCssVariable('--color-chart-3') || '#7F3828',
    chart4: getCssVariable('--color-chart-4') || '#542B21',
    chart5: getCssVariable('--color-chart-5') || '#E8D8C3',
    chart6: getCssVariable('--color-chart-6') || '#B04E2E',
  },
};

export default chartColors;
