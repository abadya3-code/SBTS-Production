# SBTS Hosting Portability

SBTS 2.1 is provider-neutral at the application layer.

## Required services

- OCI/Docker-compatible container runtime.
- MySQL 8 or a compatible TiDB service.
- Persistent S3-compatible object storage when evidence upload is enabled.
- HTTPS reverse proxy.

## Required runtime variables

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=<provided by host>
DATABASE_URL=mysql://...
JWT_SECRET=<fixed strong secret>
VITE_APP_ID=sbts-production
ENABLE_OAUTH=false
STORAGE_REQUIRED=false
```

## Generic Docker deployment

```bash
docker build -t sbts:2.1.0 .
docker run --rm -p 3000:3000 --env-file .env.production sbts:2.1.0
```

Before starting a new revision, execute inside the same image/network:

```bash
pnpm railway:predeploy
```

Despite the script name, the command is host-neutral: it validates the environment, applies migrations, optionally bootstraps an administrator and runs the production doctor.

## Platform mapping

- Railway: `railway.json` + Dockerfile.
- Render/Fly.io/Azure Web App/Google Cloud Run/AWS ECS: Dockerfile, host-specific database and environment configuration.
- Kubernetes: Deployment + Service + pre-deploy Job using the same image.

Never bake passwords, `.env`, database URLs or storage keys into the image or repository.
