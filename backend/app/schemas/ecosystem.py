from datetime import datetime
from typing import Any

from pydantic import BaseModel


class RoleUpdateRequest(BaseModel):
    role: str


class StudyGroupCreate(BaseModel):
    name: str
    description: str | None = None
    subject: str | None = None
    is_public: bool = False
    max_members: int = 20
    settings: dict[str, Any] | None = None


class StudyGroupResponse(BaseModel):
    id: str
    name: str
    description: str | None
    subject: str | None
    is_public: bool
    max_members: int
    owner_id: str
    settings: dict[str, Any]
    member_count: int
    created_at: str
    updated_at: str


class StudyGroupMemberResponse(BaseModel):
    id: str
    group_id: str
    user_id: str
    user_name: str | None
    role: str
    xp_contributed: int
    joined_at: str


class GroupDiscussionCreate(BaseModel):
    content: str
    parent_id: str | None = None


class GroupDiscussionResponse(BaseModel):
    id: str
    group_id: str
    user_id: str
    user_name: str | None
    content: str
    parent_id: str | None
    is_pinned: bool
    is_resolved: bool
    created_at: str
    updated_at: str
    replies: list["GroupDiscussionResponse"] = []


class SharedNoteCreate(BaseModel):
    title: str
    content: str
    tags: list[str] = []


class SharedNoteResponse(BaseModel):
    id: str
    group_id: str
    user_id: str
    user_name: str | None
    title: str
    content: str
    tags: list[str]
    version: int
    created_at: str
    updated_at: str


class ProjectCreate(BaseModel):
    title: str
    description: str
    subject: str | None = None
    difficulty: str = "intermediate"
    career_goal: str | None = None
    milestones: list[dict[str, Any]] | None = None


class ProjectResponse(BaseModel):
    id: str
    user_id: str
    title: str
    description: str
    subject: str | None
    difficulty: str
    status: str
    milestones: list[dict[str, Any]]
    progress: int
    career_goal: str | None
    feedback: str | None
    completed_at: str | None
    created_at: str
    updated_at: str


class PortfolioItemCreate(BaseModel):
    title: str
    description: str
    item_type: str = "project"
    tags: list[str] = []
    media_urls: list[str] = []
    is_public: bool = False


class PortfolioItemResponse(BaseModel):
    id: str
    user_id: str
    title: str
    description: str
    item_type: str
    tags: list[str]
    media_urls: list[str]
    is_public: bool
    certificate_id: str | None
    created_at: str
    updated_at: str


class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    body: str
    data: dict[str, Any]
    is_read: bool
    created_at: str
    read_at: str | None


class CalendarEventCreate(BaseModel):
    title: str
    description: str | None = None
    event_type: str = "study"
    start_time: datetime
    end_time: datetime
    reminder_minutes: int = 15
    related_type: str | None = None
    related_id: str | None = None


class CalendarEventResponse(BaseModel):
    id: str
    title: str
    description: str | None
    event_type: str
    start_time: str
    end_time: str
    is_completed: bool
    reminder_minutes: int
    related_type: str | None
    related_id: str | None
    created_at: str
    updated_at: str


class BadgeResponse(BaseModel):
    id: str
    badge_id: str
    name: str
    description: str
    icon: str | None
    unlocked_at: str


class InterviewSessionCreate(BaseModel):
    interview_type: str
    role: str


class InterviewSessionResponse(BaseModel):
    id: str
    interview_type: str
    role: str
    questions: list[dict[str, Any]]
    answers: list[dict[str, Any]]
    feedback: dict[str, Any]
    score: int
    completed: bool
    created_at: str
    updated_at: str


class CodingSessionCreate(BaseModel):
    language: str
    problem: str


class CodingSessionResponse(BaseModel):
    id: str
    language: str
    problem: str
    code: str
    output: str | None
    errors: list[dict[str, Any]]
    hints_used: int
    completed: bool
    execution_time: int | None
    created_at: str
    updated_at: str


class WhiteboardCreate(BaseModel):
    title: str
    group_id: str | None = None
    elements: list[dict[str, Any]] = []
    is_public: bool = False


class WhiteboardResponse(BaseModel):
    id: str
    group_id: str | None
    user_id: str
    title: str
    elements: list[dict[str, Any]]
    is_public: bool
    created_at: str
    updated_at: str


class ForumPostCreate(BaseModel):
    title: str
    content: str
    topic: str | None = None
    tags: list[str] = []


class ForumPostResponse(BaseModel):
    id: str
    user_id: str
    user_name: str | None
    title: str
    content: str
    topic: str | None
    tags: list[str]
    views: int
    upvotes: int
    is_resolved: bool
    comment_count: int
    created_at: str
    updated_at: str


class ForumCommentCreate(BaseModel):
    content: str
    parent_id: str | None = None


class ForumCommentResponse(BaseModel):
    id: str
    post_id: str
    user_id: str
    user_name: str | None
    content: str
    parent_id: str | None
    is_accepted: bool
    created_at: str
    updated_at: str


class PrivacySettingsResponse(BaseModel):
    id: str
    profile_visibility: str
    show_xp: bool
    show_badges: bool
    show_progress: bool
    allow_study_group_invites: bool
    allow_mentor_messages: bool
    data_sharing: str
    allow_analytics: bool
