from fastapi import APIRouter, HTTPException, Depends
from app.models.user_schemas import UserCreate, UserLogin, UserResponse
from app.services.user_service import UserService
from app.services.auth_service import AuthService
from app.core.auth import get_current_user
from app.services.oauth_service import OAuthService
from  dotenv import load_dotenv
from fastapi.responses import RedirectResponse
import urllib.parse

load_dotenv()

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

# ============================================
# OAuth Routes
# ============================================

@router.get("/google/login")
def google_login():
    """
    Step 1: Generate Google OAuth URL

    """
    from app.services.oauth_service import OAuthService
    
    oauth_service = OAuthService()
    auth_url = oauth_service.get_google_auth_url()
    
    return {"auth_url": auth_url}


@router.get("/google/callback")
async def google_callback(code: str):
    """
    Step 2: Handle Google OAuth callback
    
    Instead of returning JSON, we redirect back to the frontend
    with the token in the URL. The frontend JavaScript will:
    1. Extract the token from URL
    2. Store it in localStorage
    3. Clean up the URL
    4. Update the UI
    """
    try:
        # Initialize services
        oauth_service = OAuthService()
        user_service = UserService()
        auth_service = AuthService()
        
        # Let the service handle all the OAuth logic
        result = await oauth_service.handle_google_callback(
            code=code,
            user_service=user_service,
            auth_service=auth_service
        )
        
        # Instead of returning JSON, redirect to frontend with token
        # Frontend will be at: http://localhost:8000/?token=...&user=...
        token = result["token"]
        user_json = urllib.parse.quote(str(result["user"]).replace("'", '"'))
        
        # Redirect to homepage with token in URL
        redirect_url = f"/?token={token}&user={user_json}"
        return RedirectResponse(url=redirect_url)
        
    except HTTPException:
        # On error, redirect to homepage with error message
        return RedirectResponse(url="/?error=oauth_failed")
    except Exception as e:
        # Catch any unexpected errors
        return RedirectResponse(url=f"/?error={str(e)}")
