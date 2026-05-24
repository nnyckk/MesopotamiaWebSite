(function () {
  const links = document.querySelectorAll('.sidebar-cat');
  const sections = document.querySelectorAll('.menu-section');

  function setActive(id) {
    links.forEach(l => {
      const active = l.dataset.section === id;
      l.classList.toggle('is-active', active);
      if (active) {
        l.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
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

  /* Pe mobile: bara se opreste inainte de footer */
  const sidebar = document.getElementById('meniuSidebar');
  const footer  = document.querySelector('.footer');

  function updateSidebarBottom() {
    if (!sidebar || !footer || window.innerWidth > 768) return;
    const footerTop = footer.getBoundingClientRect().top;
    const vh = window.innerHeight;
    sidebar.style.bottom = footerTop < vh ? (vh - footerTop) + 'px' : '0px';
  }

  window.addEventListener('scroll', updateSidebarBottom, { passive: true });
  window.addEventListener('resize', updateSidebarBottom);
  updateSidebarBottom();
})();
