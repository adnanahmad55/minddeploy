from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from .. import database, models, auth
from pydantic import BaseModel

router = APIRouter(
    prefix="/store",
    tags=["Store"]
)

# Simulated store items with prices
STORE_PRICES = {
    "ai_socrates": 100,
    "ai_machiavelli": 150,
    "badge_veteran": 50,
    "premium_guild": 500,
}

@router.post("/purchase/{item_id}")
def purchase_item(item_id: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    if item_id not in STORE_PRICES:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    price = STORE_PRICES[item_id]
    
    # Refresh user to ensure we have the latest tokens
    db.refresh(current_user)

    if current_user.mind_tokens < price:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient MindTokens")

    # Deduct tokens
    current_user.mind_tokens -= price

    # In a real application, you would also save to a UserItems table to track ownership
    # For now, we simply deduct the tokens.

    db.commit()
    return {"message": "Purchase successful", "item_id": item_id, "remaining_tokens": current_user.mind_tokens}
