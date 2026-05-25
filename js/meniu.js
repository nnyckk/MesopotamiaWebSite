(function () {
  const links = document.querySelectorAll('.sidebar-cat');
  let scrollingFromClick = false;
  let scrollTimer = null;

  function setActive(id, scrollSidebar) {
    links.forEach(l => {
      const active = l.dataset.section === id;
      l.classList.toggle('is-active', active);
      if (active && scrollSidebar) {
        l.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });
  }

  const observer = new IntersectionObserver(entries => {
    if (scrollingFromClick) return;
    entries.forEach(entry => {
      if (entry.isIntersecting) setActive(entry.target.id, true);
    });
  }, { rootMargin: '-30% 0px -60% 0px' });

  document.addEventListener('products:rendered', function () {
    document.querySelectorAll('.menu-section').forEach(s => observer.observe(s));

    if (window.location.hash) {
      const target = document.querySelector(window.location.hash);
      if (target) {
        setActive(target.id, true);
        requestAnimationFrame(function () {
          const offset = target.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top: offset, behavior: 'smooth' });
        });
      }
    }
  });

  links.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      setActive(link.dataset.section, true);
      scrollingFromClick = true;
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => { scrollingFromClick = false; }, 800);
      const offset = target.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: offset, behavior: 'smooth' });
    });
  });

})();
