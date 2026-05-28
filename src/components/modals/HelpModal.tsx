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
          типа связи. Альтернатива: Shift+перетаскивание с тела карточки. Подсветка цели при наведении.
        </p>
        <p>
          <strong>Копирование:</strong> Ctrl+C / Ctrl+V. <strong>Меню:</strong> правая кнопка мыши на схеме или элементе.
        </p>
        <p>
          <strong>Навигация:</strong> список элементов слева, стрелки — сдвиг выбранного, Esc — отмена связи, Del —
          удаление. Привязка к сетке 20px.
        </p>
        <p>
          <strong>Хранение:</strong> localStorage в браузере; экспорт/импорт — <code>.archistyler.json</code>.
        </p>
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
}
