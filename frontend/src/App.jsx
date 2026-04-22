import { CheckCircle2, Circle, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import "./App.css";

const STUDENT_NAME = "Eldos Kubatov";
const STUDENT_ID = "220505";

const getApiUrl = () => {
  const runtimeApiUrl = window.__APP_CONFIG__?.VITE_API_URL;
  const buildApiUrl = import.meta.env.VITE_API_URL;
  return (runtimeApiUrl || buildApiUrl || "http://localhost:5000").replace(/\/$/, "");
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

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <h1>Full-Stack CI/CD App</h1>
            <p>React Frontend + Flask API + PostgreSQL</p>
          </div>
          <div className="student-badge">
            <span>Студент</span>
            <strong>{STUDENT_NAME}</strong>
            <strong>ID: {STUDENT_ID}</strong>
          </div>
        </div>
      </header>

      <section className="workspace">
        <div className="panel">
          <form className="toolbar" onSubmit={addItem}>
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
          </form>

          {error ? <div className="error-banner">{error}</div> : null}

          <div className="summary-row">
            <span>
              Всего записей: <strong>{stats.total}</strong>
            </span>
            <span className={`status ${error ? "status-error" : ""}`}>
              <span className="status-dot" aria-hidden="true" />
              {error ? "Проверьте API" : isLoading ? "Загрузка" : "API подключен"}
            </span>
          </div>

          <div className="stat-strip" aria-label="Статистика записей">
            <div className="stat-box">
              <span>Активные</span>
              <strong>{stats.pending}</strong>
            </div>
            <div className="stat-box">
              <span>Готовые</span>
              <strong>{stats.completed}</strong>
            </div>
            <div className="filters" aria-label="Фильтр">
              <button
                className={filter === "all" ? "filter-button active" : "filter-button"}
                type="button"
                onClick={() => setFilter("all")}
              >
                Все
              </button>
              <button
                className={filter === "open" ? "filter-button active" : "filter-button"}
                type="button"
                onClick={() => setFilter("open")}
              >
                Активные
              </button>
              <button
                className={filter === "done" ? "filter-button active" : "filter-button"}
                type="button"
                onClick={() => setFilter("done")}
              >
                Готовые
              </button>
            </div>
          </div>

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
            <p className="empty-state">
              {isLoading ? "Загрузка данных..." : "Нет записей для выбранного фильтра."}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

export default App;
