# ArchiStyler Online

Онлайн-конструктор архитектуры приложений — SPA для **GitHub Pages**. Визуально проектируйте UML-подобные схемы классов, изучайте **ООП**, **паттерны GoF** и архитектурные стили (MVP, MVVM, Repository, слои).

Портировано с десктопного [ArchiStyler](https://github.com/) (C# / Avalonia) с фокусом на **схематическое проектирование** без локальных проектов и экспорта на диск.

## Возможности

- Интерактивная диаграмма: классы, папки-слои, связи (наследование, реализация, композиция, зависимости)
- **24+ шаблонов паттернов** из `public/templates/` (MVP, MVVM, Singleton, GoF и др.)
- Превью кода **C#** и **Java**
- Тёмная неоновая и светлая тема
- Автосохранение в `localStorage`
- Импорт / экспорт `.archistyler.json` (валидация, лимит 2 МБ)
- Статическое приложение: без бэкенда, данные не уходят с устройства без явного экспорта

## Локальная разработка

```bash
npm install
npm run dev
```

## Сборка

```bash
npm run build
npm run preview
```

Для GitHub Pages **project site** (`username.github.io/repo-name/`) в CI задаётся `VITE_BASE_PATH=/<repo>/`.

Для **user/org** site (`username.github.io`) соберите с `VITE_BASE_PATH=/` (по умолчанию).

## Деплой на GitHub Pages

1. В настройках репозитория: **Pages → Source: GitHub Actions**
2. Push в `main` — workflow `.github/workflows/deploy.yml` соберёт и опубликует `dist/`

## Формат данных

```json
{
  "schemaVersion": 1,
  "name": "Моя схема",
  "language": "csharp",
  "defaultNamespace": "App.Architecture",
  "folders": [],
  "classes": [],
  "relations": []
}
```

## Безопасность

- Content-Security-Policy в `index.html`
- Строгая валидация импортируемого JSON
- Нет `eval`, нет внешних API
- Ограничения на размер и количество элементов

## Лицензия

MIT (при необходимости уточните у автора исходного ArchiStyler)
