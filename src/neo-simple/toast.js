export function createToast(toastHost) {
  const toastState = {
    lastAt: 0,
    lastText: '',
    lastTone: '',
  };

  function showToast(text, tone = 'info', durationMs = 3500) {
    if (!toastHost || !text) return;

    const now = Date.now();
    if (toastState.lastText === text && toastState.lastTone === tone && now - toastState.lastAt < 1500) return;
    toastState.lastAt = now;
    toastState.lastText = text;
    toastState.lastTone = tone;

    const el = document.createElement('div');
    el.className = `neo-toast neo-toast--${tone}`;
    el.setAttribute('role', tone === 'error' || tone === 'warn' ? 'alert' : 'status');

    const msg = document.createElement('div');
    msg.className = 'neo-toast-text';
    msg.textContent = text;

    const close = document.createElement('button');
    close.className = 'neo-toast-close';
    close.type = 'button';
    close.textContent = 'Dismiss';
    close.addEventListener('click', () => {
      el.classList.remove('is-visible');
      setTimeout(() => el.remove(), 220);
    });

    el.append(msg, close);
    toastHost.prepend(el);
    requestAnimationFrame(() => el.classList.add('is-visible'));

    setTimeout(() => {
      if (!el.isConnected) return;
      el.classList.remove('is-visible');
      setTimeout(() => el.remove(), 220);
    }, durationMs);

    const maxToasts = 3;
    const children = Array.from(toastHost.children);
    for (let i = maxToasts; i < children.length; i++) {
      children[i].remove();
    }
  }

  return Object.freeze({ showToast });
}
