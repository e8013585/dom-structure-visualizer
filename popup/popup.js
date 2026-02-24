/*
 * DOM Structure Visualizer - Popup Script
 * Handles popup UI interactions, i18n, and communication with background/content scripts.
 */

(function () {
  'use strict';

  // ===== COLOR SCHEME DEFINITIONS =====
  const SCHEME_COLORS = {
    default: {
      self: '#2196F3',
      parent: '#FF9800',
      child: '#4CAF50'
    },
    neon: {
      self: '#00E5FF',
      parent: '#FF00FF',
      child: '#00FF00'
    },
    highcontrast: {
      self: '#FFFF00',
      parent: '#FF0000',
      child: '#00FFFF'
    }
  };

  // ===== LOCALE CONFIGURATION =====
  const SUPPORTED_LOCALES = {
    en: { name: 'English', dir: 'ltr' },
    am: { name: 'Amharic', dir: 'ltr' },
    ar: { name: 'Arabic', dir: 'rtl' },
    bn: { name: 'Bangla', dir: 'ltr' },
    bg: { name: 'Bulgarian', dir: 'ltr' },
    ca: { name: 'Catalan', dir: 'ltr' },
    zh_CN: { name: 'Chinese (China)', dir: 'ltr' },
    zh_TW: { name: 'Chinese (Taiwan)', dir: 'ltr' },
    hr: { name: 'Croatian', dir: 'ltr' },
    cs: { name: 'Czech', dir: 'ltr' },
    da: { name: 'Danish', dir: 'ltr' },
    nl: { name: 'Dutch', dir: 'ltr' },
    et: { name: 'Estonian', dir: 'ltr' },
    fil: { name: 'Filipino', dir: 'ltr' },
    fi: { name: 'Finnish', dir: 'ltr' },
    fr: { name: 'French', dir: 'ltr' },
    de: { name: 'German', dir: 'ltr' },
    el: { name: 'Greek', dir: 'ltr' },
    gu: { name: 'Gujarati', dir: 'ltr' },
    he: { name: 'Hebrew', dir: 'rtl' },
    hi: { name: 'Hindi', dir: 'ltr' },
    hu: { name: 'Hungarian', dir: 'ltr' },
    id: { name: 'Indonesian', dir: 'ltr' },
    it: { name: 'Italian', dir: 'ltr' },
    ja: { name: 'Japanese', dir: 'ltr' },
    kn: { name: 'Kannada', dir: 'ltr' },
    ko: { name: 'Korean', dir: 'ltr' },
    lv: { name: 'Latvian', dir: 'ltr' },
    lt: { name: 'Lithuanian', dir: 'ltr' },
    ms: { name: 'Malay', dir: 'ltr' },
    ml: { name: 'Malayalam', dir: 'ltr' },
    mr: { name: 'Marathi', dir: 'ltr' },
    no: { name: 'Norwegian', dir: 'ltr' },
    fa: { name: 'Persian', dir: 'rtl' },
    pl: { name: 'Polish', dir: 'ltr' },
    pt_BR: { name: 'Portuguese (Brazil)', dir: 'ltr' },
    pt_PT: { name: 'Portuguese (Portugal)', dir: 'ltr' },
    ro: { name: 'Romanian', dir: 'ltr' },
    ru: { name: 'Russian', dir: 'ltr' },
    sr: { name: 'Serbian', dir: 'ltr' },
    sk: { name: 'Slovak', dir: 'ltr' },
    sl: { name: 'Slovenian', dir: 'ltr' },
    es: { name: 'Spanish', dir: 'ltr' },
    sw: { name: 'Swahili', dir: 'ltr' },
    sv: { name: 'Swedish', dir: 'ltr' },
    ta: { name: 'Tamil', dir: 'ltr' },
    te: { name: 'Telugu', dir: 'ltr' },
    th: { name: 'Thai', dir: 'ltr' },
    tr: { name: 'Turkish', dir: 'ltr' },
    uk: { name: 'Ukrainian', dir: 'ltr' },
    uz: { name: 'Uzbek', dir: 'ltr' },
    vi: { name: 'Vietnamese', dir: 'ltr' },
    tt: { name: 'Tatar', dir: 'ltr' },
    tk: { name: 'Turkmen', dir: 'ltr' }
  };

  // ===== DOM ELEMENTS =====
  const elements = {
    toggleBtn: document.getElementById('toggleBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    statusBar: document.getElementById('statusBar'),
    statusText: document.getElementById('statusText'),
    showLabels: document.getElementById('showLabels'),
    highlightParents: document.getElementById('highlightParents'),
    highlightChildren: document.getElementById('highlightChildren'),
    depthMinus: document.getElementById('depthMinus'),
    depthPlus: document.getElementById('depthPlus'),
    depthValue: document.getElementById('depthValue'),
    schemeBtns: document.querySelectorAll('.scheme-btn'),
    legendSelf: document.getElementById('legendSelf'),
    legendParent: document.getElementById('legendParent'),
    legendChild: document.getElementById('legendChild')
  };

  // ===== LOCAL STATE =====
  let currentState = {
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
    }
  };

  // ===== I18N =====

  function applyI18n() {
    const uiLocale = chrome.i18n.getUILanguage().replace('-', '_');
    const localeBase = uiLocale.split('_')[0];

    let isRTL = false;
    if (SUPPORTED_LOCALES[uiLocale]) {
      isRTL = SUPPORTED_LOCALES[uiLocale].dir === 'rtl';
    } else if (SUPPORTED_LOCALES[localeBase]) {
      isRTL = SUPPORTED_LOCALES[localeBase].dir === 'rtl';
    }

    document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', localeBase);

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const message = chrome.i18n.getMessage(key);
      if (message) {
        el.textContent = message;
      }
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      const message = chrome.i18n.getMessage(key);
      if (message) {
        el.setAttribute('title', message);
      }
    });
  }

  // ===== LEGEND COLORS =====

  function updateLegendColors() {
    let colors;
    if (currentState.colorScheme === 'custom') {
      colors = currentState.customColors;
    } else {
      colors = SCHEME_COLORS[currentState.colorScheme] || SCHEME_COLORS.default;
    }

    elements.legendSelf.style.background = colors.self;
    elements.legendParent.style.background = colors.parent;
    elements.legendChild.style.background = colors.child;
  }

  // ===== UI UPDATE =====

  function updateUI() {
    // Toggle button
    const track = elements.toggleBtn.querySelector('.toggle-track');
    if (currentState.enabled) {
      track.classList.add('active');
    } else {
      track.classList.remove('active');
    }

    // Status bar
    if (currentState.enabled) {
      elements.statusBar.classList.remove('status-off');
      elements.statusBar.classList.add('status-on');
      const onMsg = chrome.i18n.getMessage('statusOn');
      elements.statusText.textContent = onMsg || 'Active — hover over elements';
    } else {
      elements.statusBar.classList.remove('status-on');
      elements.statusBar.classList.add('status-off');
      const offMsg = chrome.i18n.getMessage('statusOff');
      elements.statusText.textContent = offMsg || 'Disabled';
    }

    // Checkboxes
    elements.showLabels.checked = currentState.showLabels;
    elements.highlightParents.checked = currentState.highlightParents;
    elements.highlightChildren.checked = currentState.highlightChildren;

    // Depth
    elements.depthValue.textContent = currentState.parentDepth;
    elements.depthMinus.disabled = currentState.parentDepth <= 1;
    elements.depthPlus.disabled = currentState.parentDepth >= 5;

    // Color scheme buttons
    elements.schemeBtns.forEach(btn => {
      if (btn.dataset.scheme === currentState.colorScheme) {
        btn.classList.add('scheme-btn-active');
      } else {
        btn.classList.remove('scheme-btn-active');
      }
    });

    // Legend colors
    updateLegendColors();
  }

  // ===== STATE MANAGEMENT =====

  function sendStateChange(payload) {
    chrome.runtime.sendMessage({
      type: 'SET_STATE',
      payload: payload
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('DSV: Could not send state change:', chrome.runtime.lastError.message);
      }
    });
  }

  function loadState() {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('DSV: Could not load state:', chrome.runtime.lastError.message);
        return;
      }
      if (response) {
        currentState = {
          enabled: response.enabled || false,
          showLabels: response.showLabels !== undefined ? response.showLabels : true,
          highlightParents: response.highlightParents !== undefined ? response.highlightParents : true,
          highlightChildren: response.highlightChildren !== undefined ? response.highlightChildren : true,
          parentDepth: response.parentDepth !== undefined ? response.parentDepth : 2,
          colorScheme: response.colorScheme || 'default',
          customColors: response.customColors || {
            self: '#2196F3',
            parent: '#FF9800',
            child: '#4CAF50'
          }
        };
        updateUI();
      }
    });
  }

  // ===== EVENT LISTENERS =====

  function setupEventListeners() {
    // Settings button - open options page
    elements.settingsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    // Toggle on/off
    elements.toggleBtn.addEventListener('click', () => {
      currentState.enabled = !currentState.enabled;
      updateUI();
      sendStateChange({ enabled: currentState.enabled });
    });

    // Show labels
    elements.showLabels.addEventListener('change', (e) => {
      currentState.showLabels = e.target.checked;
      sendStateChange({ showLabels: currentState.showLabels });
    });

    // Highlight parents
    elements.highlightParents.addEventListener('change', (e) => {
      currentState.highlightParents = e.target.checked;
      sendStateChange({ highlightParents: currentState.highlightParents });
    });

    // Highlight children
    elements.highlightChildren.addEventListener('change', (e) => {
      currentState.highlightChildren = e.target.checked;
      sendStateChange({ highlightChildren: currentState.highlightChildren });
    });

    // Depth minus
    elements.depthMinus.addEventListener('click', () => {
      if (currentState.parentDepth > 1) {
        currentState.parentDepth--;
        updateUI();
        sendStateChange({ parentDepth: currentState.parentDepth });
      }
    });

    // Depth plus
    elements.depthPlus.addEventListener('click', () => {
      if (currentState.parentDepth < 5) {
        currentState.parentDepth++;
        updateUI();
        sendStateChange({ parentDepth: currentState.parentDepth });
      }
    });

    // Color scheme buttons
    elements.schemeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        currentState.colorScheme = btn.dataset.scheme;
        updateUI();
        sendStateChange({ colorScheme: currentState.colorScheme });
      });
    });

    // Keyboard support for toggle
    elements.toggleBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        elements.toggleBtn.click();
      }
    });
  }

  // ===== INITIALIZATION =====

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