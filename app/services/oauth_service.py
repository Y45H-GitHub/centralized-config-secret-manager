"""
OAuth Service - Handles all OAuth-related business logic

This service is responsible for:
1. Communicating with OAuth providers (Google, GitHub)
2. Exchanging authorization codes for tokens
3. Getting user information from providers
"""

import os
import requests
from fastapi import HTTPException
from dotenv import load_dotenv

load_dotenv()


class OAuthService:
    def __init__(self):
        # Google OAuth configuration
        self.google_client_id = os.getenv("GOOGLE_CLIENT_ID")
        self.google_client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
        
        # Determine redirect URI based on environment
        environment = os.getenv("ENVIRONMENT", "local")
        if environment == "production":
            self.google_redirect_uri = os.getenv("PRODUCTION_REDIRECT_URI")
        else:
            self.google_redirect_uri = os.getenv("LOCAL_REDIRECT_URI")
        
        self.google_auth_url = os.getenv("GOOGLE_AUTH_URL")
        self.google_token_url = os.getenv("GOOGLE_TOKEN_URL")
        self.google_userinfo_url = os.getenv("GOOGLE_USERINFO_URL")

    def get_google_auth_url(self) -> str:
        """
        Generate the Google OAuth authorization URL
        
        This is Step 1 of OAuth flow:
        - User clicks "Login with Google"
        - We generate a URL to Google's login page
        - User gets redirected to that URL
        """
        import urllib.parse
        
        params = {
            "client_id": self.google_client_id,
            "response_type": "code",  # We want an authorization code
            "redirect_uri": self.google_redirect_uri,  # Where to return after login
            "scope": "openid email profile",  # What data we want
            "access_type": "offline",  # Get refresh token
            "prompt": "consent"  # Always show consent screen
        }
        
        # Build the full URL with query parameters
        url = f"{self.google_auth_url}?{urllib.parse.urlencode(params)}"
        return url

    def exchange_code_for_tokens(self, code: str) -> dict:
        """
        Exchange authorization code for access tokens
        
        This is Step 2 of OAuth flow:
        - Google redirects back with a code
        - We exchange this code for actual tokens
        - This happens server-to-server (secure)
        
        Returns:
            dict with 'access_token' and 'id_token'
        """
        token_data = {
            "code": code,
            "client_id": self.google_client_id,
            "client_secret": self.google_client_secret,  # Proves we're legit
            "redirect_uri": self.google_redirect_uri,
            "grant_type": "authorization_code"
        }
        
        # Call Google's token endpoint
        response = requests.post(self.google_token_url, data=token_data)
        
        # Check if successful
        if response.status_code != 200:
            raise HTTPException(
                status_code=400, 
                detail=f"Failed to get token from Google: {response.text}"
            )
        
        token_response = response.json()
        
        return {
            "access_token": token_response.get("access_token"),
            "id_token": token_response.get("id_token")
        }

    def get_user_info(self, access_token: str) -> dict:
        """
        Get user information from Google using access token
        
        This is Step 3 of OAuth flow:
        - We have an access token
        - We call Google's userinfo endpoint
        - Google tells us who this user is
        
        Returns:
            dict with 'email', 'name', 'sub' (Google's user ID)
        """
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Call Google's userinfo endpoint
        response = requests.get(self.google_userinfo_url, headers=headers)
        
        # Check if successful
        if response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to get user info from Google: {response.text}"
            )
        
        user_info = response.json()
        
        # Validate we got the required fields
        if not user_info.get("email"):
            raise HTTPException(
                status_code=400,
                detail="Email not provided by Google"
            )
        
        return {
            "email": user_info.get("email"),
            "name": user_info.get("name"),
            "google_user_id": user_info.get("sub"),  # Google's unique ID for this user
            "picture": user_info.get("picture")
        }

    async def handle_google_callback(self, code: str, user_service, auth_service) -> dict:
        """
        Complete OAuth flow - from code to logged-in user
        
        This orchestrates the entire OAuth process:
        1. Exchange code for tokens
        2. Get user info from Google
        3. Create/find user in our database
        4. Generate our JWT token
        5. Return everything to the route
        
        This is the main business logic for OAuth login.
        """
        # Step 1: Exchange code for tokens
        tokens = self.exchange_code_for_tokens(code)
        access_token = tokens["access_token"]
        
        # Step 2: Get user information
        user_info = self.get_user_info(access_token)
        email = user_info["email"]
        name = user_info["name"]
        google_user_id = user_info["google_user_id"]
        
        # Step 3: Check if user exists in our database
        existing_user = await user_service.get_user_by_email(email)
        
        if existing_user:
            # User exists - just login
            user_id = existing_user.id
        else:
            # New user - create account
            user_id = await user_service.create_oauth_user(
                email=email,
                name=name,
                provider="google",
                provider_user_id=google_user_id
            )
        
        # Step 4: Generate our JWT token
        jwt_token = auth_service.create_access_token(user_id)
        
        # Step 5: Return everything
        return {
            "token": jwt_token,
            "user": {
                "id": user_id,
                "email": email,
                "name": name
            }
        }
