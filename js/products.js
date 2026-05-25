(function () {
  const main = document.getElementById('meniuContent');
  if (!main) return;

  fetch('data/products.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      renderCategories(data.categories);
      document.dispatchEvent(new CustomEvent('products:rendered'));
    })
    .catch(function (err) {
      console.error('Nu s-a putut încărca products.json:', err);
    });

  function renderCategories(categories) {
    main.innerHTML = categories.map(function (cat) {
      return renderSection(cat);
    }).join('');
  }

  function renderSection(cat) {
    var products = cat.products.map(function (p) {
      return renderCard(p);
    }).join('');

    return '<section class="menu-section" id="' + cat.id + '" aria-labelledby="title-' + cat.id + '">' +
      '<h2 class="menu-section__title" id="title-' + cat.id + '">' + cat.title + '</h2>' +
      '<div class="product-grid">' + products + '</div>' +
      '</section>';
  }

  function renderCard(p) {
    return '<div class="product-card">' +
      '<div class="product-card__img-wrap">' +
      '<img src="' + p.img + '" alt="' + p.name + '" class="product-card__img" loading="lazy">' +
      '</div>' +
      '<div class="product-card__info">' +
      '<h3 class="product-card__name">' + p.name + '</h3>' +
      '<p class="product-card__desc">' + p.desc + '</p>' +
      '<div class="product-card__meta">' +
      '<span class="product-card__weight">' + p.weight + '</span>' +
      '<span class="product-card__price">' + p.price + '</span>' +
      '</div>' +
      '</div>' +
      '</div>';
  }

})();
