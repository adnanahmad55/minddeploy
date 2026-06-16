from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import cloudinary
import cloudinary.uploader
import os

from .. import database, models, schemas, auth

# Configure Cloudinary if keys are present
if os.getenv("CLOUDINARY_KEY"):
    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_NAME"),
        api_key=os.getenv("CLOUDINARY_KEY"),
        api_secret=os.getenv("CLOUDINARY_SECRET")
    )

router = APIRouter(
    prefix="/chat",
    tags=["Chat"]
)

# Groups
@router.post("/groups", response_model=schemas.ChatGroupOut)
def create_group(group: schemas.ChatGroupCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Check if user owns premium_guild
    has_guild_ticket = db.query(models.UserPurchase).filter(
        models.UserPurchase.user_id == current_user.id,
        models.UserPurchase.item_id == "premium_guild"
    ).first()
    
    if not has_guild_ticket:
        raise HTTPException(status_code=403, detail="You must purchase a Guild Creation Ticket from the MindStore to create a group.")

    new_group = models.ChatGroup(
        name=group.name,
        description=group.description,
        owner_id=current_user.id
    )
    db.add(new_group)
    db.commit()
    db.refresh(new_group)
    
    # Add creator as member and admin
    member = models.GroupMember(group_id=new_group.id, user_id=current_user.id, role='admin')
    db.add(member)
    db.commit()
    
    return new_group

@router.get("/groups", response_model=List[schemas.ChatGroupOut])
def get_user_groups(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Get groups the user is a member of
    memberships = db.query(models.GroupMember).filter(models.GroupMember.user_id == current_user.id).all()
    group_ids = [m.group_id for m in memberships]
    
    groups = db.query(models.ChatGroup).filter(models.ChatGroup.id.in_(group_ids)).all()
    return groups

@router.get("/groups/all", response_model=List[schemas.ChatGroupOut])
def get_all_groups(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.ChatGroup).all()

@router.post("/groups/{group_id}/join")
def join_group(group_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    group = db.query(models.ChatGroup).filter(models.ChatGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    existing = db.query(models.GroupMember).filter(models.GroupMember.group_id == group_id, models.GroupMember.user_id == current_user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already a member")
        
    member = models.GroupMember(group_id=group_id, user_id=current_user.id)
    db.add(member)
    db.commit()
    return {"message": "Joined successfully"}

@router.get("/groups/{group_id}/messages", response_model=List[schemas.GroupMessageOut])
def get_group_messages(group_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Verify membership
    is_member = db.query(models.GroupMember).filter(models.GroupMember.group_id == group_id, models.GroupMember.user_id == current_user.id).first()
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this group")
        
    messages = db.query(models.GroupMessage).filter(models.GroupMessage.group_id == group_id).order_by(models.GroupMessage.timestamp.asc()).all()
    return messages

@router.post("/groups/{group_id}/add_user")
def add_user_to_group(group_id: int, username: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    group = db.query(models.ChatGroup).filter(models.ChatGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    # Only admins can add others
    is_member = db.query(models.GroupMember).filter(models.GroupMember.group_id == group_id, models.GroupMember.user_id == current_user.id).first()
    if not is_member or is_member.role != 'admin':
        raise HTTPException(status_code=403, detail="You must be an admin to add others")
        
    user_to_add = db.query(models.User).filter(models.User.username == username).first()
    if not user_to_add:
        raise HTTPException(status_code=404, detail="User not found")
        
    existing = db.query(models.GroupMember).filter(models.GroupMember.group_id == group_id, models.GroupMember.user_id == user_to_add.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="User is already a member")
        
    member = models.GroupMember(group_id=group_id, user_id=user_to_add.id)
    db.add(member)
    db.commit()
    return {"message": f"{username} added successfully"}

@router.get("/groups/{group_id}/members", response_model=List[schemas.GroupMemberOut])
def get_group_members(group_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    is_member = db.query(models.GroupMember).filter(models.GroupMember.group_id == group_id, models.GroupMember.user_id == current_user.id).first()
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this group")
    
    members = db.query(models.GroupMember).filter(models.GroupMember.group_id == group_id).all()
    return members

@router.delete("/groups/{group_id}/remove_user/{user_id}")
def remove_user_from_group(group_id: int, user_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    is_admin = db.query(models.GroupMember).filter(models.GroupMember.group_id == group_id, models.GroupMember.user_id == current_user.id, models.GroupMember.role == 'admin').first()
    if not is_admin:
        raise HTTPException(status_code=403, detail="You must be an admin to remove users")
        
    member_to_remove = db.query(models.GroupMember).filter(models.GroupMember.group_id == group_id, models.GroupMember.user_id == user_id).first()
    if not member_to_remove:
        raise HTTPException(status_code=404, detail="User not in group")
        
    db.delete(member_to_remove)
    db.commit()
    return {"message": "User removed successfully"}

@router.post("/groups/{group_id}/promote_user/{user_id}")
def promote_user_to_admin(group_id: int, user_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    is_admin = db.query(models.GroupMember).filter(models.GroupMember.group_id == group_id, models.GroupMember.user_id == current_user.id, models.GroupMember.role == 'admin').first()
    if not is_admin:
        raise HTTPException(status_code=403, detail="You must be an admin to promote users")
        
    member_to_promote = db.query(models.GroupMember).filter(models.GroupMember.group_id == group_id, models.GroupMember.user_id == user_id).first()
    if not member_to_promote:
        raise HTTPException(status_code=404, detail="User not in group")
        
    member_to_promote.role = 'admin'
    db.commit()
    return {"message": "User promoted to admin"}

@router.post("/upload")
def upload_chat_media(file: UploadFile = File(...), current_user: models.User = Depends(auth.get_current_user)):
    if not os.getenv("CLOUDINARY_KEY"):
        raise HTTPException(status_code=500, detail="Cloudinary not configured on the server")
        
    try:
        result = cloudinary.uploader.upload(file.file, resource_type="auto")
        return {"media_url": result.get("secure_url")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# DMs
@router.get("/dms/{user_id}/messages", response_model=List[schemas.DirectMessageOut])
def get_direct_messages(user_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    messages = db.query(models.DirectMessage).filter(
        ((models.DirectMessage.sender_id == current_user.id) & (models.DirectMessage.receiver_id == user_id)) |
        ((models.DirectMessage.sender_id == user_id) & (models.DirectMessage.receiver_id == current_user.id))
    ).order_by(models.DirectMessage.timestamp.asc()).all()
    return messages

@router.get("/dms/users", response_model=List[schemas.UserOut])
def get_dm_users(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Get users that this user has conversed with
    sent = db.query(models.DirectMessage.receiver_id).filter(models.DirectMessage.sender_id == current_user.id).distinct().all()
    received = db.query(models.DirectMessage.sender_id).filter(models.DirectMessage.receiver_id == current_user.id).distinct().all()
    
    user_ids = set([u[0] for u in sent] + [u[0] for u in received])
    if current_user.id in user_ids:
        user_ids.remove(current_user.id)
        
    users = db.query(models.User).filter(models.User.id.in_(user_ids)).all()
    return users
