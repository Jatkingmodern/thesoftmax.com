/* ============================
   Enhanced site script
   Improvements:
   - Debounced scroll handling
   - Safer selectors with helpful errors
   - Close mobile menu on outside click & on nav item click
   - Keyboard accessibility and ARIA updates
   - Theme toggling with prefers-color-scheme fallback
   - Search form focus management & ESC handling
   - Improved Swiper settings (a11y, keyboard, lazy, autoplay)
   - Respect reduced-motion user preference
   ============================ */

(function () {
  'use strict';

  /* ---------- Utilities ---------- */

  const qs = (selector, ctx = document) => ctx.querySelector(selector);
  const qsa = (selector, ctx = document) => Array.from(ctx.querySelectorAll(selector));

  function safeSelect(selector) {
    const el = qs(selector);
    if (!el) {
      // Fail softly in production, but warn in dev
      if (typeof console !== 'undefined') {
        console.warn(`[safeSelect] missing element for selector: "${selector}"`);
      }
    }
    return el;
  }

  function debounce(fn, wait = 16) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function onDocumentClick(fn) {
    document.addEventListener('click', fn, { passive: true });
  }

  // respects prefers-reduced-motion
  function prefersReducedMotion() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  }

  /* ---------- Header (nav styles on scroll) ---------- */

  const headerEl = safeSelect('#header');
  const SCROLL_ACTIVATE_PX = 15;

  function handleHeaderScroll() {
    if (!headerEl) return;
    if (window.scrollY >= SCROLL_ACTIVATE_PX) {
      headerEl.classList.add('activated');
      headerEl.setAttribute('data-scrolled', 'true');
    } else {
      headerEl.classList.remove('activated');
      headerEl.removeAttribute('data-scrolled');
    }
  }
  // debounce the scroll handler for performance
  window.addEventListener('scroll', debounce(handleHeaderScroll, 12), { passive: true });
  // run on init
  handleHeaderScroll();

  /* ---------- Menu toggle (mobile) ---------- */

  const menuToggleIcon = safeSelect('#menu-toggle-icon');
  const mobileMenu = safeSelect('#menu');
  const menuCloseOnNavClick = true; // close when nav item clicked

  function toggleMenu(shouldOpen) {
    if (!menuToggleIcon || !mobileMenu) return;
    const isOpen = mobileMenu.classList.contains('activated');
    const open = (typeof shouldOpen === 'boolean') ? shouldOpen : !isOpen;
    mobileMenu.classList.toggle('activated', open);
    menuToggleIcon.classList.toggle('activated', open);
    menuToggleIcon.setAttribute('aria-expanded', String(open));
    document.documentElement.classList.toggle('menu-open', open);
    // trap focus could go here for stronger accessibility
  }

  if (menuToggleIcon) {
    menuToggleIcon.setAttribute('role', 'button');
    menuToggleIcon.setAttribute('aria-controls', mobileMenu ? mobileMenu.id || 'menu' : '');
    menuToggleIcon.setAttribute('tabindex', '0');

    menuToggleIcon.addEventListener('click', () => toggleMenu());
    menuToggleIcon.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        toggleMenu();
      }
      if (ev.key === 'Escape') {
        toggleMenu(false);
      }
    });
  }

  // close menu if clicking outside
  onDocumentClick((ev) => {
    if (!mobileMenu) return;
    if (!mobileMenu.classList.contains('activated')) return;
    const target = ev.target;
    if (!mobileMenu.contains(target) && !menuToggleIcon.contains(target)) {
      toggleMenu(false);
    }
  });

  // close menu on nav item click (useful for single-page anchors)
  if (menuCloseOnNavClick && mobileMenu) {
    mobileMenu.addEventListener('click', (ev) => {
      const anchor = ev.target.closest('a[href^="#"]');
      if (anchor) toggleMenu(false);
    });
  }

  /* ---------- Search popup handling ---------- */

  const formOpenBtn = safeSelect('#search-icon');
  const formCloseBtn = safeSelect('#form-close-btn');
  const searchContainer = safeSelect('#search-form-container');
  const searchInput = safeSelect('#search-form-container input[type="search"], #search-form-container input[type="text"]');

  function openSearch() {
    if (!searchContainer) return;
    searchContainer.classList.add('activated');
    searchContainer.setAttribute('aria-hidden', 'false');
    // focus the input after next paint
    if (searchInput) setTimeout(() => searchInput.focus(), 50);
  }
  function closeSearch() {
    if (!searchContainer) return;
    searchContainer.classList.remove('activated');
    searchContainer.setAttribute('aria-hidden', 'true');
    if (formOpenBtn) formOpenBtn.focus();
  }

  if (formOpenBtn) {
    formOpenBtn.setAttribute('aria-expanded', 'false');
    formOpenBtn.addEventListener('click', () => {
      openSearch();
      formOpenBtn.setAttribute('aria-expanded', 'true');
    });
  }
  if (formCloseBtn) {
    formCloseBtn.addEventListener('click', () => {
      closeSearch();
      if (formOpenBtn) formOpenBtn.setAttribute('aria-expanded', 'false');
    });
  }

  // Close the search form popup on ESC keypress
  window.addEventListener('keyup', (event) => {
    if (event.key === 'Escape') {
      closeSearch();
      // also close menu
      toggleMenu(false);
    }
  });

  // close search on outside click
  onDocumentClick((ev) => {
    if (!searchContainer || !searchContainer.classList.contains('activated')) return;
    if (!searchContainer.contains(ev.target) && ev.target !== formOpenBtn) {
      closeSearch();
    }
  });

  /* ---------- Theme toggle & persistence ---------- */

  const THEME_KEY = 'currentTheme';
  const body = document.body;
  const themeToggleBtn = safeSelect('#theme-toggle-btn') || null; // optional toggle button in markup

  function getSystemTheme() {
    try {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (e) {
      return 'light';
    }
  }

  function applyTheme(theme) {
    if (!body) return;
    body.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    if (themeToggleBtn) themeToggleBtn.setAttribute('aria-pressed', String(theme === 'dark'));
  }

  // determine initial theme
  const storedTheme = localStorage.getItem(THEME_KEY);
  const initialTheme = storedTheme || getSystemTheme();
  applyTheme(initialTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = body.dataset.theme || getSystemTheme();
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });
  }

  /* ---------- Swiper: improved config ---------- */
  // Ensure Swiper is present
  if (typeof Swiper !== 'undefined') {
    // respect reduced motion for autoplay & effects
    const reduced = prefersReducedMotion();

    const swiper = new Swiper('.swiper', {
      slidesPerView: 1,
      spaceBetween: 20,
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },
      pagination: {
        el: '.swiper-pagination',
        clickable: true
      },
      a11y: {
        enabled: true,
        prevSlideMessage: 'Previous slide',
        nextSlideMessage: 'Next slide',
        slideLabelMessage: '{{index}} / {{slidesLength}}',
      },
      keyboard: {
        enabled: true,
        onlyInViewport: true,
      },
      lazy: {
        loadPrevNext: true,
        loadOnTransitionStart: true,
      },
      loop: true,
      autoplay: reduced ? false : {
        delay: 4000,
        disableOnInteraction: true,
      },
      watchSlidesProgress: true,
      watchSlidesVisibility: true,
      breakpoints: {
        700: {
          slidesPerView: 2
        },
        1200: {
          slidesPerView: 3
        }
      }
    });

    // Optional: pause autoplay on focus / resume on blur (accessibility)
    const swiperEl = safeSelect('.swiper');
    if (swiperEl && swiper.autoplay && swiper.autoplay.running) {
      swiperEl.addEventListener('focusin', () => {
        try { swiper.autoplay.stop(); } catch (e) {}
      });
      swiperEl.addEventListener('focusout', () => {
        if (!reduced) try { swiper.autoplay.start(); } catch (e) {}
      });
    }
  } else {
    console.warn('Swiper is not loaded. The carousel will not be initialized.');
  }

  /* ---------- Misc: keyboard helpers & progressive enhancement ---------- */

  // Make all [role="button"] elements keyboard actionable
  qsa('[role="button"]').forEach((el) => {
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    el.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        el.click();
      }
    });
  });

  // add skip link focus behavior if present
  const skipLink = safeSelect('a[href^="#main"], a[href="#content"]');
  if (skipLink) {
    skipLink.addEventListener('click', (ev) => {
      const target = document.getElementById(skipLink.hash.slice(1));
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.focus();
        // remove the tabindex after focus to keep DOM clean
        target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
      }
    });
  }

  /* ---------- End enhancements ---------- */
})();
