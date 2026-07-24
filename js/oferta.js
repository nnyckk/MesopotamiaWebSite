/* ================================================
   MESOPOTAMIA — oferta.js
   Landing „Alege-ți favoritele":
   randează caruselul de pizza din data/products.json
   + navigare cu săgeți stânga/dreapta.
   ================================================ */
(function () {
  var track = document.getElementById('pizzaTrack');
  if (!track) return;

  var prevBtn = document.getElementById('pizzaPrev');
  var nextBtn = document.getElementById('pizzaNext');

  /* Escapează text pentru inserare sigură în HTML (la fel ca în products.js). */
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  fetch('data/products.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var cats = (data && data.categories) || [];
      var pizza = null;
      for (var i = 0; i < cats.length; i++) {
        if (cats[i].id === 'pizza') { pizza = cats[i]; break; }
      }
      if (!pizza || !pizza.products) return;

      track.innerHTML = pizza.products.map(renderCard).join('');
      /* main.js ascultă acest eveniment ca să aplice .reveal pe cardurile noi */
      document.dispatchEvent(new CustomEvent('products:rendered'));
      initArrows();
    })
    .catch(function (err) {
      console.error('Nu s-a putut încărca products.json:', err);
    });

  function renderCard(p) {
    var weight, price;
    if (p.variants && p.variants.length) {
      /* La ofertă evidențiem varianta Medie dacă există, altfel prima */
      var v = p.variants[0];
      for (var i = 0; i < p.variants.length; i++) {
        if (/medie/i.test(p.variants[i].label)) { v = p.variants[i]; break; }
      }
      weight = v.weight;
      price = v.price;
    } else {
      weight = p.weight;
      price = p.price;
    }

    return '<div class="pizza-card product-card">' +
      '<div class="product-card__img-wrap">' +
        '<img src="' + esc(p.img) + '" alt="' + esc(p.name) + '" class="product-card__img" loading="lazy">' +
        (p.promotie ? '<span class="product-card__promo-tag">PROMOȚIE</span>' : '') +
      '</div>' +
      '<div class="product-card__info">' +
        '<h3 class="product-card__name">' + esc(p.name) + '</h3>' +
        '<p class="product-card__desc">' + esc(p.desc) + '</p>' +
        '<div class="product-card__meta">' +
          '<span class="product-card__weight">' + esc(weight) + '</span>' +
          '<span class="product-card__price">' + esc(price) + '</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function initArrows() {
    if (!prevBtn || !nextBtn) return;

    function step() {
      var card = track.querySelector('.product-card');
      var gap = 16; /* --space-md */
      return card ? card.getBoundingClientRect().width + gap : track.clientWidth * 0.8;
    }

    function update() {
      /* dacă tot conținutul încape, nu are rost să arătăm săgețile */
      var scrollable = track.scrollWidth - track.clientWidth > 4;
      var atStart = track.scrollLeft <= 4;
      var atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
      prevBtn.hidden = !scrollable || atStart;
      nextBtn.hidden = !scrollable || atEnd;
    }

    prevBtn.addEventListener('click', function () {
      track.scrollBy({ left: -step(), behavior: 'smooth' });
    });
    nextBtn.addEventListener('click', function () {
      track.scrollBy({ left: step(), behavior: 'smooth' });
    });

    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

})();


/* ================================================
   FAQ — accordion animat (deschidere + închidere)
   <details> nativ nu animează height; controlăm manual
   atributul [open] și clasa .is-open pe care o animă CSS.
   (identic cu mecanismul din contact.js)
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
