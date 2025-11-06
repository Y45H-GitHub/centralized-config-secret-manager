from fastapi import APIRouter, HTTPException, Depends
from app.models.user_schemas import UserCreate, UserLogin, UserResponse
from app.services.user_service import UserService
from app.services.auth_service import AuthService
from app.core.auth import get_current_user

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.post("/register")
async def register(user_data: UserCreate):
    """Register a new user with email and password"""
    user_service = UserService()
    
    try:
        # Create user
        user_id = await user_service.create_user(user_data)
        
        return {
            "message": "User registered successfully",
            "user_id": user_id
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login")
async def login(credentials: UserLogin):
    """Login with email and password"""
    user_service = UserService()
    auth_service = AuthService()
    
    try:
        # Authenticate user
        user = await user_service.authenticate_user(credentials.email, credentials.password)
        
        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Generate JWT token
        access_token = auth_service.create_access_token(user.id)
        
        return {
            "message": "Login successful",
            "access_token": access_token,
            "token_type": "bearer",
            "user_id": user.id
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/user/{email}", response_model=UserResponse)
async def get_user_by_email(email: str):
    """Get user information by email"""
    user_service = UserService()
    
    try:
        user = await user_service.get_user_by_email(email)
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return user
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user_id: str = Depends(get_current_user)):
    """Get current user information from JWT token"""
    user_service = UserService()
    
    try:
        user = await user_service.get_user_by_id(current_user_id)
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return user
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")