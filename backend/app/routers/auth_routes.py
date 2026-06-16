from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from .. import schemas, database, models, auth, ai, debate, matchmaking
from fastapi.security import OAuth2PasswordRequestForm
import random
import string
from datetime import datetime, timedelta
from app.email_utils import send_otp_email

router = APIRouter(tags=["Auth"])


@router.post("/send-otp")
def send_otp(req: schemas.SendOTPRequest, db: Session = Depends(database.get_db)):
    # If signup, ensure email is not taken
    if req.purpose == 'signup':
        existing = db.query(models.User).filter(models.User.email == req.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
            
    # If reset, ensure email exists
    if req.purpose == 'reset':
        existing = db.query(models.User).filter(models.User.email == req.email).first()
        if not existing:
            raise HTTPException(status_code=404, detail="Email not found")

    otp_code = ''.join(random.choices(string.digits, k=6))
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    # Invalidate older OTPs for this email and purpose
    db.query(models.OTPVerification).filter(
        models.OTPVerification.email == req.email,
        models.OTPVerification.purpose == req.purpose
    ).delete()

    otp_entry = models.OTPVerification(
        email=req.email,
        otp_code=otp_code,
        purpose=req.purpose,
        expires_at=expires_at
    )
    db.add(otp_entry)
    db.commit()

    success = send_otp_email(req.email, otp_code, req.purpose)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to send OTP email")

    return {"message": "OTP sent successfully"}

@router.post("/reset-password")
def reset_password(req: schemas.ResetPasswordRequest, db: Session = Depends(database.get_db)):
    otp_entry = db.query(models.OTPVerification).filter(
        models.OTPVerification.email == req.email,
        models.OTPVerification.purpose == 'reset',
        models.OTPVerification.otp_code == req.otp_code
    ).first()

    if not otp_entry or otp_entry.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = auth.get_password_hash(req.new_password)
    db.delete(otp_entry)
    db.commit()

    return {"message": "Password reset successfully"}

@router.post("/register", response_model=schemas.UserOut)
def register(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    existing = db.query(models.User).filter(models.User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    otp_entry = db.query(models.OTPVerification).filter(
        models.OTPVerification.email == user.email,
        models.OTPVerification.purpose == 'signup',
        models.OTPVerification.otp_code == user.otp_code
    ).first()

    if not otp_entry or otp_entry.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    
    hashed = auth.get_password_hash(user.password)
    
    new_user = models.User(
        username=user.username,
        email=user.email,
        hashed_password=hashed,
        mind_tokens=10000
    )
    
    db.add(new_user)
    db.delete(otp_entry) # Clean up OTP
    db.commit()
    db.refresh(new_user)
    
    return new_user


@router.post("/login", response_model=schemas.Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = auth.authenticate_user(db, form.username, form.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = auth.create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/users/me", response_model=schemas.UserOut)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

from typing import List

@router.get("/users/all", response_model=List[schemas.UserOut])
def get_all_users(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Return all users except the current one
    return db.query(models.User).filter(models.User.id != current_user.id).all()

@router.post("/test-user")
def create_test_user(db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.email == "test@test.com").first()
    if user:
        return {"message": "Test user already exists."}

    hashed_password = auth.get_password_hash("test")
    new_user = models.User(
        username="test",
        email="test@test.com",
        hashed_password=hashed_password
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.get("/{user_id}", response_model=schemas.UserOut)
def get_user_by_id(user_id: int, db: Session = Depends(database.get_db)):
    """Fetches a single user by their ID."""
    print(f"DEBUG: Received request to fetch user with ID: {user_id}")
    
    user = db.query(models.User).filter(models.User.id == user_id).first()
    
    if not user:
        print(f"DEBUG: User with ID {user_id} not found in DB session. Returning 404.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    print(f"DEBUG: User with ID {user_id} found. Username: {user.username}. Returning user.")
    return user
# --- END MODIFIED ---

