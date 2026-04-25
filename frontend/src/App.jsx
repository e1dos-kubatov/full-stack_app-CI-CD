import { Activity, CheckCircle2, Circle, ListTodo, Plus, RefreshCw, Trash2, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import "./App.css";

const STUDENT_NAME = "Eldos Kubatov";
const STUDENT_ID = "220505";

const getDefaultApiUrl = () => {
  if (typeof window === "undefined") {
    return "http://localhost:5000";
  }

  const { hostname, origin } = window.location;
  const isLocalhost =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

  return isLocalhost ? "http://localhost:5000" : origin;
};

const getApiUrl = () => {
  const runtimeApiUrl = window.__APP_CONFIG__?.VITE_API_URL?.trim();
  const buildApiUrl = import.meta.env.VITE_API_URL?.trim();

  return (runtimeApiUrl || buildApiUrl || getDefaultApiUrl()).replace(/\/$/, "");
};

const FILTER_LABELS = {
  all: "Все",
  open: "Активные",
  done: "Готовые",
};

function App() {
  const apiUrl = useMemo(getApiUrl, []);
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const stats = useMemo(() => {
    const completed = items.filter((item) => item.completed).length;
    return {
      total: items.length,
      completed,
      pending: items.length - completed,
    };
  }, [items]);

  const visibleItems = useMemo(() => {
    if (filter === "open") {
      return items.filter((item) => !item.completed);
    }

    if (filter === "done") {
      return items.filter((item) => item.completed);
    }

    return items;
  }, [filter, items]);

  const loadItems = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`${apiUrl}/api/data`);

      if (!response.ok) {
        throw new Error("API returned an error");
      }

      setItems(await response.json());
    } catch {
      setError("Не удалось загрузить данные из Backend API.");
    } finally {
      setIsLoading(false);
    }
  };

  const addItem = async (event) => {
    event.preventDefault();
    const nextTitle = title.trim();

    if (!nextTitle) {
      setError("Введите название записи.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const response = await fetch(`${apiUrl}/api/data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: nextTitle }),
      });

      if (!response.ok) {
        throw new Error("API returned an error");
      }

      const createdItem = await response.json();
      setItems((currentItems) => [...currentItems, createdItem]);
      setTitle("");
    } catch {
      setError("Не удалось добавить запись.");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteItem = async (itemId) => {
    setError("");

    try {
      const response = await fetch(`${apiUrl}/api/data/${itemId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("API returned an error");
      }

      setItems((currentItems) => currentItems.filter((item) => item.id !== itemId));
    } catch {
      setError("Не удалось удалить запись.");
    }
  };

  const toggleItem = async (item) => {
    setError("");

    try {
      const response = await fetch(`${apiUrl}/api/data/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ completed: !item.completed }),
      });

      if (!response.ok) {
        throw new Error("API returned an error");
      }

      const updatedItem = await response.json();
      setItems((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.id === updatedItem.id ? updatedItem : currentItem,
        ),
      );
    } catch {
      setError("Не удалось обновить запись.");
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const connectionStatus = error ? "Ошибка" : isLoading ? "Загрузка" : "Онлайн";
  const visibleCountLabel = `${visibleItems.length} ${visibleItems.length === 1 ? "запись" : "записей"}`;
  const overviewItems = [
    { key: "total", label: "Всего", value: stats.total, icon: ListTodo, tone: "overview-total" },
    { key: "pending", label: "Активные", value: stats.pending, icon: Circle, tone: "overview-open" },
    {
      key: "completed",
      label: "Готовые",
      value: stats.completed,
      icon: CheckCircle2,
      tone: "overview-done",
    },
    {
      key: "api",
      label: "API",
      value: connectionStatus,
      icon: Activity,
      tone: error ? "overview-error" : "overview-live",
    },
  ];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="eyebrow">Task Workspace</span>
            <h1>Full-Stack CI/CD App</h1>
          </div>
          <div className="identity-chip">
            <span className="identity-icon" aria-hidden="true">
              <User size={18} />
            </span>
            <div className="identity-copy">
              <span className="identity-label">Студент</span>
              <strong>{STUDENT_NAME}</strong>
            </div>
            <span className="identity-id">ID {STUDENT_ID}</span>
          </div>
        </div>
      </header>

      <section className="workspace">
        <div className="overview-grid" aria-label="Статистика">
          {overviewItems.map((item) => {
            const Icon = item.icon;
            return (
              <article className={`overview-tile ${item.tone}`} key={item.key}>
                <span className="overview-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span className="overview-label">{item.label}</span>
                <strong className="overview-value">{item.value}</strong>
              </article>
            );
          })}
        </div>

        <div className="dashboard-layout">
          <div className="main-column">
            <section className="panel composer-panel">
              <div className="panel-header">
                <div>
                  <span className="panel-kicker">Ввод</span>
                  <h2>Новая запись</h2>
                </div>
                <button
                  className="icon-button"
                  type="button"
                  onClick={loadItems}
                  disabled={isLoading}
                  aria-label="Обновить"
                  title="Обновить"
                >
                  <RefreshCw size={18} aria-hidden="true" />
                </button>
              </div>

              <form className="composer-form" onSubmit={addItem}>
                <input
                  className="task-input"
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Новая запись"
                  aria-label="Новая запись"
                />
                <button className="primary-button" type="submit" disabled={isSaving}>
                  <Plus size={18} aria-hidden="true" />
                  {isSaving ? "Сохранение" : "Добавить"}
                </button>
              </form>
            </section>

            <section className="panel list-panel">
              <div className="panel-header list-header">
                <div className="list-heading">
                  <span className="panel-kicker">Список</span>
                  <div className="list-heading-row">
                    <h2>Записи</h2>
                    <span className="count-badge">{visibleCountLabel}</span>
                  </div>
                </div>

                <div className="filters" aria-label="Фильтр">
                  {Object.entries(FILTER_LABELS).map(([value, label]) => (
                    <button
                      key={value}
                      className={filter === value ? "filter-button active" : "filter-button"}
                      type="button"
                      onClick={() => setFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {error ? <div className="error-banner">{error}</div> : null}

              {visibleItems.length > 0 ? (
                <ul className="task-list">
                  {visibleItems.map((item) => (
                    <li className="task-item" key={item.id}>
                      <button
                        className="toggle-complete"
                        type="button"
                        onClick={() => toggleItem(item)}
                        aria-label={item.completed ? "Вернуть в активные" : "Отметить готовым"}
                        title={item.completed ? "Вернуть в активные" : "Отметить готовым"}
                      >
                        {item.completed ? (
                          <CheckCircle2 size={22} aria-hidden="true" />
                        ) : (
                          <Circle size={22} aria-hidden="true" />
                        )}
                      </button>
                      <div className="task-content">
                        <p className={item.completed ? "task-title completed" : "task-title"}>
                          {item.title}
                        </p>
                        <p className="task-meta">
                          #{item.id}
                          {item.created_at ? ` | ${new Date(item.created_at).toLocaleString()}` : ""}
                        </p>
                      </div>
                      <button
                        className="delete-button"
                        type="button"
                        onClick={() => deleteItem(item.id)}
                        aria-label={`Удалить ${item.title}`}
                        title="Удалить"
                      >
                        <Trash2 size={18} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-state">
                  <span className="empty-icon" aria-hidden="true">
                    <ListTodo size={22} />
                  </span>
                  <p>{isLoading ? "Загрузка данных..." : "Нет записей для выбранного фильтра."}</p>
                </div>
              )}
            </section>
          </div>

          <aside className="panel side-panel">
            <div className="side-section">
              <span className="panel-kicker">Профиль</span>
              <div className="side-value-group">
                <strong>{STUDENT_NAME}</strong>
                <span>ID {STUDENT_ID}</span>
              </div>
            </div>

            <div className="side-section">
              <span className="panel-kicker">Подключение</span>
              <span className={`status-pill ${error ? "status-pill-error" : ""}`}>
                {connectionStatus}
              </span>
              <code className="endpoint-text">{apiUrl}</code>
            </div>

            <div className="side-section">
              <span className="panel-kicker">Текущий фильтр</span>
              <div className="side-value-group">
                <strong>{FILTER_LABELS[filter]}</strong>
                <span>{visibleCountLabel}</span>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

export default App;
