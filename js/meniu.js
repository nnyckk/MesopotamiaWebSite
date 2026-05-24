(function () {
  const links = document.querySelectorAll('.sidebar-cat');
  const sections = document.querySelectorAll('.menu-section');

  function setActive(id) {
    links.forEach(l => {
      l.classList.toggle('is-active', l.dataset.section === id);
    });
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) setActive(entry.target.id);
    });
  }, { rootMargin: '-30% 0px -60% 0px' });

  sections.forEach(s => observer.observe(s));

  links.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      setActive(link.dataset.section);
      const offset = target.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: offset, behavior: 'smooth' });
    });
  });
})();
