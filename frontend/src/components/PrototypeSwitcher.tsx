// PROTOTYPE tooling — thanh chuyển phương án ở đáy màn hình. Chỉ hiện ở dev.
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export function PrototypeSwitcher({ variants, names, current }: { variants: string[]; names?: Record<string, string>; current: string }) {
  const [params, setParams] = useSearchParams();
  const i = Math.max(0, variants.indexOf(current));
  const go = (d: number) => {
    const next = new URLSearchParams(params);
    next.set('variant', variants[(i + d + variants.length) % variants.length]);
    setParams(next, { replace: true });
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, [contenteditable="true"]')) return;
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (!import.meta.env.DEV) return null;
  const btn: React.CSSProperties = { background: 'none', border: 0, color: '#fff', fontSize: 18, cursor: 'pointer', padding: '4px 10px' };
  return (
    <div style={{ position: 'fixed', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: '#111', color: '#fff', borderRadius: 999, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, boxShadow: '0 4px 16px rgba(0,0,0,.35)', fontSize: 14 }}>
      <button style={btn} onClick={() => go(-1)} aria-label="Phương án trước">←</button>
      <span>{current}{names?.[current] ? ` (${names[current]})` : ''}</span>
      <button style={btn} onClick={() => go(1)} aria-label="Phương án sau">→</button>
    </div>
  );
}
