import logging
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import UserSettings
from app.models.user import User
from app.repositories.users import UserRepository
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.schemas.user import UserRead
from app.security.jwt import create_access_token
from app.security.password import hash_password, verify_password

logger = logging.getLogger(__name__)

class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.users = UserRepository(db)

    async def register(self, payload: RegisterRequest) -> User:
        existing = await self.users.get_by_email(payload.email)
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")
        role = getattr(payload, 'role', 'student') or 'student'
        user = User(
            email=payload.email,
            hashed_password=hash_password(payload.password),
            full_name=payload.full_name,
            # Public registration must never create an administrator. Admins
            # are provisioned through explicit startup configuration.
            is_admin=False,
            role=role,
        )
        try:
            self.db.add(user)
            await self.db.flush()
            self.db.add(UserSettings(user_id=user.id))
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email is already registered",
            ) from exc
        await self.db.refresh(user)
        return user

    async def login(self, payload: LoginRequest) -> TokenResponse:
        try:
            user = await self.users.get_by_email(payload.email)
            if not user:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

            is_valid = verify_password(payload.password, user.hashed_password)
            if not is_valid:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

            if not user.is_active:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is disabled")
            
            token = create_access_token(user.id, role=user.role)
            return TokenResponse(access_token=token, user=UserRead.model_validate(user))
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Login error", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Authentication failed",
            ) from e
