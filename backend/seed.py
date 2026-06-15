import asyncio
from app import database, models

async def seed_forums():
    db = database.SessionLocal()
    try:
        # Check if forums already exist
        if db.query(models.Forum).count() == 0:
            forums = [
                models.Forum(name="General Debate", description="Discuss any topics here."),
                models.Forum(name="Technology & Ethics", description="Debate the moral implications of AI, biotech, etc."),
                models.Forum(name="Politics & Society", description="Political debates and societal structures."),
                models.Forum(name="Science & Philosophy", description="From quantum mechanics to the meaning of life.")
            ]
            db.add_all(forums)
            db.commit()
            print("Successfully seeded initial forums.")
        else:
            print("Forums already seeded.")
            
    except Exception as e:
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(seed_forums())
