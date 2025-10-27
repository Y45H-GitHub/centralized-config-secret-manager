# Development Progress

## October 25, 2025

### MongoDB Atlas Setup
- Using qwik1 account for MongoDB Atlas
- Created cluster (credentials stored in notebook)
- Set username and password
- Installed motor: `pip install motor` (async MongoDB driver)

### MongoDB Connection Configuration
```python
client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
```

### Understanding MongoDB + Motor Architecture

**Motor** - The driver
```python
import motor.motor_asyncio
```

**Client** - Connection to the MongoDB server
- "Hey Motor, connect me to this MongoDB server"

**Database** - Specific database on that server
```python
db = client[DB_NAME]
```
- "From that server I want the `<db_name>` database"

**Collection** - Specific table in the database
```python
COLLECTION = db['configs']
```
- "From that database I want the 'configs' collection"

### Database Operations

1. **CREATE**
   ```python
   collection.insert_one()
   ```

2. **READ**
   ```python
   collection.find_one()
   collection.find()
   ```

### Key Learnings

- Every MongoDB document gets an `_id` field automatically
- ObjectId to string conversion: `"id": str(config["_id"])`

### Complete Data Flow
1. Postman sends JSON → FastAPI
2. FastAPI validates with Pydantic → ConfigCreate object  
3. Route calls service function
4. Service talks to MongoDB via Motor
5. MongoDB stores/retrieves data
6. Motor converts MongoDB response to Python
7. Service processes and returns data
8. FastAPI converts to JSON response
9. Postman receives JSON


## October 26, 2025

### System Architecture & CRUD Implementation
- Designed High-Level Design (HLD) of the system
- Implemented complete CRUD operations:
  - ✅ **CREATE**: `POST /configs`
  - ✅ **READ**: `GET /configs` (get all), `GET /configs/{id}` (get by ID), `GET /configs/search` (get by name+env)
  - ✅ **UPDATE**: `PUT /configs/{id}`
  - ✅ **DELETE**: `DELETE /configs/{id}`
  - Made GET /configs/search to return list of all configs by name+env

### Key Technical Learnings

#### 1. MongoDB ObjectId Handling
**Problem**: Type mismatch between MongoDB and API
```python
# MongoDB stores:
_id: ObjectId("507f1f77bcf86cd799439011")

# API receives:
config_id: "507f1f77bcf86cd799439011" (string)
```

**Solution**: Use BSON for conversion
```python
from bson import ObjectId
ObjectId(config_id)  # Convert string to ObjectId
```

#### 2. FastAPI + MongoDB vs Spring Boot + JPA

| Aspect | Spring Boot + JPA | FastAPI + MongoDB |
|--------|-------------------|-------------------|
| **Data Model** | Entity classes mapped to SQL tables | Direct JSON documents |
| **Operations** | Object-oriented (modify objects) | Document-oriented (direct updates) |
| **Update Pattern** | Fetch → Modify → Save | Direct atomic updates |

**Spring Boot Pattern:**
```java
// 1. Fetch entity
Config config = repository.findById(id);
// 2. Modify in memory  
config.setServiceName("new-name");
// 3. Save (triggers UPDATE SQL)
repository.save(config);
```

**FastAPI + MongoDB Pattern:**
```python
# Direct atomic update
await COLLECTION.update_one(
    {'_id': ObjectId(config_id)},           # WHERE clause
    {'$set': {'service_name': 'new-name'}}  # SET clause
)
```

#### 3. MongoDB Update Operators
- **`$set`**: Update/add fields
- **`$unset`**: Remove fields  
- **`$inc`**: Increment numbers
- **`$push`**: Add to array

#### 4. MongoDB vs SQL Mapping
- **Collection** = Database table
- **Document** = Table row (flexible JSON structure)
- **`update_one()`** = Custom UPDATE SQL with WHERE clause
- **`$set`** = SET clause in SQL

**Key Difference**: MongoDB operates directly on document structure, while JPA operates on Java objects that get translated to SQL.

#### 5. FastAPI Server Configuration
**Command**: `uvicorn app.main:app --reload`

**Breakdown**:
- **`uvicorn`**: ASGI server (like Tomcat for Spring Boot)
  - Alternatives: Gunicorn, Hypercorn
- **`app.main:app`**: Module path (`package.file:variable`)
- **`--reload`**: Development flag (auto-restart on code changes)

**Examples**:
```bash
# If FastAPI instance is named differently:
my_api = FastAPI()
# Command: uvicorn app.main:my_api --reload

# If different file structure:
uvicorn backend.server:api --reload
```

#### 6. MongoDB Atlas IP Management
**Challenge**: Need to update IP address when network changes (WiFi, hotspot, etc.)

**Solutions**:
1. **Allow all IPs**: `0.0.0.0/0` (development only)
2. **Add multiple IPs**: Home, office, mobile hotspot
3. **Use IP ranges**: Broader network ranges
4. **Cloud deployment**: Static IP through cloud providers

## October 27, 2025

ai-generated static frontend to serve the backend
added CORS in main.py 
app.mount to server the static files
app.add_middleware for CORS
to server the frontend files at root
@app.get("/")
async def read_root():
    from fastapi.responses import FileResponse
    return FileResponse('static/index.html')


