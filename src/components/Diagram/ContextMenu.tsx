import { useEffect, useRef } from 'react';
import { useDiagramStore } from '../../store/diagramStore';

export function ContextMenu() {
  const menu = useDiagramStore((s) => s.contextMenu);
  const clipboard = useDiagramStore((s) => s.clipboard);
  const closeContextMenu = useDiagramStore((s) => s.closeContextMenu);
  const copySelection = useDiagramStore((s) => s.copySelection);
  const pasteClipboard = useDiagramStore((s) => s.pasteClipboard);
  const deleteSelected = useDiagramStore((s) => s.deleteSelected);
  const addClass = useDiagramStore((s) => s.addClass);
  const addIntegration = useDiagramStore((s) => s.addIntegration);
  const startLinkFromSelected = useDiagramStore((s) => s.startLinkFromSelected);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      closeContextMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu();
    };
    window.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu, closeContextMenu]);

  if (!menu) return null;

  const items: { label: string; action: () => void; disabled?: boolean }[] = [];

  if (menu.target === 'canvas') {
    items.push(
      { label: 'Добавить класс', action: () => { addClass(); closeContextMenu(); } },
      { label: 'Добавить интеграцию', action: () => { addIntegration('rest'); closeContextMenu(); } },
      {
        label: 'Вставить (Ctrl+V)',
        action: () => { pasteClipboard(menu.worldX, menu.worldY); closeContextMenu(); },
        disabled: !clipboard?.classes.length && !clipboard?.integrations.length,
      },
    );
  } else if (menu.target === 'class' || menu.target === 'integration') {
    items.push(
      { label: 'Копировать (Ctrl+C)', action: () => { copySelection(); closeContextMenu(); } },
      {
        label: 'Вставить (Ctrl+V)',
        action: () => { pasteClipboard(menu.worldX, menu.worldY); closeContextMenu(); },
        disabled: !clipboard?.classes.length && !clipboard?.integrations.length,
      },
      { label: 'Начать связь отсюда', action: () => { startLinkFromSelected(); closeContextMenu(); } },
      { label: 'Удалить', action: () => { deleteSelected(); closeContextMenu(); } },
    );
  } else if (menu.target === 'relation') {
    items.push({ label: 'Удалить связь', action: () => { deleteSelected(); closeContextMenu(); } });
  }

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ left: menu.screenX, top: menu.screenY }}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className="context-menu-item"
          disabled={item.disabled}
          onClick={item.action}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
