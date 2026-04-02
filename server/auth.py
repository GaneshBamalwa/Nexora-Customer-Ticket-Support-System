"""
Authentication helpers – JWT token management with IDOR prevention.
Every token carries the agent_id and role so every endpoint can
verify ownership without an extra DB round-trip.
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

import jwt
from fastapi import Request, HTTPException, status

JWT_SECRET    = os.environ.get("JWT_SECRET", "CHANGE_ME")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 8  # tokens live for one shift


def create_token(user: Dict[str, Any], is_demo: bool = False) -> str:
    """Mint a JWT carrying non-sensitive identity."""
    payload = {
        "Agent_ID": user.get("Agent_ID") or user.get("ID"),
        "Name":      user["Name"],
        "Email_ID":  user["Email_ID"],
        "Role":      user["Role"],
        "is_demo":   is_demo,
        "exp":       datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat":       datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    """Validate and decode a JWT; raises on expiry or tampering."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired – please log in again.",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token.",
        )


def get_current_user(request: Request) -> Dict[str, Any]:
    """
    Extract and validate the Bearer token from the Authorization header.
    Returns the decoded JWT payload (agent_id, name, email, role).
    """
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    return decode_token(auth[7:])


def require_admin(user: Dict[str, Any]):
    """Guard: raises 403 if the user is not an Administrator or DemoAgent."""
    role = user.get("Role")
    if role not in ("Administrator", "DemoAgent"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required.",
        )


def require_owner_or_admin(user: Dict[str, Any], owner_agent_id: Optional[int]):
    """
    IDOR prevention – ensures the logged-in user either owns the
    resource OR is an administrator.
    """
    if user.get("Role") == "Administrator":
        return
    if owner_agent_id is not None and user.get("Agent_ID") != owner_agent_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this resource.",
        )


async def verify_ms_token(id_token: str) -> Dict[str, Any]:
    """
    DEBUG-READY: Manually validates a Microsoft ID Token with extensive logging.
    Solves the 'invalid_claim: Invalid claim "iss"' error.
    """
    import os
    import jwt
    import logging
    from jwt import PyJWKClient
    from fastapi import HTTPException, status
    
    # 1. Configuration
    JWKS_URL = "https://login.microsoftonline.com/common/discovery/v2.0/keys"
    client_id = os.environ.get("MICROSOFT_CLIENT_ID")
    
    logging.info("--- MICROSOFT TOKEN DEBUG START ---")
    logging.info(f"JWKS_URL: {JWKS_URL}")
    logging.info(f"EXPECTED AUDIENCE: {client_id}")
    
    try:
        # Create JWK Client for signature verification
        jwks_client = PyJWKClient(JWKS_URL)
        signing_key = jwks_client.get_signing_key_from_jwt(id_token)
        logging.info(f"SIGNING KEY ID (KID): {signing_key.key_id}")
        
        # 2. Decode and Validate Signature/Claims (Except Issuer)
        decoded = jwt.decode(
            id_token, 
            signing_key.key, 
            algorithms=["RS256"], 
            audience=client_id,
            options={"verify_iss": False} # We handle issuer manually for /common
        )
        
        # 3. Log all claims for debugging
        logging.info("TOKEN CLAIMS RECEIVED:")
        for k, v in decoded.items():
            logging.info(f"  {k}: {v}")
            
        # 4. Custom Flexible Issuer Validation
        issuer = decoded.get("iss", "")
        if not issuer.startswith("https://login.microsoftonline.com/"):
            logging.error(f"ISSUER VALIDATION FAILED: {issuer}")
            raise jwt.InvalidIssuerError(f"Invalid issuer prefix: {issuer}")
            
        logging.info("ISSUER VALIDATED SUCCESSFULLY")
        logging.info("--- MICROSOFT TOKEN DEBUG END (SUCCESS) ---")
        
        # 5. Extract User info
        return {
            "id": decoded.get("sub") or decoded.get("oid"),
            "email": decoded.get("email") or decoded.get("preferred_username"),
            "name": decoded.get("name") or decoded.get("displayName") or "MS User"
        }
        
    except jwt.ExpiredSignatureError:
        logging.error("TOKEN EXPIRED (exp claim failed)")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidAudienceError:
        logging.error(f"AUDIENCE MISMATCH. Expected {client_id}")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Audience mismatch")
    except Exception as e:
        logging.error(f"Microsoft token validation error: {str(e)}", exc_info=True)
        logging.info("--- MICROSOFT TOKEN DEBUG END (FAILURE) ---")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Microsoft token validation failed: {str(e)}"
        )
