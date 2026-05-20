from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..db.database import get_db
from ..models.models import Comment, Work, User
from ..schemas.schemas import CommentCreate, CommentResponse
from ..core.security import get_current_active_user

router = APIRouter(prefix="/comments", tags=["comments"])


@router.get("/work/{work_id}", response_model=List[CommentResponse])
def get_work_comments(
    work_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    comments = db.query(Comment).filter(
        Comment.work_id == work_id,
        Comment.parent_id == None
    ).order_by(Comment.created_at.desc()).offset(skip).limit(limit).all()
    return comments


@router.post("/", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def create_comment(
    comment: CommentCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    db_work = db.query(Work).filter(Work.id == comment.work_id).first()
    if not db_work:
        raise HTTPException(status_code=404, detail="Work not found")
    
    if comment.parent_id:
        parent_comment = db.query(Comment).filter(Comment.id == comment.parent_id).first()
        if not parent_comment:
            raise HTTPException(status_code=404, detail="Parent comment not found")
    
    db_comment = Comment(
        **comment.dict(),
        user_id=current_user.id
    )
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    return db_comment


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    db_comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not db_comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    if db_comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")
    
    db.delete(db_comment)
    db.commit()
    return None
