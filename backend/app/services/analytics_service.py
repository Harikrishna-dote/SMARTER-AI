from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat import Conversation, Message
from app.models.classroom import ClassroomProgress
from app.models.ecosystem import CalendarEvent, CodingSession, InterviewSession, Notification, Project, StudyGroup, StudyGroupMember
from app.models.user import User


class AnalyticsService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_learning_trends(self, days: int = 30) -> dict[str, Any]:
        cutoff = datetime.utcnow() - timedelta(days=days)
        result = await self.db.execute(
            select(func.date(Conversation.created_at), func.count(Conversation.id))
            .where(Conversation.created_at >= cutoff)
            .group_by(func.date(Conversation.created_at))
            .order_by(func.date(Conversation.created_at))
        )
        daily_conversations = [{"date": str(row[0]), "count": row[1]} for row in result.all()]

        progress_result = await self.db.execute(
            select(func.date(ClassroomProgress.last_active_date), func.avg(ClassroomProgress.xp))
            .where(ClassroomProgress.last_active_date >= cutoff.date())
            .group_by(func.date(ClassroomProgress.last_active_date))
        )
        daily_xp = [{"date": str(row[0]), "avg_xp": float(row[1] or 0)} for row in progress_result.all()]

        return {
            "daily_conversations": daily_conversations,
            "daily_xp": daily_xp,
            "period_days": days,
        }

    async def get_platform_usage(self) -> dict[str, Any]:
        total_users = await self.db.scalar(select(func.count(User.id)))
        active_users = await self.db.scalar(select(func.count(User.id)).where(User.is_active.is_(True)))
        total_conversations = await self.db.scalar(select(func.count(Conversation.id)))
        total_messages = await self.db.scalar(select(func.count(Message.id)))
        total_study_groups = await self.db.scalar(select(func.count(StudyGroup.id)))
        total_projects = await self.db.scalar(select(func.count(Project.id)))
        completed_projects = await self.db.scalar(select(func.count(Project.id)).where(Project.status == "completed"))
        total_interviews = await self.db.scalar(select(func.count(InterviewSession.id)))
        total_coding_sessions = await self.db.scalar(select(func.count(CodingSession.id)))
        total_calendar_events = await self.db.scalar(select(func.count(CalendarEvent.id)))

        return {
            "total_users": total_users or 0,
            "active_users": active_users or 0,
            "total_conversations": total_conversations or 0,
            "total_messages": total_messages or 0,
            "total_study_groups": total_study_groups or 0,
            "total_projects": total_projects or 0,
            "completed_projects": completed_projects or 0,
            "total_interviews": total_interviews or 0,
            "total_coding_sessions": total_coding_sessions or 0,
            "total_calendar_events": total_calendar_events or 0,
        }

    async def get_ai_usage(self) -> dict[str, Any]:
        total_messages = await self.db.scalar(select(func.count(Message.id)))
        avg_message_length = await self.db.scalar(select(func.avg(func.length(Message.content))))
        total_conversations = await self.db.scalar(select(func.count(Conversation.id)))

        return {
            "total_ai_messages": total_messages or 0,
            "avg_message_length": float(avg_message_length or 0),
            "total_conversations": total_conversations or 0,
            "messages_per_conversation": (total_messages or 0) / max(total_conversations or 1, 1),
        }

    async def get_performance_metrics(self) -> dict[str, Any]:
        return {
            "avg_response_time_ms": 0,
            "error_rate": 0.0,
            "uptime_percentage": 100.0,
            "active_connections": 0,
        }

    async def get_engagement_metrics(self) -> dict[str, Any]:
        total_users = await self.db.scalar(select(func.count(User.id)))
        users_with_progress = await self.db.scalar(select(func.count(func.distinct(ClassroomProgress.user_id))))
        users_with_projects = await self.db.scalar(select(func.count(func.distinct(Project.user_id))))
        users_with_groups = await self.db.scalar(
            select(func.count(func.distinct(StudyGroupMember.user_id)))
        )

        return {
            "total_users": total_users or 0,
            "users_with_progress": users_with_progress or 0,
            "users_with_projects": users_with_projects or 0,
            "users_in_groups": users_with_groups or 0,
            "engagement_rate": ((users_with_progress or 0) / max(total_users or 1, 1)) * 100,
        }

    async def get_lesson_completion(self) -> dict[str, Any]:
        result = await self.db.execute(
            select(
                func.count(ClassroomProgress.id),
                func.avg(ClassroomProgress.accuracy),
                func.sum(ClassroomProgress.quizzes_taken),
                func.sum(ClassroomProgress.homework_completed),
            )
        )
        row = result.one()
        return {
            "total_learners": row[0] or 0,
            "avg_accuracy": float(row[1] or 0),
            "total_quizzes": row[2] or 0,
            "total_homework": row[3] or 0,
        }
