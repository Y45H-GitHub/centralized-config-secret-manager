# Centralized Config & Secret Manager

A lightweight, secure backend service for storing, managing, and distributing configuration values and secrets across projects and environments. Built with **FastAPI** and **MongoDB** for modern, scalable configuration management.



---

## 🚀 Current Implementation Status

This project is currently in **Phase 1** - Core CRUD API implementation completed.

<img width="1469" height="631" alt="image" src="https://github.com/user-attachments/assets/964083d0-20f8-4420-959e-1969fa56aa17" />

**📋 See detailed development progress:** [Progress.md](./Progress.md)

---

## ✅ Implemented Features

* **Complete CRUD Operations** for configuration management
* **Multi-environment support** (Dev, Staging, Prod)
* **Service-based configuration** grouping
* **RESTful API** with proper HTTP status codes
* **MongoDB integration** with async operations
* **Layered architecture** (Routes → Services → Database)
* **Comprehensive error handling**
* **Real-world design** supporting multiple configs per service+environment

---

## 🛠 Tech Stack

* **Backend:** Python 3.11+ + [FastAPI](https://fastapi.tiangolo.com/)
* **Database:** MongoDB Atlas (NoSQL, document-based storage)
* **Async Driver:** Motor (async MongoDB driver)
* **Validation:** Pydantic models
* **Server:** Uvicorn (ASGI server)

---

## 📋 API Endpoints

### **Configuration Management**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/configs` | Create a new configuration |
| `GET` | `/configs` | Get all configurations |
| `GET` | `/configs/{config_id}` | Get configuration by ID |
| `GET` | `/configs/search?service_name=X&env_name=Y` | Get configs by service and environment |
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
   # Create .env file with your MongoDB connection
   MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/?appName=Cluster0
   DB_NAME=config_manager
   ```

5. **Run the application:**
   ```bash
   uvicorn app.main:app --reload
   ```

6. **Access the API:**
   - API: http://localhost:8000
   - Interactive docs: http://localhost:8000/docs
   - ReDoc: http://localhost:8000/redoc

---

## 📖 Usage Examples

### Create a Configuration
```http
POST /configs
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
```

### Get Configuration by Service + Environment
```http
GET /configs/search?service_name=user-service&env_name=production
```

### Update Configuration
```http
PUT /configs/{config_id}
Content-Type: application/json

{
    "service_name": "user-service",
    "env_name": "production",
    "data": {
        "DB_HOST": "new-prod-db.example.com",
        "DB_PORT": "5432",
        "API_KEY": "updated-secret-key"
    }
}
```

### Delete Configuration
```http
DELETE /configs/{config_id}
```

---

## 🏗 Project Structure

```
centralized-config-secret-manager/
├── app/
│   ├── core/
│   │   └── database.py          # MongoDB connection
│   ├── models/
│   │   └── config_schema.py     # Pydantic models
│   ├── routes/
│   │   └── config_routes.py     # API endpoints
│   ├── services/
│   │   └── config_service.py    # Business logic
│   └── main.py                  # FastAPI app
├── .env                         # Environment variables (not in repo)
├── .gitignore
├── requirements.txt
├── Progress.md                  # Development progress log
└── README.md
```

---

## 🔮 Planned Features (Future Phases)

### Phase 2: Security & Authentication
* JWT token-based authentication
* Role-based access control (Admin, Editor, Reader)
* API key management for services

### Phase 3: Advanced Features
* Configuration versioning and audit logs
* Encryption at rest and in transit
* Configuration templates and inheritance

### Phase 4: Operations & Monitoring
* Health checks and monitoring endpoints
* Configuration change notifications
* Backup and restore functionality

### Phase 5: Ecosystem
* CLI tool for local development
* Docker containerization
* CI/CD integration examples
* Multi-tenant support

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
