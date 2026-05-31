const STYLE_ID = 'ecollect-ui-styles';

const css = `
@keyframes ecollect-spin {
  to { transform: rotate(360deg); }
}
@keyframes ecollect-shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-6px); }
  40%, 80% { transform: translateX(6px); }
}
.ecollect-shake {
  animation: ecollect-shake 0.4s ease;
}
`;

let injected = false;

export function injectStyles(): void {
  if (injected || typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) { injected = true; return; }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
  injected = true;
}
