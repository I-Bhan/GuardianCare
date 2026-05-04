from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jwt import PyJWKClient, decode, ExpiredSignatureError, InvalidTokenError

from guardiancare_api.config import JWKS_URL

# Fetched once at startup, cached automatically by PyJWKClient
_jwks_client = PyJWKClient(JWKS_URL, cache_keys=True)
_bearer      = HTTPBearer()

def verify_token(creds: HTTPAuthorizationCredentials = Depends(_bearer)) -> dict:
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(creds.credentials)
        payload = decode(
            creds.credentials,
            signing_key.key,
            algorithms=["ES256"],
            audience="authenticated",
        )
        return payload
    except ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except InvalidTokenError:
        raise HTTPException(401, "Invalid token")
