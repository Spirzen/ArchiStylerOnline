interface Props {
  onClose: () => void;
}

export function HelpModal({ onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal help-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="help-title"
      >
        <h2 id="help-title">ArchiStyler Online</h2>
        <p>
          Конструктор архитектуры: UML-классы, паттерны GoF, слои MVP/MVVM, внешние сервисы и зависимости. Поддерживаются
          C#, Java и Python с генерацией кода.
        </p>
        <p>
          <strong>Классы:</strong> детальная настройка полей, свойств, методов, параметров, модификаторов и docstring в
          правой панели.
        </p>
        <p>
          <strong>Интеграции:</strong> добавьте REST, БД, очереди и другие сервисы; соедините с классами связями
          «Интеграция», «Вызов API», «Зависит от».
        </p>
        <p>
          <strong>Связи:</strong> потяните от цветной точки на краю карточки к другому элементу и отпустите — появится выбор
          типа связи. Или Shift+клик по карточке и потяните. Подсветка цели при наведении.
        </p>
        <p>
          <strong>Выделение:</strong> рамкой на пустом холсте, Ctrl+клик — добавить/убрать, Ctrl+A — всё. Групповое
          перемещение выделенных блоков. Shift+перетаскивание по холсту — панорама, средняя кнопка мыши — тоже.
        </p>
        <p>
          <strong>Копирование:</strong> Ctrl+C / Ctrl+V, дублирование — Ctrl+D. <strong>История:</strong> Ctrl+Z / Ctrl+Y.
          <strong> Меню:</strong> правая кнопка мыши на схеме или элементе.
        </p>
        <p>
          <strong>Навигация:</strong> список элементов слева, стрелки — сдвиг выбранного, Esc — отмена связи, Del —
          удаление. Привязка к сетке 20px, умные направляющие при перетаскивании.
        </p>
        <p>
          <strong>Хранение:</strong> IndexedDB в браузере; экспорт JSON, PNG и SVG через меню «Экспорт».
        </p>
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
}
