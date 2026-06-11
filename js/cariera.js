/* ================================================
   MESOPOTAMIA — cariera.js
   Formular de aplicare inline: upload CV, validare
   front-end, submit Web3Forms. Refolosește clasele
   .contact-* și logica din contact.js (adaptată inline).
   ================================================ */

(function () {
  'use strict';

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var MAX_MB_DEFAULT = 5;

  function init() {
    var panel = document.querySelector('.career-form-panel');
    if (!panel) return;
    initForms(panel);
  }

  /* ---- File dropzone + validation + submit ---- */
  function initForms(scope) {
    /* File dropzones */
    scope.querySelectorAll('.contact-file').forEach(function (wrap) {
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

    /* Clear error state as user types/selects */
    scope.querySelectorAll('.contact-input, .contact-textarea, .contact-select').forEach(function (el) {
      var ev = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(ev, function () {
        var field = el.closest('.contact-field');
        if (field) field.removeAttribute('aria-invalid');
      });
    });
    scope.querySelectorAll('.contact-consent input[type="checkbox"]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var err = cb.closest('.contact-consent')
          .parentNode.querySelector('.contact-consent__error');
        if (err && cb.checked) err.classList.remove('is-active');
      });
    });

    /* Submit */
    scope.querySelectorAll('.contact-form').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!validateForm(form)) return;
        sendForm(form);
      });
    });
  }

  function sendForm(form) {
    var panel  = form.closest('.career-form-panel');
    var btn    = form.querySelector('button[type="submit"]');
    var errBox = panel.querySelector('.contact-form__neterror');
    var btnTxt = btn ? btn.textContent : '';

    if (btn) { btn.disabled = true; btn.textContent = 'Se trimite...'; }
    if (errBox) errBox.hidden = true;

    /* Web3Forms (plan gratuit) nu acceptă atașamente — excludem fișierele.
       CV-ul trimis prin formular NU ajunge prin Web3Forms gratuit. */
    var data = new FormData(form);
    form.querySelectorAll('input[type="file"]').forEach(function (input) {
      if (input.name) data.delete(input.name);
    });

    fetch(form.action, {
      method: 'POST',
      body: data,
      headers: { 'Accept': 'application/json' }
    })
      .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
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

    /* Required text/email/tel/date inputs + textareas + selects */
    form.querySelectorAll('input[required], textarea[required], select[required]').forEach(function (el) {
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

    /* Optional email (no required) — validează doar dacă e completat */
    form.querySelectorAll('input[type="email"]:not([required])').forEach(function (el) {
      if (el.value.trim() === '') return;
      var field = el.closest('.contact-field');
      if (!EMAIL_RE.test(el.value.trim())) {
        ok = false;
        if (field) field.setAttribute('aria-invalid', 'true');
        if (!firstInvalid) firstInvalid = el;
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
      var focusEl = firstInvalid.querySelector ? (firstInvalid.querySelector('input, textarea, select') || firstInvalid) : firstInvalid;
      try { focusEl.focus(); } catch (e) {}
    }
    return ok;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
