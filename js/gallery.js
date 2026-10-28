(() => {
  const dialog = document.getElementById('screen-lightbox');
  if (!dialog) return;
  const image = document.getElementById('lightbox-image');
  const caption = document.getElementById('lightbox-caption');
  const close = document.getElementById('lightbox-close');
  const galleries = new Map();
  let active = [];
  let index = 0;
  let opener;

  document.querySelectorAll('.app-screen-trigger').forEach(trigger => {
    const key = trigger.dataset.gallery;
    if (!galleries.has(key)) galleries.set(key, []);
    galleries.get(key).push(trigger);
    trigger.addEventListener('click', () => {
      active = galleries.get(key);
      index = active.indexOf(trigger);
      opener = trigger;
      show(index);
      dialog.showModal();
      document.body.classList.add('gallery-open');
      close.focus();
    });
  });

  function show(next) {
    index = (next + active.length) % active.length;
    const trigger = active[index];
    image.src = trigger.dataset.fullsrc;
    image.alt = trigger.dataset.alt || 'Náhled aplikace';
    caption.textContent = `${image.alt} · ${index + 1} / ${active.length}`;
  }

  close.addEventListener('click', () => dialog.close());
  document.getElementById('lightbox-prev').addEventListener('click', () => show(index - 1));
  document.getElementById('lightbox-next').addEventListener('click', () => show(index + 1));
  dialog.addEventListener('click', event => {
    if (event.target === dialog || event.target.classList.contains('lightbox-content')) dialog.close();
  });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Tab') {
      const buttons = [...dialog.querySelectorAll('button')];
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      show(index + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('gallery-open');
    image.removeAttribute('src');
    if (opener) opener.focus();
  });
})();
