PY = uv run
UV_ENV = UV_CACHE_DIR=.uvcache

.PHONY: help uv-sync migrate makemigrations run test build-frontend clean lint format frontend-install frontend-test frontend-dev

help:
	@echo "Targets:"
	@echo "  uv-sync           Install Python deps via uv"
	@echo "  makemigrations    Create new Django migrations"
	@echo "  migrate           Apply database migrations"
	@echo "  run               Start Django dev server"
	@echo "  test              Run pytest"
	@echo "  frontend-install  Install frontend dependencies"
	@echo "  build-frontend    Build React assets to static/app/"
	@echo "  frontend-test     Run frontend unit tests"
	@echo "  frontend-dev      Start Vite dev server"
	@echo "  lint              Run ESLint on frontend"
	@echo "  format            Run Prettier write formatting"
	@echo "  clean             Remove build artifacts"

uv-sync:
	$(UV_ENV) uv sync

makemigrations:
	$(UV_ENV) $(PY) python manage.py makemigrations

migrate:
	$(UV_ENV) $(PY) python manage.py migrate

run:
	$(UV_ENV) $(PY) python manage.py runserver

test:
	$(UV_ENV) $(PY) pytest -q

frontend-install:
	npm install

build-frontend:
	npm run build

frontend-test:
	npm run test -- --run

frontend-dev:
	npm run dev

lint:
	npm run lint

format:
	npm run format

clean:
	rm -rf static/app/* **/__pycache__ .pytest_cache
