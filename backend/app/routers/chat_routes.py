from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from .. import database, models, schemas, auth

router = APIRouter(
    prefix="/chat",
    tags=["Chat"]
)

# Groups
@router.post("/groups", response_model=schemas.ChatGroupOut)
def create_group(group: schemas.ChatGroupCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    new_group = models.ChatGroup(
        name=group.name,
        description=group.description,
        owner_id=current_user.id
    )
    db.add(new_group)
    db.commit()
    db.refresh(new_group)
    
    # Add creator as member
    member = models.GroupMember(group_id=new_group.id, user_id=current_user.id)
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
