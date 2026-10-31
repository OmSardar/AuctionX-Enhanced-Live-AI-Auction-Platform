export const formatValue = (value) =>
  Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumSignificantDigits: 3,
    notation: 'compact',
  }).format(value);

export const formatThousands = (value) =>
  Intl.NumberFormat('en-IN', {
    maximumSignificantDigits: 3,
    notation: 'compact',
  }).format(value);

export const getCssVariable = (variable) => {
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
};

const adjustHexOpacity = (hexColor, opacity) => {
  hexColor = hexColor.replace('#', '');
  const r = parseInt(hexColor.substring(0, 2), 16);
  const g = parseInt(hexColor.substring(2, 4), 16);
  const b = parseInt(hexColor.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const adjustHSLOpacity = (hslColor, opacity) => {
  return hslColor.replace('hsl(', 'hsla(').replace(')', `, ${opacity})`);
};

const adjustOKLCHOpacity = (oklchColor, opacity) => {
  return oklchColor.replace(/oklch\((.*?)\)/, (match, p1) => `oklch(${p1} / ${opacity})`);
};

const adjustRGBAOpacity = (rgbColor, opacity) => {
  return rgbColor.replace(/rgba?\(([^)]+)\)/, (match, values) => {
    const parts = values.split(',').map((v) => v.trim());
    return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${opacity})`;
  });
};

export const adjustColorOpacity = (color, opacity) => {
  if (!color || typeof color !== 'string') return `rgba(0, 0, 0, ${opacity})`;
  const trimmed = color.trim();
  if (trimmed.startsWith('#')) {
    return adjustHexOpacity(trimmed, opacity);
  } else if (trimmed.startsWith('hsl')) {
    return adjustHSLOpacity(trimmed, opacity);
  } else if (trimmed.startsWith('oklch')) {
    return adjustOKLCHOpacity(trimmed, opacity);
  } else if (trimmed.startsWith('rgb')) {
    return adjustRGBAOpacity(trimmed, opacity);
  }
  return trimmed;
};

export const oklchToRGBA = (oklchColor) => {
  const tempDiv = document.createElement('div');
  tempDiv.style.color = oklchColor;
  document.body.appendChild(tempDiv);
  const computedColor = window.getComputedStyle(tempDiv).color;
  document.body.removeChild(tempDiv);
  return computedColor;
};
