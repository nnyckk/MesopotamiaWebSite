/* ================================================
   MESOPOTAMIA — contact.js
   Pagina de contact: carduri → modal cu formular,
   validare front-end, upload UI, submit stub.
   ================================================ */

(function () {
  'use strict';

  var TITLES = {
    sesizari: 'Sugestii și Reclamații',
    contact:  'Formular Contact',
    factura:  'Solicitare Factură',
    delivery: 'Probleme Delivery',
    cariera:  'Carieră Meso'
  };

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var MAX_MB_DEFAULT = 5;

  function init() {
    var overlay = document.getElementById('contactModal');
    if (!overlay) return;

    var modal     = overlay.querySelector('.contact-modal');
    var body      = overlay.querySelector('.contact-modal__body');
    var titleEl   = document.getElementById('contactModalTitle');
    var closeBtn  = document.getElementById('contactModalClose');
    var panels    = overlay.querySelectorAll('.contact-form-panel');
    var lastTrigger = null;
    var savedScrollY = 0;

    /* ---- Open from cards ---- */
    document.querySelectorAll('.contact-card').forEach(function (card) {
      card.addEventListener('click', function () {
        openModal(card.dataset.form, card);
      });
    });

    /* ---- Close handlers ---- */
    closeBtn.addEventListener('click', closeModal);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeModal();
    });

    /* ---- Scroll shadow on header ---- */
    body.addEventListener('scroll', function () {
      overlay.classList.toggle('is-scrolled', body.scrollTop > 4);
    });

    /* ---- Focus trap (Tab cycles within modal) ---- */
    modal.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var focusables = getFocusable();
      if (!focusables.length) return;
      var first = focusables[0];
      var last  = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    function getFocusable() {
      var panel = overlay.querySelector('.contact-form-panel:not([hidden])');
      var sel = 'a[href], button:not([disabled]), input:not([hidden]), textarea, select, [tabindex]:not([tabindex="-1"])';
      var list = [closeBtn];
      if (panel) {
        panel.querySelectorAll(sel).forEach(function (el) {
          if (el.offsetParent !== null || el === document.activeElement) list.push(el);
        });
      }
      return list;
    }

    function openModal(form, trigger) {
      lastTrigger = trigger || null;
      titleEl.textContent = TITLES[form] || 'Contact';

      panels.forEach(function (p) {
        var match = p.dataset.panel === form;
        p.hidden = !match;
        if (match) resetPanel(p);
      });

      overlay.classList.add('is-open');
      overlay.classList.remove('is-scrolled');
      overlay.setAttribute('aria-hidden', 'false');
      /* Blocheaza scroll-ul de fundal (fix pt. iOS, unde overflow:hidden nu e suficient) */
      savedScrollY = window.scrollY || window.pageYOffset || 0;
      document.body.style.position = 'fixed';
      document.body.style.top = '-' + savedScrollY + 'px';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      body.scrollTop = 0;

      setTimeout(function () { closeBtn.focus(); }, 50);
    }

    function closeModal() {
      overlay.classList.remove('is-open', 'is-scrolled');
      overlay.setAttribute('aria-hidden', 'true');
      /* Restaureaza body-ul si pozitia de scroll */
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, savedScrollY);
      if (lastTrigger) {
        lastTrigger.focus();
        lastTrigger = null;
      }
    }

    /* ---- Deschide automat un formular din ?form=... (ex. link din more.html) ---- */
    var requested = new URLSearchParams(window.location.search).get('form');
    if (requested && TITLES[requested]) {
      openModal(requested, null);
    }

    initSwipeToDismiss(overlay, modal, body, closeModal);
    initForms(overlay);
  }


  /* ------------------------------------------------
     Reset panel to its initial state (form visible,
     errors cleared, success hidden)
  ------------------------------------------------ */
  function resetPanel(panel) {
    var form    = panel.querySelector('.contact-form');
    var success = panel.querySelector('.contact-form__success');
    if (form) {
      form.hidden = false;
      form.reset();
      panel.querySelectorAll('.contact-field[aria-invalid="true"]').forEach(function (f) {
        f.removeAttribute('aria-invalid');
      });
      panel.querySelectorAll('.contact-consent__error.is-active').forEach(function (e) {
        e.classList.remove('is-active');
      });
      panel.querySelectorAll('.contact-file.is-invalid').forEach(function (f) {
        f.classList.remove('is-invalid');
      });
      panel.querySelectorAll('.contact-file__list.is-active').forEach(function (l) {
        l.classList.remove('is-active');
        l.innerHTML = '';
      });
      var neterr = panel.querySelector('.contact-form__neterror');
      if (neterr) neterr.hidden = true;
      var btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = false; btn.textContent = 'Trimite'; }
    }
    if (success) success.hidden = true;
  }


  /* ------------------------------------------------
     Swipe to dismiss (mobile) — mirror products.js
  ------------------------------------------------ */
  function initSwipeToDismiss(overlay, modal, body, closeFn) {
    var header = overlay.querySelector('.contact-modal__header');
    var handle = overlay.querySelector('.contact-modal__handle');
    var startY = 0, currentY = 0, dragging = false, fromTop = false;

    modal.addEventListener('touchstart', function (e) {
      var t = e.target;
      fromTop = (header && header.contains(t)) || (handle && handle.contains(t));
      if (!fromTop && body.scrollTop > 0) return;
      startY = e.touches[0].clientY;
      currentY = startY;
      dragging = true;
      modal.style.transition = 'none';
    }, { passive: true });

    modal.addEventListener('touchmove', function (e) {
      if (!dragging) return;
      currentY = e.touches[0].clientY;
      var diff = Math.max(0, currentY - startY);
      modal.style.transform = 'translateY(' + diff + 'px)';
    }, { passive: true });

    modal.addEventListener('touchend', function () {
      if (!dragging) return;
      dragging = false;
      var diff = currentY - startY;
      modal.style.transition = '';
      if (diff > 100) {
        modal.style.transform = '';
        closeFn();
      } else {
        modal.style.transform = 'translateY(0)';
        setTimeout(function () { modal.style.transform = ''; }, 300);
      }
    });

    modal.addEventListener('touchcancel', function () {
      if (!dragging) return;
      dragging = false;
      modal.style.transition = '';
      modal.style.transform = 'translateY(0)';
      setTimeout(function () { modal.style.transform = ''; }, 300);
    });
  }


  /* ------------------------------------------------
     Forms: file UI + validation + stub submit
  ------------------------------------------------ */
  function initForms(overlay) {
    /* ---- File dropzones ---- */
    overlay.querySelectorAll('.contact-file').forEach(function (wrap) {
      var input = wrap.querySelector('input[type="file"]');
      var zone  = wrap.querySelector('.contact-file__zone');
      var list  = wrap.querySelector('.contact-file__list');
      if (!input || !zone) return;

      ['dragenter', 'dragover'].forEach(function (ev) {
        zone.addEventListener(ev, function (e) {
          e.preventDefault();
          wrap.classList.add('is-dragover');
        });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        zone.addEventListener(ev, function (e) {
          e.preventDefault();
          wrap.classList.remove('is-dragover');
        });
      });
      zone.addEventListener('drop', function (e) {
        if (e.dataTransfer && e.dataTransfer.files.length) {
          input.files = e.dataTransfer.files;
          input.dispatchEvent(new Event('change'));
        }
      });

      input.addEventListener('change', function () {
        wrap.classList.remove('is-invalid');
        if (!input.files.length) {
          if (list) { list.classList.remove('is-active'); list.innerHTML = ''; }
          return;
        }
        var file = input.files[0];
        var maxMb = parseInt(input.dataset.maxmb, 10) || MAX_MB_DEFAULT;
        if (file.size > maxMb * 1024 * 1024) {
          wrap.classList.add('is-invalid');
          input.value = '';
          if (list) { list.classList.remove('is-active'); list.innerHTML = ''; }
          return;
        }
        if (list) {
          list.classList.add('is-active');
          list.innerHTML = '<i class="fa-solid fa-paperclip" aria-hidden="true"></i> <span>' +
            escapeHtml(file.name) + '</span>';
          var rm = document.createElement('button');
          rm.type = 'button';
          rm.setAttribute('aria-label', 'Elimină fișierul');
          rm.innerHTML = '<i class="fa-solid fa-xmark"></i>';
          rm.addEventListener('click', function (e) {
            e.preventDefault();
            input.value = '';
            list.classList.remove('is-active');
            list.innerHTML = '';
          });
          list.appendChild(rm);
        }
      });
    });

    /* ---- Clear error state as user types ---- */
    overlay.querySelectorAll('.contact-input, .contact-textarea').forEach(function (el) {
      el.addEventListener('input', function () {
        var field = el.closest('.contact-field');
        if (field) field.removeAttribute('aria-invalid');
      });
    });
    overlay.querySelectorAll('.contact-consent input[type="checkbox"]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var err = cb.closest('.contact-consent')
          .parentNode.querySelector('.contact-consent__error');
        if (err && cb.checked) err.classList.remove('is-active');
      });
    });

    /* ---- Submit (trimitere reală către Web3Forms) ---- */
    overlay.querySelectorAll('.contact-form').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!validateForm(form)) return;
        sendForm(form);
      });
    });
  }

  function sendForm(form) {
    var panel  = form.closest('.contact-form-panel');
    var btn    = form.querySelector('button[type="submit"]');
    var errBox = panel.querySelector('.contact-form__neterror');
    var btnTxt = btn ? btn.textContent : '';

    if (btn) { btn.disabled = true; btn.textContent = 'Se trimite...'; }
    if (errBox) errBox.hidden = true;

    /* Web3Forms (plan gratuit) nu acceptă atașamente — excludem fișierele */
    var data = new FormData(form);
    form.querySelectorAll('input[type="file"]').forEach(function (input) {
      if (input.name) data.delete(input.name);
    });

    fetch(form.action, {
      method: 'POST',
      body: data,
      headers: { 'Accept': 'application/json' }
    })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        if (r.ok && r.data.success) {
          form.reset();
          if (btn) { btn.disabled = false; btn.textContent = btnTxt; }
          panel.querySelectorAll('.contact-file__list.is-active').forEach(function (l) {
            l.classList.remove('is-active');
            l.innerHTML = '';
          });
          var success = form.querySelector('.contact-form__success');
          if (success) success.hidden = false;
        } else {
          showNetError(panel, btn, btnTxt);
        }
      })
      .catch(function () {
        showNetError(panel, btn, btnTxt);
      });
  }

  function showNetError(panel, btn, btnTxt) {
    if (btn) { btn.disabled = false; btn.textContent = btnTxt; }
    var errBox = panel.querySelector('.contact-form__neterror');
    if (errBox) errBox.hidden = false;
  }

  function validateForm(form) {
    var ok = true;
    var firstInvalid = null;

    /* Required text/email/tel inputs + textareas */
    form.querySelectorAll('input[required], textarea[required]').forEach(function (el) {
      if (el.type === 'checkbox' || el.type === 'file') return;
      var field = el.closest('.contact-field');
      var valid = el.value.trim() !== '';
      if (valid && el.type === 'email') valid = EMAIL_RE.test(el.value.trim());
      if (!valid) {
        ok = false;
        if (field) field.setAttribute('aria-invalid', 'true');
        if (!firstInvalid) firstInvalid = el;
      } else if (field) {
        field.removeAttribute('aria-invalid');
      }
    });

    /* Required file inputs */
    form.querySelectorAll('input[type="file"][data-required="true"]').forEach(function (input) {
      var wrap = input.closest('.contact-file');
      if (!input.files.length) {
        ok = false;
        if (wrap) wrap.classList.add('is-invalid');
        if (!firstInvalid) firstInvalid = wrap;
      }
    });

    /* Required consent */
    form.querySelectorAll('.contact-consent input[type="checkbox"][required]').forEach(function (cb) {
      if (!cb.checked) {
        ok = false;
        var err = cb.closest('.contact-consent').parentNode.querySelector('.contact-consent__error');
        if (err) err.classList.add('is-active');
        if (!firstInvalid) firstInvalid = cb.closest('.contact-consent');
      }
    });

    if (firstInvalid && firstInvalid.focus) {
      var focusEl = firstInvalid.querySelector ? (firstInvalid.querySelector('input, textarea') || firstInvalid) : firstInvalid;
      try { focusEl.focus(); } catch (e) {}
    }
    return ok;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  ready(init);
})();


/* ================================================
   FAQ — accordion animat (deschidere + închidere)
   <details> nativ nu animează height; controlăm manual
   atributul [open] și clasa .is-open pe care o animă CSS.
   ================================================ */
(function () {
  'use strict';

  function initFaq() {
    var items = document.querySelectorAll('.faq__item');
    if (!items.length) return;

    items.forEach(function (item) {
      var summary = item.querySelector('.faq__q');
      if (!summary) return;

      summary.addEventListener('click', function (e) {
        e.preventDefault(); // preluăm controlul; nu lăsăm <details> să comute brusc

        if (item.classList.contains('is-open')) {
          // Închidere: animă întâi, scoate [open] la final
          item.classList.remove('is-open');
          item.addEventListener('transitionend', function onEnd(ev) {
            if (ev.propertyName !== 'grid-template-rows') return;
            item.removeEventListener('transitionend', onEnd);
            if (!item.classList.contains('is-open')) item.open = false;
          });
        } else {
          // Deschidere: pune [open] ca să fie vizibil, apoi animă pe frame-ul următor
          item.open = true;
          requestAnimationFrame(function () {
            item.classList.add('is-open');
          });
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFaq);
  } else {
    initFaq();
  }
})();
