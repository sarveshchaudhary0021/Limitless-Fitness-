// Minimal Aesthetic Custom Cursor Script
document.addEventListener('DOMContentLoaded', () => {
  // Only apply on desktop devices where hover is supported (avoids mobile touch issues)
  if (!window.matchMedia("(pointer: fine)").matches) return;

  const cursor = document.createElement('div');
  cursor.classList.add('cursor');
  
  const follower = document.createElement('div');
  follower.classList.add('cursor-follower');
  
  document.body.appendChild(cursor);
  document.body.appendChild(follower);

  document.addEventListener('mousemove', (e) => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
    follower.style.left = e.clientX + 'px';
    follower.style.top = e.clientY + 'px';
  });

  const attachEvents = (el) => {
    if (el.dataset.cursorAttached) return;
    el.addEventListener('mouseenter', () => {
      cursor.classList.add('active');
      follower.classList.add('active');
    });
    el.addEventListener('mouseleave', () => {
      cursor.classList.remove('active');
      follower.classList.remove('active');
    });
    el.dataset.cursorAttached = "true";
  };

  const addHoverEffects = () => {
    const interactables = document.querySelectorAll('a, button, input, select, .feature-card, .price-card');
    interactables.forEach(attachEvents);
  };

  addHoverEffects();
  
  // Observe DOM for newly added elements to apply hover effects
  const observer = new MutationObserver(addHoverEffects);
  observer.observe(document.body, { childList: true, subtree: true });
});
