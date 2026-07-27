# CRM Deployment Guide (DigitalOcean App Platform)

This project is now configured for source-based deployment (no Docker files).

## 1. What To Deploy

Deploy as one **DigitalOcean App Platform app** with 2 components:

1. `backend` (Python web service) from `Backend/`
2. `frontend` (Node web service) from `frontend/`

## 2. Commands You Need

### Frontend

- Build command: `npm ci && npm run build`
- Run command: `npm run start`

`frontend/package.json` now includes:

```json
"start": "vite preview --host 0.0.0.0 --port 8080"
```

### Backend

- Build command: `pip install -r requirements.txt && python manage.py collectstatic --noinput`
- Run command: `gunicorn crm_backend.wsgi:application --bind 0.0.0.0:$PORT --workers 3 --timeout 120`

### Post Deploy (backend)

Use this as your post-deploy command:

```bash
python manage.py migrate --noinput && python manage.py create_default_admin
```

If you do not want the default admin seed command, use only:

```bash
python manage.py migrate --noinput
```

`create_default_admin` reads these backend env keys:

- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`
- `SEED_ADMIN_NAME` (optional)

## 3. Environment Variables

## Frontend env (`frontend/.env`)

```env
VITE_API_BASE_URL=/api
```

If frontend and backend are on different domains, use:

```env
VITE_API_BASE_URL=https://your-backend-name.ondigitalocean.app/api
```

## Backend env (`Backend/.env`)

Use `Backend/.env.example` as template. Minimum production keys:

- `DJANGO_SECRET_KEY`
- `DEBUG=false`
- `ALLOWED_HOSTS`
- `FRONTEND_URL`
- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`
- `DATABASE_URL` (for Neon in production)
- SMTP keys if email is required

Database behavior:

- local development: uses `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`
- production (Neon): set `DATABASE_URL` and it will override `DB_*`

## 4. DigitalOcean App Platform Setup (Step By Step)

1. Go to **Create App** in DigitalOcean.
2. Connect your Git repository.
3. Add backend component:
- Type: `Web Service`
- Source directory: `Backend`
- Environment: `Python`
- Build command: `pip install -r requirements.txt && python manage.py collectstatic --noinput`
- Run command: `gunicorn crm_backend.wsgi:application --bind 0.0.0.0:$PORT --workers 3 --timeout 120`
- HTTP route: `/api`
- Add second route for health check: `/health`

4. Add frontend component:
- Type: `Web Service`
- Source directory: `frontend`
- Environment: `Node`
- Build command: `npm ci && npm run build`
- Run command: `npm run start`
- HTTP route: `/`
- HTTP port: `8080`

5. Add environment variables for each component.
For backend production env, set Neon `DATABASE_URL` in App Platform.
If you use admin seed in post-deploy, also set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`.
6. In backend settings, set **Post Deploy Command**:

```bash
python manage.py migrate --noinput && python manage.py create_default_admin
```

7. Deploy the app.

## 5. Verification Checklist

After deployment, verify:

- Frontend opens from `/`
- Backend health: `/health/`
- API root: `/api/`
- Login and authenticated API calls work
- CORS and CSRF values match your frontend domain

## 6. Local Build/Run Reference

### Frontend local

```bash
cd frontend
npm install
npm run dev
```

### Backend local

```bash
cd Backend

# 1. Activate virtual environment (venv)
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On Windows (CMD):
.\venv\Scripts\activate.bat
# On macOS/Linux:
source venv/bin/activate

# 2. Install dependencies & run setup
pip install -r requirements.txt
python manage.py migrate --noinput
python manage.py create_default_admin

# 3. Start local development server
python manage.py runserver
```
