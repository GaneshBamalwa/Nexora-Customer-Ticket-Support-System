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


def create_token(agent: Dict[str, Any]) -> str:
    """Mint a JWT carrying non-sensitive agent identity."""
    payload = {
        "agent_id":  agent["Agent_ID"],
        "name":      agent["Name"],
        "email":     agent["Email_ID"],
        "role":      agent["Role"],
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
    """Guard: raises 403 if the user is not an Administrator."""
    if user.get("role") != "Administrator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required.",
        )


def require_owner_or_admin(user: Dict[str, Any], owner_agent_id: Optional[int]):
    """
    IDOR prevention – ensures the logged-in user either owns the
    resource OR is an administrator.
    """
    if user.get("role") == "Administrator":
        return
    if owner_agent_id is not None and user.get("agent_id") != owner_agent_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this resource.",
        )
