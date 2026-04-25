# Full-Stack приложение с CI/CD

Трехуровневое приложение для лабораторной работы:

- Frontend: React + Vite
- Backend API: Flask + SQLAlchemy
- Database: PostgreSQL на Railway
- CI: GitHub Actions + pytest
- CD: Railway deploy из GitHub
- Advanced: PATCH-обновление записей, статус выполнения, фильтры, статистика, Docker Compose и VS Code tasks

## Структура

```text
full-stack_app-CI-CD/
├── .github/workflows/ci.yml
├── backend/
│   ├── Dockerfile
│   ├── app.py
│   ├── requirements.txt
│   └── test_app.py
├── compose.yaml
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
└── README.md
```

## Backend API

Backend читает `DATABASE_URL` из переменных окружения. Если переменной нет, локально используется SQLite, чтобы тесты и разработка запускались без отдельной БД.

Для облачных баз данных backend также поддерживает:

- `DB_CONNECT_RETRIES` - число повторных попыток подключения при старте
- `DB_CONNECT_DELAY` - задержка между попытками в секундах

Эндпоинты:

| Метод | URL | Описание |
| --- | --- | --- |
| `GET` | `/api/health` | Проверка состояния API и подключения к базе |
| `GET` | `/api/data` | Получить все записи |
| `POST` | `/api/data` | Создать запись, JSON: `{ "title": "..." }` |
| `PATCH` | `/api/data/<id>` | Обновить запись, JSON: `{ "title": "...", "completed": true }` |
| `DELETE` | `/api/data/<id>` | Удалить запись |
| `GET` | `/api/stats` | Получить статистику записей |

Локальный запуск Backend:

```bash
cd backend
pip install -r requirements.txt
python app.py
```

Тесты:

```bash
cd backend
python -m pytest -q
```

## Frontend

Frontend использует переменную `VITE_API_URL`, например:

```bash
VITE_API_URL=http://localhost:5000
```

Если переменная не задана:

- локально frontend использует `http://localhost:5000`
- в production frontend пробует обращаться к своему origin, что удобно для reverse proxy и single-domain deploy

Для более надежного деплоя на Netlify/Render/GitHub Pages frontend собран с относительными путями к static assets, поэтому приложение работает не только из корня домена, но и из подкаталога.

### Netlify

В репозиторий добавлен `netlify.toml`:

```toml
[build]
  base = "frontend"
  command = "npm run build"
  publish = "dist"
```

Если в Netlify UI ранее был сохранен кастомный Build command, он имеет приоритет над `netlify.toml`. Для этого проекта в Netlify UI нужно указать:

- Base directory: `frontend`
- Build command: `npm run build`
- Publish directory: `dist`

Дополнительно в `frontend` установлен локальный build-bin `devops-fullstack`, чтобы старый command из Netlify UI не падал с `command not found`.

Локальный запуск Frontend:

```bash
cd frontend
npm install
npm run dev
```

Имя и ID студента задаются в `frontend/src/App.jsx`:

```js
const STUDENT_NAME = "Eldos Kubatov";
const STUDENT_ID = "220505";
```

## Docker Compose

Можно поднять весь стек локально одной командой:

```bash
docker compose up --build
```

После запуска:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`
- PostgreSQL: `localhost:5432`

## VS Code

В проект добавлены `.vscode/tasks.json`, `.vscode/launch.json`, `.vscode/settings.json` и рекомендации расширений.

Доступные задачи:

- `Backend: install`
- `Backend: test`
- `Frontend: install`
- `Frontend: dev`
- `Frontend: build`

## GitHub Actions CI

Workflow находится в `.github/workflows/ci.yml`. Он автоматически запускается при `push` и `pull_request` в ветку `main`:

1. Клонирует репозиторий.
2. Устанавливает Python 3.12.
3. Поднимает PostgreSQL service container.
4. Передает `DATABASE_URL` в backend.
5. Устанавливает зависимости из `backend/requirements.txt`.
6. Запускает `python -m pytest -q`.

Если GitHub Actions показывает ошибку `account is locked due to a billing issue`, это не ошибка кода. Нужно открыть GitHub account billing/settings и разблокировать Actions; после этого workflow запустится снова.

## Railway Deployment

### 1. PostgreSQL

1. Railway → New Project.
2. Add Service → Database → PostgreSQL.
3. Railway автоматически создаст `DATABASE_URL`.

### 2. Backend

1. Add Service → Deploy from GitHub repo.
2. Root Directory: `/backend`.
3. Variables:
   - `DATABASE_URL` → Reference из PostgreSQL сервиса.
   - `PORT=5000`.
4. Settings → Networking → Generate Domain.
5. Скопировать публичный Backend URL.

### 3. Frontend

1. Add Service → Deploy from GitHub repo.
2. Root Directory: `/frontend`.
3. Variables:
   - `VITE_API_URL=https://your-backend-domain.up.railway.app`.
4. Settings → Networking → Generate Domain.

Frontend Dockerfile записывает `VITE_API_URL` в runtime-конфиг, поэтому значение можно менять в Railway Variables без изменения исходного кода.

## Что сдавать

- GitHub repository URL.
- Frontend URL с Railway.
- Backend API URL с Railway.
- Скриншот GitHub Actions с зеленой галочкой.
