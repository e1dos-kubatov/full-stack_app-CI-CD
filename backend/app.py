import os
import time
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import inspect, text
from sqlalchemy.engine import make_url


db = SQLAlchemy()


def utcnow():
    return datetime.now(timezone.utc)


class Item(db.Model):
    __tablename__ = "items"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    completed = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "completed": self.completed,
            "created_at": serialize_datetime(self.created_at),
            "updated_at": serialize_datetime(self.updated_at),
        }


def normalize_database_url(database_url):
    if database_url and database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql://", 1)
    return database_url


def sqlite_url_from_path(sqlite_path):
    resolved_path = Path(sqlite_path).expanduser().resolve()
    return f"sqlite:///{resolved_path.as_posix()}"


def resolve_database_url():
    database_url = normalize_database_url(os.getenv("DATABASE_URL"))
    if database_url:
        return database_url

    sqlite_path = os.getenv("SQLITE_PATH", "").strip()
    if sqlite_path:
        return sqlite_url_from_path(sqlite_path)

    return "sqlite:///app.db"


def ensure_sqlite_directory(database_url):
    if not database_url:
        return

    url = make_url(database_url)
    if url.drivername != "sqlite" or not url.database or url.database == ":memory:":
        return

    parent_dir = Path(url.database).parent
    if str(parent_dir) not in {"", "."}:
        parent_dir.mkdir(parents=True, exist_ok=True)


def serialize_datetime(value):
    return value.isoformat() if value else None


def parse_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y", "on"}
    return bool(value)


def run_with_retries(operation, retries, delay_seconds, on_retry=None):
    for attempt in range(1, retries + 1):
        try:
            return operation()
        except Exception as exc:
            if attempt == retries:
                raise
            if on_retry:
                on_retry(attempt, retries, exc)
            time.sleep(delay_seconds)


def check_database_connection():
    try:
        db.session.execute(text("SELECT 1"))
        return True
    except Exception:
        db.session.rollback()
        return False


def ensure_schema(app):
    retries = int(os.getenv("DB_CONNECT_RETRIES", "10"))
    delay_seconds = float(os.getenv("DB_CONNECT_DELAY", "1"))

    def init_schema():
        with app.app_context():
            db.create_all()

            inspector = inspect(db.engine)
            if "items" not in inspector.get_table_names():
                return

            existing_columns = {column["name"] for column in inspector.get_columns("items")}
            dialect = db.engine.dialect.name
            default_false = "false" if dialect == "postgresql" else "0"
            updated_at_type = (
                "TIMESTAMP WITH TIME ZONE" if dialect == "postgresql" else "TIMESTAMP"
            )
            statements = []

            if "completed" not in existing_columns:
                statements.append(
                    f"ALTER TABLE items ADD COLUMN completed BOOLEAN NOT NULL DEFAULT {default_false}"
                )

            if "updated_at" not in existing_columns:
                statements.append(f"ALTER TABLE items ADD COLUMN updated_at {updated_at_type}")

            if not statements:
                return

            with db.engine.begin() as connection:
                for statement in statements:
                    connection.execute(text(statement))
                if "updated_at" not in existing_columns:
                    connection.execute(
                        text(
                            "UPDATE items "
                            "SET updated_at = COALESCE(created_at, CURRENT_TIMESTAMP) "
                            "WHERE updated_at IS NULL"
                        )
                    )

    run_with_retries(
        init_schema,
        retries=retries,
        delay_seconds=delay_seconds,
        on_retry=lambda attempt, total, exc: app.logger.warning(
            "Database init attempt %s/%s failed: %s", attempt, total, exc
        ),
    )


def create_app(test_config=None):
    app = Flask(__name__)
    CORS(app)

    app.config.update(
        SQLALCHEMY_DATABASE_URI=resolve_database_url(),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        JSON_SORT_KEYS=False,
    )

    if test_config:
        app.config.update(test_config)

    ensure_sqlite_directory(app.config["SQLALCHEMY_DATABASE_URI"])
    db.init_app(app)

    @app.get("/")
    def index():
        return jsonify(
            {
                "message": "Full-Stack CI/CD Backend API",
                "endpoints": ["/api/data", "/api/health"],
            }
        )

    @app.get("/api/health")
    def health():
        database_connected = check_database_connection()
        return (
            jsonify(
                {
                    "status": "ok" if database_connected else "error",
                    "database": "connected" if database_connected else "disconnected",
                }
            ),
            200 if database_connected else 503,
        )

    @app.get("/api/data")
    def get_data():
        items = Item.query.order_by(Item.id.asc()).all()
        return jsonify([item.to_dict() for item in items])

    @app.get("/api/stats")
    def get_stats():
        total = Item.query.count()
        completed = Item.query.filter_by(completed=True).count()
        return jsonify(
            {
                "total": total,
                "completed": completed,
                "pending": total - completed,
            }
        )

    @app.post("/api/data")
    def create_data():
        payload = request.get_json(silent=True) or {}
        title = str(payload.get("title", "")).strip()

        if not title:
            return jsonify({"error": "Field 'title' is required"}), 400

        item = Item(title=title, completed=parse_bool(payload.get("completed", False)))
        db.session.add(item)
        db.session.commit()
        db.session.refresh(item)

        return jsonify(item.to_dict()), 201

    @app.patch("/api/data/<int:item_id>")
    def update_data(item_id):
        item = db.session.get(Item, item_id)

        if item is None:
            return jsonify({"error": "Item not found"}), 404

        payload = request.get_json(silent=True) or {}

        if "title" in payload:
            title = str(payload.get("title", "")).strip()
            if not title:
                return jsonify({"error": "Field 'title' cannot be empty"}), 400
            item.title = title

        if "completed" in payload:
            item.completed = parse_bool(payload["completed"])

        item.updated_at = utcnow()
        db.session.commit()
        db.session.refresh(item)

        return jsonify(item.to_dict())

    @app.delete("/api/data/<int:item_id>")
    def delete_data(item_id):
        item = db.session.get(Item, item_id)

        if item is None:
            return jsonify({"error": "Item not found"}), 404

        db.session.delete(item)
        db.session.commit()

        return jsonify({"message": "Item deleted", "id": item_id})

    ensure_schema(app)

    return app


app = create_app()


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port)
