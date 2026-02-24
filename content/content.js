/*
 * DOM Structure Visualizer - Content Script
 * Handles all DOM interaction, highlighting, and label creation.
 * Supports custom color themes via CSS custom properties.
 */

(function () {
  'use strict';

  // Prevent double-injection
  if (window.__DSV_INITIALIZED__) return;
  window.__DSV_INITIALIZED__ = true;

  // ===== STATE =====
  const state = {
    enabled: false,
    showLabels: true,
    highlightParents: true,
    highlightChildren: true,
    parentDepth: 2,
    colorScheme: 'default',
    customColors: {
      self: '#2196F3',
      parent: '#FF9800',
      child: '#4CAF50'
    },
    currentTarget: null,
    highlightedElements: [],
    labels: [],
    overlayContainer: null,
    styleElement: null,
    rafId: null,
    isProcessing: false
  };

  // ===== CONSTANTS =====
  const HIGHLIGHT_CLASSES = {
    self: 'dsv-highlight-self',
    parent1: 'dsv-highlight-parent-1',
    parent2: 'dsv-highlight-parent-2',
    parent3: 'dsv-highlight-parent-3',
    child: 'dsv-highlight-child'
  };

  const PARENT_CLASSES = [
    HIGHLIGHT_CLASSES.parent1,
    HIGHLIGHT_CLASSES.parent2,
    HIGHLIGHT_CLASSES.parent3
  ];

  const SCHEME_CLASS_PREFIX = 'dsv-scheme-';

  // Tags to ignore for highlighting
  const IGNORED_TAGS = new Set([
    'HTML', 'HEAD', 'SCRIPT', 'STYLE', 'LINK', 'META', 'TITLE', 'NOSCRIPT', 'BR', 'HR'
  ]);

  // ===== CUSTOM COLOR STYLE INJECTION =====

  /**
   * Creates or updates a <style> element for custom color overrides.
   */
  function applyCustomColorStyles() {
    if (state.colorScheme !== 'custom') {
      removeCustomColorStyles();
      return;
    }

    const c = state.customColors;
    const css = `
      .dsv-highlight-self {
        outline-color: ${c.self} !important;
      }
      .dsv-highlight-parent-1 {
        outline-color: ${c.parent} !important;
        outline: 2px solid ${hexToRgba(c.parent, 0.85)} !important;
        outline-offset: -1px !important;
      }
      .dsv-highlight-parent-2 {
        outline-color: ${c.parent} !important;
        outline: 2px solid ${hexToRgba(c.parent, 0.55)} !important;
        outline-offset: -1px !important;
      }
      .dsv-highlight-parent-3 {
        outline-color: ${c.parent} !important;
        outline: 1.5px solid ${hexToRgba(c.parent, 0.35)} !important;
        outline-offset: -1px !important;
      }
      .dsv-highlight-child {
        outline: 2px solid ${hexToRgba(c.child, 0.8)} !important;
        outline-offset: -1px !important;
      }
      .dsv-label-self {
        background: ${c.self} !important;
        border-color: ${darkenHex(c.self, 20)} !important;
      }
      .dsv-label-parent {
        background: ${c.parent} !important;
        border-color: ${darkenHex(c.parent, 20)} !important;
      }
      .dsv-label-child {
        background: ${c.child} !important;
        border-color: ${darkenHex(c.child, 20)} !important;
      }
    `;

    if (!state.styleElement) {
      state.styleElement = document.createElement('style');
      state.styleElement.setAttribute('data-dsv-custom-styles', 'true');
      document.head.appendChild(state.styleElement);
    }
    state.styleElement.textContent = css;
  }

  function removeCustomColorStyles() {
    if (state.styleElement && state.styleElement.parentNode) {
      state.styleElement.parentNode.removeChild(state.styleElement);
    }
    state.styleElement = null;
  }

  // ===== COLOR UTILITIES =====

  function hexToRgba(hex, alpha) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const num = parseInt(hex, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function darkenHex(hex, amount) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const num = parseInt(hex, 16);
    let r = Math.max(0, ((num >> 16) & 255) - amount);
    let g = Math.max(0, ((num >> 8) & 255) - amount);
    let b = Math.max(0, (num & 255) - amount);
    return '#' + [r, g, b].map(x => {
      const h = x.toString(16);
      return h.length === 1 ? '0' + h : h;
    }).join('');
  }

  // ===== OVERLAY CONTAINER MANAGEMENT =====

  function getOverlayContainer() {
    if (state.overlayContainer && document.body.contains(state.overlayContainer)) {
      return state.overlayContainer;
    }
    const container = document.createElement('div');
    container.className = 'dsv-overlay-container';
    container.setAttribute('data-dsv-overlay', 'true');
    document.body.appendChild(container);
    state.overlayContainer = container;
    return container;
  }

  function removeOverlayContainer() {
    if (state.overlayContainer && state.overlayContainer.parentNode) {
      state.overlayContainer.parentNode.removeChild(state.overlayContainer);
    }
    state.overlayContainer = null;
  }

  // ===== UTILITY FUNCTIONS =====

  function isDSVElement(el) {
    if (!el || !el.classList) return false;
    return el.hasAttribute('data-dsv-overlay') ||
           el.hasAttribute('data-dsv-custom-styles') ||
           el.classList.contains('dsv-label') ||
           el.classList.contains('dsv-overlay-container');
  }

  function shouldIgnore(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return true;
    if (IGNORED_TAGS.has(el.tagName)) return true;
    if (isDSVElement(el)) return true;
    return false;
  }

  function getElementRect(el) {
    const rect = el.getBoundingClientRect();
    return {
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom,
      right: rect.right,
      width: rect.width,
      height: rect.height
    };
  }

  // ===== CLEANUP =====

  function clearHighlights() {
    const allClasses = [
      HIGHLIGHT_CLASSES.self,
      ...PARENT_CLASSES,
      HIGHLIGHT_CLASSES.child
    ];

    for (const el of state.highlightedElements) {
      if (el && el.classList) {
        for (const cls of allClasses) {
          el.classList.remove(cls);
        }
      }
    }
    state.highlightedElements = [];
  }

  function clearLabels() {
    for (const label of state.labels) {
      if (label && label.parentNode) {
        label.parentNode.removeChild(label);
      }
    }
    state.labels = [];
  }

  function fullCleanup() {
    clearHighlights();
    clearLabels();
    removeOverlayContainer();
    removeColorSchemeClass();
    removeCustomColorStyles();
    state.currentTarget = null;
  }

  // ===== COLOR SCHEME =====

  function applyColorSchemeClass() {
    removeColorSchemeClass();
    if (state.colorScheme === 'custom') {
      applyCustomColorStyles();
    } else {
      removeCustomColorStyles();
      if (state.colorScheme && state.colorScheme !== 'default') {
        document.body.classList.add(`${SCHEME_CLASS_PREFIX}${state.colorScheme}`);
      }
    }
  }

  function removeColorSchemeClass() {
    const classes = Array.from(document.body.classList)
      .filter(c => c.startsWith(SCHEME_CLASS_PREFIX));
    for (const c of classes) {
      document.body.classList.remove(c);
    }
  }

  // ===== LABEL CREATION =====

  function createLabel(el, type, rect) {
    const label = document.createElement('div');
    label.className = `dsv-label dsv-label-${type}`;
    label.setAttribute('data-dsv-overlay', 'true');

    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const classes = Array.from(el.classList)
      .filter(c => !c.startsWith('dsv-'))
      .slice(0, 3)
      .map(c => `.${c}`)
      .join('');

    let html = `<span class="dsv-label-tag">&lt;${tag}&gt;</span>`;
    if (id) {
      html += ` <span class="dsv-label-id">${id}</span>`;
    }
    if (classes) {
      html += ` <span class="dsv-label-class">${classes}</span>`;
    }

    if (type === 'self') {
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      html += ` <span class="dsv-label-dimensions">${w}×${h}</span>`;
    }

    label.innerHTML = html;
    positionLabel(label, type, rect);

    return label;
  }

  function positionLabel(label, type, rect) {
    let top, left;

    switch (type) {
      case 'self':
        top = rect.top - 22;
        if (top < 2) {
          top = rect.bottom + 2;
        }
        left = rect.left;
        break;

      case 'parent':
        top = rect.top - 20;
        if (top < 2) top = rect.top + 2;
        left = rect.right - 120;
        if (left < 2) left = rect.left;
        break;

      case 'child':
        top = rect.top + 2;
        left = rect.left + 2;
        break;

      default:
        top = rect.top;
        left = rect.left;
    }

    left = Math.max(2, Math.min(left, window.innerWidth - 200));
    top = Math.max(2, Math.min(top, window.innerHeight - 24));

    label.style.cssText = `
      top: ${top}px !important;
      left: ${left}px !important;
      position: fixed !important;
    `;
  }

  // ===== HIGHLIGHTING LOGIC =====

  function highlightElement(target) {
    if (shouldIgnore(target)) return;
    if (target === state.currentTarget) return;
    if (state.isProcessing) return;

    state.isProcessing = true;
    state.currentTarget = target;

    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
    }

    state.rafId = requestAnimationFrame(() => {
      performHighlight(target);
      state.isProcessing = false;
    });
  }

  function performHighlight(target) {
    clearHighlights();
    clearLabels();

    if (!target || shouldIgnore(target)) return;

    const container = getOverlayContainer();

    // 1. Highlight the hovered element
    target.classList.add(HIGHLIGHT_CLASSES.self);
    state.highlightedElements.push(target);

    if (state.showLabels) {
      const selfRect = getElementRect(target);
      const selfLabel = createLabel(target, 'self', selfRect);
      container.appendChild(selfLabel);
      state.labels.push(selfLabel);
      requestAnimationFrame(() => selfLabel.classList.add('dsv-label-visible'));
    }

    // 2. Highlight parent elements
    if (state.highlightParents) {
      let parent = target.parentElement;
      let depth = 0;

      while (parent && depth < state.parentDepth && parent !== document.body && parent !== document.documentElement) {
        if (!shouldIgnore(parent)) {
          const parentClass = PARENT_CLASSES[Math.min(depth, PARENT_CLASSES.length - 1)];
          parent.classList.add(parentClass);
          state.highlightedElements.push(parent);

          if (state.showLabels) {
            const parentRect = getElementRect(parent);
            const parentLabel = createLabel(parent, 'parent', parentRect);
            container.appendChild(parentLabel);
            state.labels.push(parentLabel);
            requestAnimationFrame(() => parentLabel.classList.add('dsv-label-visible'));
          }

          depth++;
        }
        parent = parent.parentElement;
      }
    }

    // 3. Highlight direct children
    if (state.highlightChildren) {
      const children = Array.from(target.children);
      const maxChildren = 20;
      const displayChildren = children.slice(0, maxChildren);

      for (const child of displayChildren) {
        if (!shouldIgnore(child) && !isDSVElement(child)) {
          child.classList.add(HIGHLIGHT_CLASSES.child);
          state.highlightedElements.push(child);

          if (state.showLabels && displayChildren.length <= 8) {
            const childRect = getElementRect(child);
            if (childRect.width > 20 && childRect.height > 15) {
              const childLabel = createLabel(child, 'child', childRect);
              container.appendChild(childLabel);
              state.labels.push(childLabel);
              requestAnimationFrame(() => childLabel.classList.add('dsv-label-visible'));
            }
          }
        }
      }
    }
  }

  // ===== EVENT HANDLERS =====

  let lastMoveTime = 0;
  const THROTTLE_MS = 40;

  function onMouseMove(e) {
    if (!state.enabled) return;

    const now = Date.now();
    if (now - lastMoveTime < THROTTLE_MS) return;
    lastMoveTime = now;

    highlightElement(e.target);
  }

  function onMouseOut(e) {
    if (!state.enabled) return;

    if (e.relatedTarget === null || e.relatedTarget === document.documentElement) {
      if (state.rafId) cancelAnimationFrame(state.rafId);
      clearHighlights();
      clearLabels();
      state.currentTarget = null;
      state.isProcessing = false;
    }
  }

  let scrollRafId = null;

  function onScroll() {
    if (!state.enabled || !state.currentTarget || !state.showLabels) return;

    if (scrollRafId) cancelAnimationFrame(scrollRafId);

    scrollRafId = requestAnimationFrame(() => {
      if (state.currentTarget && document.body.contains(state.currentTarget)) {
        performHighlight(state.currentTarget);
      }
      scrollRafId = null;
    });
  }

  // ===== ENABLE / DISABLE =====

  function enable() {
    state.enabled = true;
    applyColorSchemeClass();

    document.addEventListener('mousemove', onMouseMove, { passive: true, capture: true });
    document.addEventListener('mouseout', onMouseOut, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', onScroll, { passive: true });
  }

  function disable() {
    state.enabled = false;

    document.removeEventListener('mousemove', onMouseMove, { capture: true });
    document.removeEventListener('mouseout', onMouseOut);
    window.removeEventListener('scroll', onScroll, { capture: true });
    window.removeEventListener('resize', onScroll);

    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
    if (scrollRafId) {
      cancelAnimationFrame(scrollRafId);
      scrollRafId = null;
    }

    fullCleanup();
  }

  // ===== MUTATION OBSERVER =====

  let mutationObserver = null;

  function startMutationObserver() {
    if (mutationObserver) return;

    mutationObserver = new MutationObserver((mutations) => {
      if (!state.enabled || !state.currentTarget) return;

      let targetRemoved = false;
      for (const mutation of mutations) {
        for (const node of mutation.removedNodes) {
          if (node === state.currentTarget || (node.contains && node.contains(state.currentTarget))) {
            targetRemoved = true;
            break;
          }
        }
        if (targetRemoved) break;
      }

      if (targetRemoved) {
        clearHighlights();
        clearLabels();
        state.currentTarget = null;
        state.isProcessing = false;
      }
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function stopMutationObserver() {
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
  }

  // ===== MESSAGE HANDLING =====

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'STATE_CHANGED') {
      const payload = message.payload;

      if (payload.showLabels !== undefined) state.showLabels = payload.showLabels;
      if (payload.highlightParents !== undefined) state.highlightParents = payload.highlightParents;
      if (payload.highlightChildren !== undefined) state.highlightChildren = payload.highlightChildren;
      if (payload.parentDepth !== undefined) state.parentDepth = payload.parentDepth;

      if (payload.customColors !== undefined) {
        state.customColors = payload.customColors;
        if (state.enabled && state.colorScheme === 'custom') {
          applyCustomColorStyles();
        }
      }

      if (payload.colorScheme !== undefined) {
        state.colorScheme = payload.colorScheme;
        if (state.enabled) applyColorSchemeClass();
      }

      if (payload.enabled !== undefined) {
        if (payload.enabled && !state.enabled) {
          enable();
          startMutationObserver();
        } else if (!payload.enabled && state.enabled) {
          disable();
          stopMutationObserver();
        }
      }

      // Re-highlight current target with new settings
      if (state.enabled && state.currentTarget && document.body.contains(state.currentTarget)) {
        const target = state.currentTarget;
        state.currentTarget = null;
        highlightElement(target);
      }

      sendResponse({ success: true });
    }

    if (message.type === 'PING') {
      sendResponse({ alive: true });
    }

    if (message.type === 'GET_CONTENT_STATE') {
      sendResponse({
        enabled: state.enabled,
        showLabels: state.showLabels,
        highlightParents: state.highlightParents,
        highlightChildren: state.highlightChildren,
        parentDepth: state.parentDepth,
        colorScheme: state.colorScheme,
        customColors: state.customColors
      });
    }
  });

  // ===== INITIALIZATION =====

  function initialize() {
    chrome.storage.local.get([
      'enabled',
      'showLabels',
      'highlightParents',
      'highlightChildren',
      'parentDepth',
      'colorScheme',
      'customColors'
    ], (result) => {
      if (chrome.runtime.lastError) return;

      state.showLabels = result.showLabels !== undefined ? result.showLabels : true;
      state.highlightParents = result.highlightParents !== undefined ? result.highlightParents : true;
      state.highlightChildren = result.highlightChildren !== undefined ? result.highlightChildren : true;
      state.parentDepth = result.parentDepth !== undefined ? result.parentDepth : 2;
      state.colorScheme = result.colorScheme || 'default';
      state.customColors = result.customColors || {
        self: '#2196F3',
        parent: '#FF9800',
        child: '#4CAF50'
      };

      if (result.enabled) {
        enable();
        startMutationObserver();
      }
    });
  }

  window.addEventListener('beforeunload', () => {
    disable();
    stopMutationObserver();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();