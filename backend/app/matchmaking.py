# app/matchmaking.py
# Corrected import for sibling module
from .socketio_instance import sio 

from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from . import database, models, schemas
from . evaluation import evaluate_debate
from typing import Dict, Any
from datetime import datetime

online_users: Dict[str, Any] = {}

@sio.event
async def user_online(sid, data):
    user_id = str(data.get('userId'))
    if user_id not in online_users:
        online_users[user_id] = {'username': data.get('username'), 'elo': data.get('elo'), 'id': user_id, 'sid': sid}
        print(f"User online: {data.get('username')} (ID: {user_id})")
        await sio.emit('online_users', list(online_users.values()))

@sio.event
async def user_offline(sid, data):
    user_id = str(data.get('userId'))
    if user_id in online_users:
        del online_users[user_id]
        print(f"User offline: (ID: {user_id})")
        await sio.emit('online_users', list(online_users.values()))

@sio.event
async def challenge_user(sid, data):
    challenger = data.get('challenger')
    opponent_id = str(data.get('opponentId'))
    topic = data.get('topic')

    opponent_sid = online_users.get(opponent_id, {}).get('sid')
    if opponent_sid:
        await sio.emit('challenge_received', {'challenger': challenger, 'topic': topic}, room=opponent_sid)
        print(f"Challenge sent from {challenger['username']} to {online_users[opponent_id]['username']}")
    else:
        await sio.emit('toast', {'title': 'Opponent Offline', 'description': 'The user you challenged is no longer online.', 'variant': 'destructive'}, room=sid)

@sio.event
async def accept_challenge(sid, data):
    challenger_id = str(data.get('challengerId'))
    opponent_data = data.get('opponent')
    topic = data.get('topic')
    debate_id = data.get('debateId')

    challenger_sid = online_users.get(challenger_id, {}).get('sid')

    if challenger_sid and debate_id:
        await sio.enter_room(sid, str(debate_id))
        await sio.enter_room(challenger_sid, str(debate_id))
        await sio.emit('challenge_accepted', {'opponent': opponent_data, 'topic': topic, 'debateId': debate_id}, room=challenger_sid)
        print(f"Challenge accepted by {opponent_data['username']} from {online_users[challenger_id]['username']}. Debate ID: {debate_id}. Users joined room {debate_id}")

@sio.event
async def decline_challenge(sid, data):
    challenger_id = str(data.get('challengerId'))
    challenger_sid = online_users.get(challenger_id, {}).get('sid')
    if challenger_sid:
        await sio.emit('challenge_declined', {'opponentId': sid}, room=challenger_sid)
        await sio.emit('toast', {'title': 'Challenge Declined', 'description': 'Your debate challenge was declined.'}, room=challenger_sid)
        print(f"Challenge declined by {sid} to {online_users[challenger_id]['username']}")

@sio.event
async def join_debate_room(sid, data):
    debate_id = str(data.get('debateId'))
    await sio.enter_room(sid, debate_id)
    print(f"User with sid {sid} joined debate room {debate_id}")

@sio.event
async def leave_debate_room(sid, data):
    debate_id = str(data.get('debateId'))
    await sio.leave_room(sid, debate_id)
    print(f"User with sid {sid} left debate room {debate_id}")

@sio.event
async def send_message_to_human(sid, data):
    debate_id = data.get('debateId')
    sender_id = data.get('senderId')
    content = data.get('content')
    sender_type = data.get('senderType', 'user')

    try:
        with database.SessionLocal() as db:
            db_debate = db.query(models.Debate).filter(models.Debate.id == debate_id).first()
            if not db_debate:
                await sio.emit('error', {'detail': 'Debate not found.'}, room=sid)
                return
            
            if not (db_debate.player1_id == sender_id or db_debate.player2_id == sender_id):
                await sio.emit('error', {'detail': 'Not authorized to send message in this debate.'}, room=sid)
                return

            new_message_db = models.Message(
                content=content,
                sender_type=sender_type,
                debate_id=debate_id,
                sender_id=sender_id,
            )
            db.add(new_message_db)
            db.commit()
            db.refresh(new_message_db)

            # --- CONCRETE FIX: Manual conversion for a foolproof emit ---
            message_to_broadcast = schemas.MessageOut.from_orm(new_message_db).dict()
            # This line forces the datetime object to an ISO string
            if 'timestamp' in message_to_broadcast and isinstance(message_to_broadcast['timestamp'], datetime):
                message_to_broadcast['timestamp'] = message_to_broadcast['timestamp'].isoformat()
            print(f"DEBUG: Emitting 'new_message' to room {debate_id} with content: {message_to_broadcast.get('content')[:50]}...")
            await sio.emit('new_message', message_to_broadcast, room=str(debate_id))
            # --- END FIX ---

    except Exception as e:
        print(f"CRITICAL ERROR in send_message_to_human handler: {e}")
        await sio.emit('error', {'detail': 'Server error during message processing.'}, room=sid)

@sio.event
async def end_debate(sid, data):
    debate_id = data.get('debate_id')
    print(f"Ending debate with ID: {debate_id}")

    try:
        with database.SessionLocal() as db:
            db_debate = db.query(models.Debate).filter(models.Debate.id == debate_id).first()

            if not db_debate:
                await sio.emit('error', {'detail': 'Debate not found.'}, room=sid)
                return

            messages = db.query(models.Message).filter(models.Message.debate_id == debate_id).all()
            
            evaluation_result = await evaluate_debate(messages)
            winner_id = evaluation_result.get('winner_id')
            result = evaluation_result.get('result')
            feedback = evaluation_result.get('feedback', {})
            score = evaluation_result.get('score', 50)
            elo_change = 0

            player1 = db.query(models.User).filter(models.User.id == db_debate.player1_id).first()
            player2 = db.query(models.User).filter(models.User.id == db_debate.player2_id).first()
            
            if not player1 or not player2:
                db_debate.winner = "Error"
                db.commit()
                await sio.emit('error', {'detail': 'Player data not found.'}, room=str(debate_id))
                return

            if result == 'User':
                winning_player = player1 if winner_id == player1.id else player2
                losing_player = player1 if winner_id != player1.id else player2
                elo_change = evaluation_result.get('elo_change', 10)
                winning_player.elo += elo_change
                winning_player.mind_tokens += 5
                losing_player.elo -= elo_change
                db_debate.winner = winning_player.username
            elif result == 'AI':
                winning_player_id = 0
                losing_player = player1 if player1.id != 0 else player2
                elo_change = evaluation_result.get('elo_change', 10)
                losing_player.elo -= elo_change
                db_debate.winner = "AI Bot"
            elif result == 'Draw':
                db_debate.winner = "Draw"
            else:
                db_debate.winner = "Undetermined"
            
            db.commit()

            await sio.emit('debate_ended', {
                'debate_id': debate_id,
                'winner': db_debate.winner,
                'elo_change': elo_change,
                'feedback': feedback,
                'score': score
            }, room=str(debate_id))

    except Exception as e:
        print(f"CRITICAL ERROR in end_debate handler for debate {debate_id}: {e}")
        await sio.emit('error', {'detail': 'Server error during debate evaluation.'}, room=sid)

# --- GROUP CHAT AND DM SOCKET EVENTS ---

@sio.event
async def join_group_room(sid, data):
    group_id = str(data.get('groupId'))
    await sio.enter_room(sid, f"group_{group_id}")
    print(f"User {sid} joined group room group_{group_id}")

@sio.event
async def leave_group_room(sid, data):
    group_id = str(data.get('groupId'))
    await sio.leave_room(sid, f"group_{group_id}")
    print(f"User {sid} left group room group_{group_id}")

@sio.event
async def send_group_message(sid, data):
    group_id = data.get('groupId')
    sender_id = data.get('senderId')
    content = data.get('content')
    media_url = data.get('media_url')

    try:
        with database.SessionLocal() as db:
            is_member = db.query(models.GroupMember).filter(models.GroupMember.group_id == group_id, models.GroupMember.user_id == sender_id).first()
            if not is_member:
                await sio.emit('error', {'detail': 'Not authorized.'}, room=sid)
                return

            new_msg = models.GroupMessage(group_id=group_id, sender_id=sender_id, content=content, media_url=media_url)
            db.add(new_msg)
            db.commit()
            db.refresh(new_msg)

            user = db.query(models.User).filter(models.User.id == sender_id).first()
            msg_dict = {
                "id": new_msg.id,
                "group_id": new_msg.group_id,
                "sender_id": new_msg.sender_id,
                "content": new_msg.content,
                "media_url": new_msg.media_url,
                "timestamp": new_msg.timestamp.isoformat(),
                "sender": {"id": user.id, "username": user.username, "elo": user.elo, "email": user.email, "mind_tokens": user.mind_tokens}
            }

            await sio.emit('new_group_message', msg_dict, room=f"group_{group_id}")
    except Exception as e:
        print(f"Error in send_group_message: {e}")

@sio.event
async def join_dm_room(sid, data):
    user_id = data.get('userId')
    await sio.enter_room(sid, f"user_{user_id}")
    print(f"User {sid} joined personal dm room user_{user_id}")

@sio.event
async def send_direct_message(sid, data):
    sender_id = data.get('senderId')
    receiver_id = data.get('receiverId')
    content = data.get('content')
    media_url = data.get('media_url')

    try:
        with database.SessionLocal() as db:
            new_msg = models.DirectMessage(sender_id=sender_id, receiver_id=receiver_id, content=content, media_url=media_url)
            db.add(new_msg)
            db.commit()
            db.refresh(new_msg)

            msg_dict = {
                "id": new_msg.id,
                "sender_id": new_msg.sender_id,
                "receiver_id": new_msg.receiver_id,
                "content": new_msg.content,
                "media_url": new_msg.media_url,
                "timestamp": new_msg.timestamp.isoformat()
            }

            # Emit to both sender and receiver rooms
            await sio.emit('new_direct_message', msg_dict, room=f"user_{sender_id}")
            await sio.emit('new_direct_message', msg_dict, room=f"user_{receiver_id}")
    except Exception as e:
        print(f"Error in send_direct_message: {e}")

@sio.event
async def edit_message(sid, data):
    message_id = data.get('messageId')
    msg_type = data.get('type')
    new_content = data.get('newContent')
    sender_id = data.get('senderId')

    try:
        with database.SessionLocal() as db:
            if msg_type == 'group':
                msg = db.query(models.GroupMessage).filter(models.GroupMessage.id == message_id, models.GroupMessage.sender_id == sender_id).first()
                if msg:
                    msg.content = new_content
                    msg.is_edited = True
                    db.commit()
                    await sio.emit('message_edited', {'messageId': message_id, 'type': 'group', 'newContent': new_content, 'groupId': msg.group_id}, room=f"group_{msg.group_id}")
            elif msg_type == 'direct':
                msg = db.query(models.DirectMessage).filter(models.DirectMessage.id == message_id, models.DirectMessage.sender_id == sender_id).first()
                if msg:
                    msg.content = new_content
                    msg.is_edited = True
                    db.commit()
                    await sio.emit('message_edited', {'messageId': message_id, 'type': 'direct', 'newContent': new_content, 'senderId': msg.sender_id, 'receiverId': msg.receiver_id}, room=f"user_{msg.sender_id}")
                    await sio.emit('message_edited', {'messageId': message_id, 'type': 'direct', 'newContent': new_content, 'senderId': msg.sender_id, 'receiverId': msg.receiver_id}, room=f"user_{msg.receiver_id}")
    except Exception as e:
        print(f"Error editing message: {e}")

@sio.event
async def delete_message(sid, data):
    message_id = data.get('messageId')
    msg_type = data.get('type')
    sender_id = data.get('senderId')

    try:
        with database.SessionLocal() as db:
            if msg_type == 'group':
                msg = db.query(models.GroupMessage).filter(models.GroupMessage.id == message_id, models.GroupMessage.sender_id == sender_id).first()
                if msg:
                    group_id = msg.group_id
                    db.delete(msg)
                    db.commit()
                    await sio.emit('message_deleted', {'messageId': message_id, 'type': 'group', 'groupId': group_id}, room=f"group_{group_id}")
            elif msg_type == 'direct':
                msg = db.query(models.DirectMessage).filter(models.DirectMessage.id == message_id, models.DirectMessage.sender_id == sender_id).first()
                if msg:
                    s_id = msg.sender_id
                    r_id = msg.receiver_id
                    db.delete(msg)
                    db.commit()
                    await sio.emit('message_deleted', {'messageId': message_id, 'type': 'direct', 'senderId': s_id, 'receiverId': r_id}, room=f"user_{s_id}")
                    await sio.emit('message_deleted', {'messageId': message_id, 'type': 'direct', 'senderId': s_id, 'receiverId': r_id}, room=f"user_{r_id}")
    except Exception as e:
        print(f"Error deleting message: {e}")