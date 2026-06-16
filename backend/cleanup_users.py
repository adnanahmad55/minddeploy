from app.database import SessionLocal, engine
from app import models

# Ensure tables are created
models.Base.metadata.create_all(bind=engine)

def cleanup():
    db = SessionLocal()
    try:
        # Delete all users EXCEPT username 'ai' or 'ai_agent'
        # First, delete dependent records because of foreign keys.
        
        # We need to find users to delete
        users_to_delete = db.query(models.User).filter(models.User.username.not_in(['ai', 'ai_agent'])).all()
        user_ids = [u.id for u in users_to_delete]

        if not user_ids:
            print("No users to delete.")
            return

        print(f"Deleting {len(user_ids)} users...")

        # Delete dependent data
        
        # First, find debates these users are part of
        debates_to_delete = db.query(models.Debate).filter((models.Debate.player1_id.in_(user_ids)) | (models.Debate.player2_id.in_(user_ids))).all()
        debate_ids = [d.id for d in debates_to_delete]
        if debate_ids:
            db.query(models.Message).filter(models.Message.debate_id.in_(debate_ids)).delete(synchronize_session=False)
            
        db.query(models.Debate).filter(models.Debate.id.in_(debate_ids)).delete(synchronize_session=False)
        db.query(models.Message).filter(models.Message.sender_id.in_(user_ids)).delete(synchronize_session=False)
        db.query(models.GroupMember).filter(models.GroupMember.user_id.in_(user_ids)).delete(synchronize_session=False)
        
        # Identify empty groups
        empty_groups = db.query(models.ChatGroup).filter(models.ChatGroup.owner_id.in_(user_ids)).all()
        empty_group_ids = [g.id for g in empty_groups]
        if empty_group_ids:
            db.query(models.GroupMessage).filter(models.GroupMessage.group_id.in_(empty_group_ids)).delete(synchronize_session=False)
            db.query(models.GroupMember).filter(models.GroupMember.group_id.in_(empty_group_ids)).delete(synchronize_session=False)
            db.query(models.ChatGroup).filter(models.ChatGroup.id.in_(empty_group_ids)).delete(synchronize_session=False)
            
        db.query(models.UserPurchase).filter(models.UserPurchase.user_id.in_(user_ids)).delete(synchronize_session=False)
        db.query(models.Streak).filter(models.Streak.user_id.in_(user_ids)).delete(synchronize_session=False)
        db.query(models.UserBadge).filter(models.UserBadge.user_id.in_(user_ids)).delete(synchronize_session=False)
        db.query(models.Post).filter(models.Post.user_id.in_(user_ids)).delete(synchronize_session=False)
        db.query(models.Thread).filter(models.Thread.user_id.in_(user_ids)).delete(synchronize_session=False)
        db.query(models.DirectMessage).filter((models.DirectMessage.sender_id.in_(user_ids)) | (models.DirectMessage.receiver_id.in_(user_ids))).delete(synchronize_session=False)
        
        # Finally delete users
        db.query(models.User).filter(models.User.id.in_(user_ids)).delete(synchronize_session=False)

        db.commit()
        print("Cleanup completed successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error during cleanup: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    cleanup()
