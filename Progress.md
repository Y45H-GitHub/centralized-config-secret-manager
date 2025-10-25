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
