# Centralized Config & Secret Manager

A lightweight, secure backend service for storing, managing, and distributing configuration values and secrets across projects and environments. Designed for developers, teams, and startups to enforce **least privilege access**, **audit trails**, and **versioned secret management**.

---

## Features

* Role-based access control (Admin, Editor, Reader)
* Multi-environment support (Dev, Staging, Prod)
* CRUD operations for secrets
* Encryption at rest and in transit
* Versioning and audit logs for secret changes
* Token-based API access for services/CI pipelines
* Optional caching for high-frequency reads

---

## Tech Stack

* **Backend:** Python 3 + [FastAPI](https://fastapi.tiangolo.com/)
* **Database:** MongoDB (NoSQL, document-based storage)
* **Cache (optional):** Redis
* **Authentication:** JWT tokens
* **Encryption:** AES/Fernet (cryptography library)
* **Containerization:** Docker
* **Testing:** Pytest

---

## Getting Started

### Prerequisites

* Python 3.11+
* MongoDB instance
* Redis instance (optional)
* Docker (for containerized deployment)

---

## Usage

* Add a new secret:

```http
POST /projects/{project_id}/secrets
{
    "key": "DB_PASSWORD",
    "value": "mypassword",
    "env": "prod"
}
```

* Fetch secrets for a project/environment:

```http
GET /projects/{project_id}/secrets?env=prod
```

* Retrieve a single secret:

```http
GET /projects/{project_id}/secrets/DB_PASSWORD
```

* Update a secret (creates a new version):

```http
PUT /projects/{project_id}/secrets/DB_PASSWORD
{
    "value": "newpassword"
}
```

---

## Future Improvements

* Secret rotation scheduler
* CLI tool for fetching secrets locally
* Multi-tenant dashboards for admin users
* CI/CD integration for automatic secret injection
* Audit analytics and monitoring

---

## Why This Project?

Many startups store secrets in deployment platforms like Railway or GitHub Actions, giving anyone with deploy access full visibility into production credentials. This project enforces **least privilege access**, centralizes secret management, and provides **auditability and security**, making your deployments safer and more maintainable.

---