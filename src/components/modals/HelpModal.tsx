interface Props {
  onClose: () => void;
}

export function HelpModal({ onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal help-content" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="help-title">
        <h2 id="help-title">ArchiStyler Online</h2>
        <p>
          Онлайн-конструктор архитектуры приложений. Рисуйте UML-подобные диаграммы классов, изучайте паттерны GoF и
          архитектурные стили (MVP, MVVM, слои, Repository).
        </p>
        <p>
          <strong>Без локальных проектов:</strong> всё хранится в браузере (localStorage). Экспорт/импорт — JSON файл
          формата <code>.archistyler.json</code>.
        </p>
        <p>
          <strong>Связи:</strong> перетащите от cyan-якоря на карточке к другому классу. Наследование и реализация
          обновляют модель класса и отображаются стрелками. <strong>Панорама:</strong> зажатая ЛКМ на фоне.{' '}
          <strong>Масштаб:</strong> колёсико мыши (к точке под курсором), кнопки +/− или «вписать».
        </p>
        <p>
          <strong>Безопасность:</strong> приложение статическое, без сервера; импорт JSON проходит валидацию; данные не
          покидают ваш браузер без явного экспорта.
        </p>
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
}
