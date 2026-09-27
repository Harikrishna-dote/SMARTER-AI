from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, new_id


class StudyGroup(Base, TimestampMixin):
    __tablename__ = "study_groups"

    id = Column(String(36), primary_key=True, default=new_id)
    name = Column(String(180), nullable=False)
    description = Column(Text, nullable=True)
    subject = Column(String(120), nullable=True)
    is_public = Column(Boolean, default=False, nullable=False)
    max_members = Column(Integer, default=20, nullable=False)
    owner_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    settings = Column(JSON, default=dict, nullable=False)

    members = relationship("StudyGroupMember", back_populates="group", cascade="all, delete-orphan")
    discussions = relationship("GroupDiscussion", back_populates="group", cascade="all, delete-orphan")
    shared_notes = relationship("SharedNote", back_populates="group", cascade="all, delete-orphan")


class StudyGroupMember(Base, TimestampMixin):
    __tablename__ = "study_group_members"

    id = Column(String(36), primary_key=True, default=new_id)
    group_id = Column(String(36), ForeignKey("study_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(32), default="member", nullable=False)
    xp_contributed = Column(Integer, default=0, nullable=False)

    group = relationship("StudyGroup", back_populates="members")
    user = relationship("User", back_populates="study_groups")


class GroupDiscussion(Base, TimestampMixin):
    __tablename__ = "group_discussions"

    id = Column(String(36), primary_key=True, default=new_id)
    group_id = Column(String(36), ForeignKey("study_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    parent_id = Column(String(36), ForeignKey("group_discussions.id", ondelete="CASCADE"), nullable=True, index=True)
    is_pinned = Column(Boolean, default=False, nullable=False)
    is_resolved = Column(Boolean, default=False, nullable=False)

    group = relationship("StudyGroup", back_populates="discussions")
    user = relationship("User")
    replies = relationship("GroupDiscussion", remote_side=[id], foreign_keys=[parent_id])


class SharedNote(Base, TimestampMixin):
    __tablename__ = "shared_notes"

    id = Column(String(36), primary_key=True, default=new_id)
    group_id = Column(String(36), ForeignKey("study_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(180), nullable=False)
    content = Column(Text, nullable=False)
    tags = Column(JSON, default=list, nullable=False)
    version = Column(Integer, default=1, nullable=False)

    group = relationship("StudyGroup", back_populates="shared_notes")
    user = relationship("User")


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=new_id)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(180), nullable=False)
    description = Column(Text, nullable=False)
    subject = Column(String(120), nullable=True)
    difficulty = Column(String(32), default="intermediate", nullable=False)
    status = Column(String(32), default="in_progress", nullable=False)
    milestones = Column(JSON, default=list, nullable=False)
    progress = Column(Integer, default=0, nullable=False)
    career_goal = Column(String(180), nullable=True)
    feedback = Column(Text, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="projects")


class PortfolioItem(Base, TimestampMixin):
    __tablename__ = "portfolio_items"

    id = Column(String(36), primary_key=True, default=new_id)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(180), nullable=False)
    description = Column(Text, nullable=False)
    item_type = Column(String(32), default="project", nullable=False)
    tags = Column(JSON, default=list, nullable=False)
    media_urls = Column(JSON, default=list, nullable=False)
    is_public = Column(Boolean, default=False, nullable=False)
    certificate_id = Column(String(36), nullable=True, index=True)

    user = relationship("User", back_populates="portfolio_items")


class Certificate(Base, TimestampMixin):
    __tablename__ = "certificates"

    id = Column(String(36), primary_key=True, default=new_id)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(180), nullable=False)
    issuer = Column(String(180), nullable=False)
    issue_date = Column(DateTime, nullable=False)
    expiry_date = Column(DateTime, nullable=True)
    credential_id = Column(String(180), nullable=True)
    verification_url = Column(String(255), nullable=True)
    skills = Column(JSON, default=list, nullable=False)

    user = relationship("User")


class Notification(Base, TimestampMixin):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=new_id)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(32), nullable=False, index=True)
    title = Column(String(180), nullable=False)
    body = Column(Text, nullable=False)
    data = Column(JSON, default=dict, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    read_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="notifications")


class CalendarEvent(Base, TimestampMixin):
    __tablename__ = "calendar_events"

    id = Column(String(36), primary_key=True, default=new_id)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(180), nullable=False)
    description = Column(Text, nullable=True)
    event_type = Column(String(32), default="study", nullable=False, index=True)
    start_time = Column(DateTime, nullable=False, index=True)
    end_time = Column(DateTime, nullable=False, index=True)
    is_completed = Column(Boolean, default=False, nullable=False)
    reminder_minutes = Column(Integer, default=15, nullable=False)
    related_type = Column(String(32), nullable=True)
    related_id = Column(String(36), nullable=True, index=True)

    user = relationship("User", back_populates="calendar_events")


class UserBadge(Base, TimestampMixin):
    __tablename__ = "user_badges"

    id = Column(String(36), primary_key=True, default=new_id)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    badge_id = Column(String(64), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    description = Column(Text, nullable=False)
    icon = Column(String(64), nullable=True)
    unlocked_at = Column(DateTime, nullable=False)

    user = relationship("User", back_populates="badges")


class InterviewSession(Base, TimestampMixin):
    __tablename__ = "interview_sessions"

    id = Column(String(36), primary_key=True, default=new_id)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    interview_type = Column(String(32), nullable=False, index=True)
    role = Column(String(120), nullable=False)
    questions = Column(JSON, default=list, nullable=False)
    answers = Column(JSON, default=list, nullable=False)
    feedback = Column(JSON, default=dict, nullable=False)
    score = Column(Integer, default=0, nullable=False)
    completed = Column(Boolean, default=False, nullable=False)

    user = relationship("User")


class CodingSession(Base, TimestampMixin):
    __tablename__ = "coding_sessions"

    id = Column(String(36), primary_key=True, default=new_id)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    language = Column(String(32), nullable=False)
    problem = Column(Text, nullable=False)
    code = Column(Text, nullable=False)
    output = Column(Text, nullable=True)
    errors = Column(JSON, default=list, nullable=False)
    hints_used = Column(Integer, default=0, nullable=False)
    completed = Column(Boolean, default=False, nullable=False)
    execution_time = Column(Integer, nullable=True)

    user = relationship("User")


class Whiteboard(Base, TimestampMixin):
    __tablename__ = "whiteboards"

    id = Column(String(36), primary_key=True, default=new_id)
    group_id = Column(String(36), ForeignKey("study_groups.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(180), nullable=False)
    elements = Column(JSON, default=list, nullable=False)
    is_public = Column(Boolean, default=False, nullable=False)

    group = relationship("StudyGroup")
    user = relationship("User")


class ForumPost(Base, TimestampMixin):
    __tablename__ = "forum_posts"

    id = Column(String(36), primary_key=True, default=new_id)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(180), nullable=False)
    content = Column(Text, nullable=False)
    topic = Column(String(120), nullable=True, index=True)
    tags = Column(JSON, default=list, nullable=False)
    views = Column(Integer, default=0, nullable=False)
    upvotes = Column(Integer, default=0, nullable=False)
    is_resolved = Column(Boolean, default=False, nullable=False)

    user = relationship("User")
    comments = relationship("ForumComment", back_populates="post", cascade="all, delete-orphan")


class ForumComment(Base, TimestampMixin):
    __tablename__ = "forum_comments"

    id = Column(String(36), primary_key=True, default=new_id)
    post_id = Column(String(36), ForeignKey("forum_posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    parent_id = Column(String(36), ForeignKey("forum_comments.id", ondelete="CASCADE"), nullable=True, index=True)
    is_accepted = Column(Boolean, default=False, nullable=False)

    post = relationship("ForumPost", back_populates="comments")
    user = relationship("User")


class PrivacySettings(Base, TimestampMixin):
    __tablename__ = "privacy_settings"

    id = Column(String(36), primary_key=True, default=new_id)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    profile_visibility = Column(String(32), default="friends", nullable=False)
    show_xp = Column(Boolean, default=True, nullable=False)
    show_badges = Column(Boolean, default=True, nullable=False)
    show_progress = Column(Boolean, default=True, nullable=False)
    allow_study_group_invites = Column(Boolean, default=True, nullable=False)
    allow_mentor_messages = Column(Boolean, default=True, nullable=False)
    data_sharing = Column(String(32), default="essential", nullable=False)
    allow_analytics = Column(Boolean, default=True, nullable=False)

    user = relationship("User")


__all__ = [
    "StudyGroup",
    "StudyGroupMember",
    "GroupDiscussion",
    "SharedNote",
    "Project",
    "PortfolioItem",
    "Certificate",
    "Notification",
    "CalendarEvent",
    "UserBadge",
    "InterviewSession",
    "CodingSession",
    "Whiteboard",
    "ForumPost",
    "ForumComment",
    "PrivacySettings",
]
