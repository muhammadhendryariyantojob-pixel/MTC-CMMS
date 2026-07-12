let isConverting = false;
const conversionCache = new Map<string, string>();

export function convertOklchToRgb(cssString: string | null): string {
  if (!cssString) return '';
  if (isConverting) return cssString;
  if (!cssString.includes('oklch')) return cssString;

  if (conversionCache.has(cssString)) {
    return conversionCache.get(cssString)!;
  }

  isConverting = true;
  try {
    let tempEl = document.getElementById('oklch-converter-temp');
    if (!tempEl) {
      tempEl = document.createElement('div');
      tempEl.id = 'oklch-converter-temp';
      tempEl.style.display = 'none';
      document.body.appendChild(tempEl);
    }

    const converted = cssString.replace(/oklch\([^)]+\)/g, (match) => {
      try {
        tempEl!.style.color = '';
        tempEl!.style.color = match;
        const resolved = window.getComputedStyle(tempEl!).color;
        return resolved || match;
      } catch (e) {
        return match;
      }
    });

    conversionCache.set(cssString, converted);
    return converted;
  } catch (e) {
    console.error('Error converting oklch to rgb:', e);
    return cssString;
  } finally {
    isConverting = false;
  }
}

export function applyOklchPatch() {
  if (typeof window === 'undefined') return;

  try {
    // 1. Patch CSSRule.prototype.cssText
    const cssRuleDesc = Object.getOwnPropertyDescriptor(CSSRule.prototype, 'cssText');
    if (cssRuleDesc && cssRuleDesc.get) {
      const originalGet = cssRuleDesc.get;
      Object.defineProperty(CSSRule.prototype, 'cssText', {
        get() {
          const raw = originalGet.call(this);
          return convertOklchToRgb(raw);
        },
        configurable: true
      });
    }

    // 2. Patch CSSStyleDeclaration.prototype.cssText
    const styleDesc = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'cssText');
    if (styleDesc && styleDesc.get) {
      const originalGet = styleDesc.get;
      Object.defineProperty(CSSStyleDeclaration.prototype, 'cssText', {
        get() {
          const raw = originalGet.call(this);
          return convertOklchToRgb(raw);
        },
        configurable: true
      });
    }

    // 3. Patch CSSStyleDeclaration.prototype.getPropertyValue
    if (CSSStyleDeclaration.prototype.getPropertyValue) {
      const originalGetPropertyValue = CSSStyleDeclaration.prototype.getPropertyValue;
      CSSStyleDeclaration.prototype.getPropertyValue = function (property: string) {
        const raw = originalGetPropertyValue.call(this, property);
        return convertOklchToRgb(raw);
      };
    }
  } catch (err) {
    console.error('Failed to apply oklch color function patch:', err);
  }
}
