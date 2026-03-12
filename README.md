# Del Carajo — Backend API

API REST para la plataforma de e-commerce **Del Carajo**, marca de ropa urbana venezolana. Gestiona autenticación, catálogo de productos, carrito, órdenes, inventario y panel de administración.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | NestJS 11 + TypeScript 5 |
| Base de datos | PostgreSQL (Neon) via Prisma ORM 6 |
| Autenticación | JWT + Google OAuth 2.0 (Passport) |
| Almacenamiento | Cloudinary |
| Emails | Resend |
| Monitoreo | Sentry |
| Logging | Pino + pino-pretty |
| Documentación | Swagger / OpenAPI |
| Tareas programadas | @nestjs/schedule (CRON) |
| Rate limiting | @nestjs/throttler |

---

## Requisitos previos

- Node.js >= 22
- npm >= 10
- Cuenta en [Neon](https://neon.tech) (PostgreSQL serverless) o PostgreSQL local
- Cuenta en [Cloudinary](https://cloudinary.com) para subida de imágenes
- Cuenta en [Resend](https://resend.com) para emails transaccionales
- Credenciales OAuth en [Google Cloud Console](https://console.cloud.google.com)

---

## Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores reales

# 3. Generar el cliente Prisma
npm run prisma:generate

# 4. Aplicar migraciones a la base de datos
npm run prisma:migrate
```

---

## Variables de entorno

Crear un archivo `.env` en la raíz con los siguientes valores:

```env
# Servidor
PORT=3001
NODE_ENV=development

# Base de datos
DATABASE_URL=postgresql://usuario:password@host/db?sslmode=require

# Autenticación JWT
JWT_SECRET=tu_jwt_secret_muy_seguro

# Google OAuth
GOOGLE_CLIENT_ID=tu_google_client_id
GOOGLE_CLIENT_SECRET=tu_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# URL del frontend (para redirecciones OAuth)
FRONTEND_URL=http://localhost:3000

# Cloudinary (subida de imágenes)
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret

# Resend (emails transaccionales)
RESEND_API_KEY=re_xxxxxxxxxxxx

# Sentry (monitoreo, activo solo en producción)
SENTRY_DSN=https://xxxx@sentry.io/xxxx
```

---

## Base de datos

```bash
# Crear y aplicar nueva migración (desarrollo)
npm run prisma:migrate

# Abrir Prisma Studio — explorador visual de la DB
npm run prisma:studio

# Regenerar cliente Prisma tras cambios en el schema
npm run prisma:generate
```

**Modelos principales:** `User`, `Product`, `ProductVariant`, `ProductImage`, `Category`, `Subcategory`, `Cart`, `CartItem`, `Order`, `OrderItem`, `Favorite`, `Address`, `ExchangeRate`, `LandingSection`

---

## Levantar el proyecto

```bash
# Desarrollo con hot reload
npm run start:dev

# Producción (incluye migración automática)
npm run build
npm run start:prod
```

Servidor disponible en `http://localhost:3001`

---

## Scripts disponibles

| Script | Descripción |
|---|---|
| `npm run start:dev` | Desarrollo con hot reload |
| `npm run build` | Compilar TypeScript a `/dist` |
| `npm run start:prod` | Migrar DB y levantar servidor compilado |
| `npm run prisma:migrate` | Crear y aplicar nueva migración |
| `npm run prisma:generate` | Regenerar cliente Prisma |
| `npm run prisma:studio` | Abrir Prisma Studio en el navegador |

---

## Documentación API

Con el servidor corriendo, la documentación Swagger está disponible en:

```
http://localhost:3001/api/docs
```

---

## Estructura del proyecto

```
src/
├── auth/          # JWT, Google OAuth, guards, estrategias
├── users/         # Gestión de usuarios y roles
├── products/      # Catálogo, variantes, imágenes
├── categories/    # Categorías y subcategorías
├── cart/          # Carrito con expiración TTL automática
├── orders/        # Órdenes, estados y comprobantes de pago
├── favorites/     # Favoritos por usuario
├── address/       # Direcciones de entrega
├── admin/         # Panel de administración
├── landing/       # Secciones configurables del landing
├── bcv/           # Tasas de cambio BCV (scraping + CRON diario)
├── upload/        # Subida de imágenes a Cloudinary
├── mail/          # Emails transaccionales via Resend
├── prisma/        # Servicio de base de datos
├── common/        # Pipes, filtros, interceptors y decorators globales
├── config/        # Configuración de la aplicación
├── app.module.ts
└── main.ts
prisma/
└── schema.prisma  # Schema de la base de datos
```

---

## Endpoints principales

| Módulo | Ruta base | Acceso |
|---|---|---|
| Auth | `POST /api/auth/login` | Público |
| Auth Google | `GET /api/auth/google` | Público |
| Products | `GET /api/products` | Público |
| Categories | `GET /api/categories` | Público |
| BCV | `GET /api/bcv/rate` | Público |
| Cart | `GET /api/cart` | Autenticado |
| Orders | `GET /api/orders` | Autenticado |
| Favorites | `GET /api/favorites` | Autenticado |
| Address | `GET /api/address` | Autenticado |
| Admin | `GET /api/admin/*` | ADMIN / SUPER_ADMIN |
| Upload | `POST /api/upload` | ADMIN / SUPER_ADMIN |
| Landing | `GET /api/landing/sections` | Público (escritura: Admin) |
