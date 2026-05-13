(function(){
  const header = document.querySelector('.header');
  const toggle = document.querySelector('.menu-toggle');
  if(!header || !toggle) return;

  function syncFixedHeaderHeight(){
    const height = Math.ceil(header.getBoundingClientRect().height || header.offsetHeight || 76);
    document.documentElement.style.setProperty('--fixed-header-height', height + 'px');
  }

  syncFixedHeaderHeight();
  window.addEventListener('resize', syncFixedHeaderHeight);
  window.addEventListener('load', syncFixedHeaderHeight);
  if('ResizeObserver' in window){
    new ResizeObserver(syncFixedHeaderHeight).observe(header);
  }

  toggle.addEventListener('click', function(){
    const isOpen = header.classList.toggle('menu-open');
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  document.addEventListener('click', function(event){
    if(!header.contains(event.target)){
      header.classList.remove('menu-open');
      toggle.setAttribute('aria-expanded','false');
    }
  });

  document.querySelectorAll('.main-nav a').forEach(function(link){
    link.addEventListener('click', function(){
      header.classList.remove('menu-open');
      toggle.setAttribute('aria-expanded','false');
    });
  });
})();
