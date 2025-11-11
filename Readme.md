# Centralized Config & Secret Manager

A lightweight, secure backend service for storing, managing, and distributing configuration values and secrets across projects and environments. Built with **FastAPI** and **MongoDB** for modern, scalable configuration management.



---

## 🚀 Current Implementation Status

This project is currently in **Phase 2** - Authentication & Frontend completed.

<img width="1469" height="631" alt="image" src="https://github.com/user-attachments/assets/964083d0-20f8-4420-959e-1969fa56aa17" />

**📋 See detailed development progress:** [Progress.md](./Progress.md)

---

## ✅ Implemented Features

### Core Features
* **Complete CRUD Operations** for configuration management
* **Dynamic environment support** - Adapts to any naming convention (dev/prod, staging, team-alpha, etc.)
* **Service-based configuration** grouping with metadata tracking
* **RESTful API** with proper HTTP status codes and error handling
* **MongoDB integration** with async operations and indexing

### Authentication & Security
* **JWT-based authentication** with 24-hour token expiry
* **Email/password registration** with argon2 password hashing
* **Google OAuth 2.0 integration** - Login with Google
* **Multi-provider support** - Users can link multiple auth methods
* **Protected routes** - JWT token validation on sensitive endpoints
* **Email verification system** with Redis-backed token storage

### Frontend
* **Professional dark theme UI** with GitHub-inspired design
* **Key-value pair interface** for easy configuration editing
* **Real-time search & filtering** with environment-based filters
* **Dynamic environment management** - Create environments on-the-fly
* **Responsive design** - Works on desktop, tablet, and mobile
* **OAuth login integration** - One-click Google sign-in

### Architecture
* **Layered architecture** (Routes → Services → Database)
* **Comprehensive error handling** with custom exception classes
* **Redis caching layer** for session management
* **Email service** with SMTP integration
* **Production-ready deployment** on Render

---

## 🛠 Tech Stack

* **Backend:** Python 3.11+ + [FastAPI](https://fastapi.tiangolo.com/)
* **Database:** MongoDB Atlas (NoSQL, document-based storage)
* **Cache:** Redis (session management, email verification tokens)
* **Async Driver:** Motor (async MongoDB driver)
* **Authentication:** JWT (python-jose), OAuth 2.0 (Google)
* **Password Hashing:** Argon2
* **Email:** SMTP (Gmail)
* **Frontend:** Vanilla JavaScript, HTML5, CSS3
* **Deployment:** Render
* **Server:** Uvicorn (ASGI server)

---

## 📋 API Endpoints

### **Authentication**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Register new user with email/password |
| `POST` | `/auth/login` | Login and get JWT token |
| `GET` | `/auth/me` | Get current user info (protected) |
| `GET` | `/auth/user/{email}` | Get user by email |
| `GET` | `/auth/google/login` | Initiate Google OAuth login |
| `GET` | `/auth/google/callback` | Handle Google OAuth callback |

### **Configuration Management**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/configs` | Create a new configuration |
| `GET` | `/configs` | Get all configurations |
| `GET` | `/configs/{config_id}` | Get configuration by ID |
| `GET` | `/configs/search?service_name=X&env_name=Y` | Get configs by service and environment |
| `GET` | `/configs/meta/environments` | Get list of all environments |
| `PUT` | `/configs/{config_id}` | Update configuration |
| `DELETE` | `/configs/{config_id}` | Delete configuration |

---

## 🚀 Getting Started

### Prerequisites

* Python 3.11+
* MongoDB Atlas account (or local MongoDB instance)
* Git

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Y45H-GitHub/centralized-config-secret-manager.git
   cd centralized-config-secret-manager
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv .venv
   .venv\Scripts\activate  # Windows
   # source .venv/bin/activate  # Linux/Mac
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables:**
   ```bash
   # Create .env file with the following variables
   
   # Database
   MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/?appName=Cluster0
   DB_NAME=config_manager
   
   # Environment
   ENVIRONMENT=local  # or production
   
   # Google OAuth
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   LOCAL_REDIRECT_URI=http://localhost:8000/auth/google/callback
   PRODUCTION_REDIRECT_URI=https://your-domain.com/auth/google/callback
   GOOGLE_AUTH_URL=https://accounts.google.com/o/oauth2/v2/auth
   GOOGLE_TOKEN_URL=https://oauth2.googleapis.com/token
   GOOGLE_USERINFO_URL=https://www.googleapis.com/oauth2/v3/userinfo
   
   # Redis
   REDIS_URL=redis://localhost:6379  # or your Redis URL
   
   # Email (SMTP)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-app-password
   FROM_EMAIL=your-email@gmail.com
   ```

5. **Run the application:**
   ```bash
   uvicorn app.main:app --reload
   ```

6. **Access the application:**
   - Frontend: http://localhost:8000
   - API docs: http://localhost:8000/docs
   - ReDoc: http://localhost:8000/redoc

---

## 📖 Usage Examples

### Register a User
```http
POST /auth/register
Content-Type: application/json

{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "securepassword123"
}
```

### Login
```http
POST /auth/login
Content-Type: application/json

{
    "email": "john@example.com",
    "password": "securepassword123"
}

Response:
{
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "user_id": "507f1f77bcf86cd799439011"
}
```

### Create a Configuration (Protected)
```http
POST /configs
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
    "service_name": "user-service",
    "env_name": "production",
    "data": {
        "DB_HOST": "prod-db.example.com",
        "DB_PORT": "5432",
        "API_KEY": "secret-key-123"
    }
}
```

### Get All Configurations
```http
GET /configs
Authorization: Bearer <your-jwt-token>
```

### Get Configuration by Service + Environment
```http
GET /configs/search?service_name=user-service&env_name=production
Authorization: Bearer <your-jwt-token>
```

---

## 🏗 Project Structure

```
centralized-config-secret-manager/
├── app/
│   ├── core/
│   │   ├── auth.py              # JWT authentication logic
│   │   ├── database.py          # MongoDB connection
│   │   └── redis_client.py      # Redis connection
│   ├── models/
│   │   ├── config_schema.py     # Config Pydantic models
│   │   ├── user_schemas.py      # User Pydantic models
│   │   └── oauth_schemas.py     # OAuth Pydantic models
│   ├── routes/
│   │   ├── config_routes.py     # Config API endpoints
│   │   └── auth_routes.py       # Auth API endpoints
│   ├── services/
│   │   ├── config_service.py    # Config business logic
│   │   ├── user_service.py      # User management logic
│   │   ├── auth_service.py      # JWT token logic
│   │   ├── oauth_service.py     # OAuth provider logic
│   │   └── email_service.py     # Email sending logic
│   ├── exceptions/
│   │   └── custom_exceptions.py # Custom exception classes
│   └── main.py                  # FastAPI app
├── static/
│   ├── index.html               # Frontend UI
│   ├── script.js                # Frontend logic
│   └── style.css                # Frontend styling
├── md/
│   └── OAUTH_EXPLANATION.md     # OAuth documentation
├── .env                         # Environment variables (not in repo)
├── .gitignore
├── requirements.txt
├── Progress.md                  # Development progress log
└── README.md
```

---

## 🔮 Planned Features (Future Phases)

### Phase 3: Advanced Security
* Role-based access control (Admin, Editor, Reader)
* API key management for services
* GitHub OAuth integration
* Two-factor authentication (2FA)

### Phase 4: Advanced Features
* Configuration versioning and audit logs
* Encryption at rest and in transit
* Configuration templates and inheritance
* Bulk import/export functionality

### Phase 5: Operations & Monitoring
* Health checks and monitoring endpoints
* Configuration change notifications
* Backup and restore functionality
* Usage analytics dashboard

### Phase 6: Ecosystem
* CLI tool for local development
* Docker containerization
* CI/CD integration examples
* Multi-tenant support
* Webhook integrations

---

## 🤝 Contributing

This is a learning project, but contributions and suggestions are welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📚 Learning Resources

This project was built while learning FastAPI and MongoDB. Check out [Progress.md](./Progress.md) for detailed learning notes, comparisons with Spring Boot, and technical insights.

---

## 🎯 Why This Project?

Many startups store secrets in deployment platforms like Railway or GitHub Actions, giving anyone with deploy access full visibility into production credentials. This project aims to provide:

* **Centralized secret management**
* **Least privilege access** (planned)
* **Audit trails** (planned)
* **Environment isolation**
* **Scalable architecture**

Making deployments safer and more maintainable for teams of all sizes.

---
