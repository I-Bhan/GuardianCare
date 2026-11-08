from fastapi import Depends, HTTPException, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jwt import PyJWKClient, decode, ExpiredSignatureError, InvalidTokenError
from jwt.exceptions import PyJWKClientConnectionError, PyJWKClientError

from guardiancare_api.config import JWKS_URL, SIMULATOR_API_KEY

_jwks_client = PyJWKClient(JWKS_URL, cache_keys=True)
_bearer      = HTTPBearer(auto_error=False)

def verify_token(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    x_simulator_key: str | None = Header(default=None, alias="X-Simulator-Key"),
) -> dict:
    if SIMULATOR_API_KEY and x_simulator_key == SIMULATOR_API_KEY:
        return {"sub": "simulator", "role": "simulator"}

    if creds is None:
        raise HTTPException(401, "Missing credentials")

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
    except PyJWKClientConnectionError:
        raise HTTPException(503, "Cannot reach the sign-in verification service")
    except (InvalidTokenError, PyJWKClientError):
        raise HTTPException(401, "Invalid token")
