/*
 * DOM Structure Visualizer - Options Page Script
 * Handles advanced settings including custom color themes.
 */

(function () {
  'use strict';

  // ===== DEFAULT CUSTOM COLORS =====
  const DEFAULT_CUSTOM_COLORS = {
    self: '#2196F3',
    parent: '#FF9800',
    child: '#4CAF50'
  };

  const SCHEME_COLORS = {
    default: { self: '#2196F3', parent: '#FF9800', child: '#4CAF50' },
    neon: { self: '#00E5FF', parent: '#FF00FF', child: '#00FF00' },
    highcontrast: { self: '#FFFF00', parent: '#FF0000', child: '#00FFFF' }
  };

  // ===== STATE =====
  let state = {
    showLabels: true,
    highlightParents: true,
    highlightChildren: true,
    parentDepth: 2,
    colorScheme: 'default',
    customColors: { ...DEFAULT_CUSTOM_COLORS }
  };

  // ===== DOM ELEMENTS =====
  const els = {
    showLabels: document.getElementById('optShowLabels'),
    highlightParents: document.getElementById('optHighlightParents'),
    highlightChildren: document.getElementById('optHighlightChildren'),
    depthMinus: document.getElementById('optDepthMinus'),
    depthPlus: document.getElementById('optDepthPlus'),
    depthValue: document.getElementById('optDepthValue'),
    schemeCards: document.querySelectorAll('.scheme-card'),
    customColorsSection: document.getElementById('customColorsSection'),
    resetCustomColors: document.getElementById('resetCustomColors'),
    saveStatus: document.getElementById('saveStatus'),
    // Color inputs - Self
    hexSelf: document.getElementById('hexSelf'),
    rSelf: document.getElementById('rSelf'),
    gSelf: document.getElementById('gSelf'),
    bSelf: document.getElementById('bSelf'),
    pickerSelf: document.getElementById('pickerSelf'),
    previewSelf: document.getElementById('previewSelf'),
    // Color inputs - Parent
    hexParent: document.getElementById('hexParent'),
    rParent: document.getElementById('rParent'),
    gParent: document.getElementById('gParent'),
    bParent: document.getElementById('bParent'),
    pickerParent: document.getElementById('pickerParent'),
    previewParent: document.getElementById('previewParent'),
    // Color inputs - Child
    hexChild: document.getElementById('hexChild'),
    rChild: document.getElementById('rChild'),
    gChild: document.getElementById('gChild'),
    bChild: document.getElementById('bChild'),
    pickerChild: document.getElementById('pickerChild'),
    previewChild: document.getElementById('previewChild'),
    // Custom scheme preview swatches
    customPreviewSelf: document.getElementById('customPreviewSelf'),
    customPreviewParent: document.getElementById('customPreviewParent'),
    customPreviewChild: document.getElementById('customPreviewChild'),
    // Live preview elements
    previewSelfEl: document.getElementById('previewSelfEl'),
    previewParent1El: document.getElementById('previewParent1El'),
    previewParent2El: document.getElementById('previewParent2El'),
    previewChild1El: document.getElementById('previewChild1El'),
    previewChild2El: document.getElementById('previewChild2El'),
    previewLabelSelf: document.getElementById('previewLabelSelf'),
    previewLabelParent1: document.getElementById('previewLabelParent1'),
    previewLabelParent2: document.getElementById('previewLabelParent2'),
    previewLabelChild1: document.getElementById('previewLabelChild1'),
    previewLabelChild2: document.getElementById('previewLabelChild2')
  };

  // ===== I18N =====

  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const message = chrome.i18n.getMessage(key);
      if (message) el.textContent = message;
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      const message = chrome.i18n.getMessage(key);
      if (message) el.setAttribute('title', message);
    });

    // Page title
    const pageTitle = chrome.i18n.getMessage('optionsPageTitle');
    if (pageTitle) document.title = pageTitle;
  }

  // ===== COLOR UTILITIES =====

  function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const num = parseInt(hex, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
      const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('').toUpperCase();
  }

  function isValidHex(hex) {
    return /^#[0-9A-Fa-f]{6}$/.test(hex);
  }

  // ===== SAVE STATUS TOAST =====

  let saveStatusTimeout = null;

  function showSaveStatus() {
    els.saveStatus.classList.add('visible');
    if (saveStatusTimeout) clearTimeout(saveStatusTimeout);
    saveStatusTimeout = setTimeout(() => {
      els.saveStatus.classList.remove('visible');
    }, 1500);
  }

  // ===== SAVE STATE =====

  function saveState(payload) {
    chrome.storage.local.set(payload, () => {
      if (chrome.runtime.lastError) {
        console.warn('DSV Options: Save error:', chrome.runtime.lastError.message);
        return;
      }
      showSaveStatus();

      // Broadcast to active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'STATE_CHANGED',
            payload: payload
          }).catch(() => {});
        }
      });
    });
  }

  // ===== UPDATE COLOR INPUTS =====

  function updateColorInputs(type, hex) {
    const rgb = hexToRgb(hex);

    switch (type) {
      case 'self':
        els.hexSelf.value = hex;
        els.rSelf.value = rgb.r;
        els.gSelf.value = rgb.g;
        els.bSelf.value = rgb.b;
        els.pickerSelf.value = hex;
        els.previewSelf.style.background = hex;
        els.hexSelf.classList.remove('invalid');
        break;
      case 'parent':
        els.hexParent.value = hex;
        els.rParent.value = rgb.r;
        els.gParent.value = rgb.g;
        els.bParent.value = rgb.b;
        els.pickerParent.value = hex;
        els.previewParent.style.background = hex;
        els.hexParent.classList.remove('invalid');
        break;
      case 'child':
        els.hexChild.value = hex;
        els.rChild.value = rgb.r;
        els.gChild.value = rgb.g;
        els.bChild.value = rgb.b;
        els.pickerChild.value = hex;
        els.previewChild.style.background = hex;
        els.hexChild.classList.remove('invalid');
        break;
    }

    // Update custom scheme preview swatches
    els.customPreviewSelf.style.background = state.customColors.self;
    els.customPreviewParent.style.background = state.customColors.parent;
    els.customPreviewChild.style.background = state.customColors.child;
  }

  // ===== UPDATE LIVE PREVIEW =====

  function updateLivePreview() {
    let colors;
    if (state.colorScheme === 'custom') {
      colors = state.customColors;
    } else {
      colors = SCHEME_COLORS[state.colorScheme] || SCHEME_COLORS.default;
    }

    // Self
    els.previewSelfEl.style.outlineColor = colors.self;
    els.previewLabelSelf.style.background = colors.self;

    // Parents
    const parentOpacities = [0.7, 0.4];
    els.previewParent1El.style.outlineColor = colors.parent;
    els.previewParent1El.style.outlineStyle = 'solid';
    els.previewLabelParent1.style.background = colors.parent;

    els.previewParent2El.style.outlineColor = colors.parent;
    els.previewParent2El.style.outlineStyle = 'solid';
    els.previewParent2El.style.opacity = '';
    els.previewLabelParent2.style.background = colors.parent;
    els.previewLabelParent2.style.opacity = '0.7';

    // Children
    els.previewChild1El.style.outlineColor = colors.child;
    els.previewLabelChild1.style.background = colors.child;

    els.previewChild2El.style.outlineColor = colors.child;
    els.previewLabelChild2.style.background = colors.child;
  }

  // ===== UPDATE UI =====

  function updateUI() {
    els.showLabels.checked = state.showLabels;
    els.highlightParents.checked = state.highlightParents;
    els.highlightChildren.checked = state.highlightChildren;
    els.depthValue.textContent = state.parentDepth;
    els.depthMinus.disabled = state.parentDepth <= 1;
    els.depthPlus.disabled = state.parentDepth >= 5;

    // Scheme cards
    els.schemeCards.forEach(card => {
      if (card.dataset.scheme === state.colorScheme) {
        card.classList.add('scheme-card-active');
      } else {
        card.classList.remove('scheme-card-active');
      }
    });

    // Custom colors section visibility
    els.customColorsSection.style.display = state.colorScheme === 'custom' ? '' : 'none';

    // Update all color inputs
    updateColorInputs('self', state.customColors.self);
    updateColorInputs('parent', state.customColors.parent);
    updateColorInputs('child', state.customColors.child);

    // Live preview
    updateLivePreview();
  }

  // ===== LOAD STATE =====

  function loadState() {
    chrome.storage.local.get([
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
      state.customColors = result.customColors || { ...DEFAULT_CUSTOM_COLORS };

      updateUI();
    });
  }

  // ===== CUSTOM COLOR CHANGE HANDLER =====

  function onCustomColorChange(type, hex) {
    if (!isValidHex(hex)) return;

    state.customColors[type] = hex;
    updateColorInputs(type, hex);
    updateLivePreview();
    saveState({ customColors: state.customColors });
  }

  // ===== EVENT LISTENERS =====

  function setupEventListeners() {
    // General settings
    els.showLabels.addEventListener('change', (e) => {
      state.showLabels = e.target.checked;
      saveState({ showLabels: state.showLabels });
    });

    els.highlightParents.addEventListener('change', (e) => {
      state.highlightParents = e.target.checked;
      saveState({ highlightParents: state.highlightParents });
    });

    els.highlightChildren.addEventListener('change', (e) => {
      state.highlightChildren = e.target.checked;
      saveState({ highlightChildren: state.highlightChildren });
    });

    els.depthMinus.addEventListener('click', () => {
      if (state.parentDepth > 1) {
        state.parentDepth--;
        updateUI();
        saveState({ parentDepth: state.parentDepth });
      }
    });

    els.depthPlus.addEventListener('click', () => {
      if (state.parentDepth < 5) {
        state.parentDepth++;
        updateUI();
        saveState({ parentDepth: state.parentDepth });
      }
    });

    // Scheme selection
    els.schemeCards.forEach(card => {
      card.addEventListener('click', () => {
        state.colorScheme = card.dataset.scheme;
        updateUI();
        saveState({ colorScheme: state.colorScheme });
      });
    });

    // Reset custom colors
    els.resetCustomColors.addEventListener('click', () => {
      state.customColors = { ...DEFAULT_CUSTOM_COLORS };
      updateUI();
      saveState({ customColors: state.customColors });
    });

    // ===== Color inputs: Self =====
    els.hexSelf.addEventListener('input', (e) => {
      let val = e.target.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (isValidHex(val)) {
        els.hexSelf.classList.remove('invalid');
        onCustomColorChange('self', val.toUpperCase());
      } else {
        els.hexSelf.classList.add('invalid');
      }
    });

    els.rSelf.addEventListener('input', () => {
      const hex = rgbToHex(+els.rSelf.value, +els.gSelf.value, +els.bSelf.value);
      onCustomColorChange('self', hex);
    });
    els.gSelf.addEventListener('input', () => {
      const hex = rgbToHex(+els.rSelf.value, +els.gSelf.value, +els.bSelf.value);
      onCustomColorChange('self', hex);
    });
    els.bSelf.addEventListener('input', () => {
      const hex = rgbToHex(+els.rSelf.value, +els.gSelf.value, +els.bSelf.value);
      onCustomColorChange('self', hex);
    });

    els.pickerSelf.addEventListener('input', (e) => {
      onCustomColorChange('self', e.target.value.toUpperCase());
    });

    // ===== Color inputs: Parent =====
    els.hexParent.addEventListener('input', (e) => {
      let val = e.target.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (isValidHex(val)) {
        els.hexParent.classList.remove('invalid');
        onCustomColorChange('parent', val.toUpperCase());
      } else {
        els.hexParent.classList.add('invalid');
      }
    });

    els.rParent.addEventListener('input', () => {
      const hex = rgbToHex(+els.rParent.value, +els.gParent.value, +els.bParent.value);
      onCustomColorChange('parent', hex);
    });
    els.gParent.addEventListener('input', () => {
      const hex = rgbToHex(+els.rParent.value, +els.gParent.value, +els.bParent.value);
      onCustomColorChange('parent', hex);
    });
    els.bParent.addEventListener('input', () => {
      const hex = rgbToHex(+els.rParent.value, +els.gParent.value, +els.bParent.value);
      onCustomColorChange('parent', hex);
    });

    els.pickerParent.addEventListener('input', (e) => {
      onCustomColorChange('parent', e.target.value.toUpperCase());
    });

    // ===== Color inputs: Child =====
    els.hexChild.addEventListener('input', (e) => {
      let val = e.target.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (isValidHex(val)) {
        els.hexChild.classList.remove('invalid');
        onCustomColorChange('child', val.toUpperCase());
      } else {
        els.hexChild.classList.add('invalid');
      }
    });

    els.rChild.addEventListener('input', () => {
      const hex = rgbToHex(+els.rChild.value, +els.gChild.value, +els.bChild.value);
      onCustomColorChange('child', hex);
    });
    els.gChild.addEventListener('input', () => {
      const hex = rgbToHex(+els.rChild.value, +els.gChild.value, +els.bChild.value);
      onCustomColorChange('child', hex);
    });
    els.bChild.addEventListener('input', () => {
      const hex = rgbToHex(+els.rChild.value, +els.gChild.value, +els.bChild.value);
      onCustomColorChange('child', hex);
    });

    els.pickerChild.addEventListener('input', (e) => {
      onCustomColorChange('child', e.target.value.toUpperCase());
    });
  }

  // ===== INIT =====

  function init() {
    applyI18n();
    setupEventListeners();
    loadState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();