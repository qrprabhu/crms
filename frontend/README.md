# CRM Frontend

This frontend talks to the Django backend through the `/api` base path.

## Local Development

Start backend from `Backend/`:

```bash
python manage.py runserver
```

Start frontend from `frontend/`:

```bash
npm run dev
```

## Production-Oriented Commands

```bash
npm ci
npm run build
npm run start
```

`npm run start` uses Vite preview on `0.0.0.0:8080`.

## Environment

`frontend/.env`:

```env
VITE_API_BASE_URL=/api
```

If backend is hosted on a different domain:

```env
VITE_API_BASE_URL=https://your-backend-name.ondigitalocean.app/api
```

## Quick Checks

- backend is reachable on configured API base URL
- frontend loads without CORS errors
- login succeeds and tokens are stored in `localStorage`
- API requests resolve under `/api/...`