from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.services.code_executor_service import CodeExecutorService
from app.core.deps import get_current_user, get_db
from app.models.ecosystem import (
    CalendarEvent,
    CodingSession,
    ForumComment,
    ForumPost,
    GroupDiscussion,
    InterviewSession,
    Notification,
    PortfolioItem,
    Project,
    PrivacySettings,
    SharedNote,
    StudyGroup,
    StudyGroupMember,
    UserBadge,
    Whiteboard,
)
from app.models.user import User
from app.schemas.ecosystem import (
    BadgeResponse,
    CalendarEventCreate,
    CalendarEventResponse,
    CodingSessionCreate,
    CodingSessionResponse,
    ForumCommentCreate,
    ForumCommentResponse,
    ForumPostCreate,
    ForumPostResponse,
    GroupDiscussionCreate,
    GroupDiscussionResponse,
    InterviewSessionCreate,
    InterviewSessionResponse,
    NotificationResponse,
    PortfolioItemCreate,
    PortfolioItemResponse,
    PrivacySettingsResponse,
    ProjectCreate,
    ProjectResponse,
    RoleUpdateRequest,
    SharedNoteCreate,
    SharedNoteResponse,
    StudyGroupCreate,
    StudyGroupMemberResponse,
    StudyGroupResponse,
    WhiteboardCreate,
    WhiteboardResponse,
)
from app.services.cache_service import get_cache_service


router = APIRouter()


# ----- Roles -----

@router.patch("/role")
async def update_role(
    payload: RoleUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.role not in {"student", "teacher", "parent", "administrator", "institution", "mentor"}:
        raise HTTPException(status_code=400, detail="Invalid role")
    current_user.role = payload.role
    await db.commit()
    await db.refresh(current_user)
    return {"role": current_user.role}


# ----- Study Groups -----

@router.post("/study-groups", response_model=StudyGroupResponse)
async def create_study_group(
    payload: StudyGroupCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = StudyGroup(
        name=payload.name,
        description=payload.description,
        subject=payload.subject,
        is_public=payload.is_public,
        max_members=payload.max_members,
        owner_id=current_user.id,
        settings=payload.settings or {},
    )
    db.add(group)
    await db.flush()
    member = StudyGroupMember(group_id=group.id, user_id=current_user.id, role="owner")
    db.add(member)
    await db.commit()
    await db.refresh(group)
    count_result = await db.execute(select(func.count(StudyGroupMember.id)).where(StudyGroupMember.group_id == group.id))
    member_count = count_result.scalar_one()
    return StudyGroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        subject=group.subject,
        is_public=group.is_public,
        max_members=group.max_members,
        owner_id=group.owner_id,
        settings=group.settings,
        member_count=member_count,
        created_at=group.created_at.isoformat(),
        updated_at=group.updated_at.isoformat(),
    )


@router.get("/study-groups", response_model=list[StudyGroupResponse])
async def list_study_groups(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(StudyGroup))
    groups = result.scalars().all()
    responses = []
    for group in groups:
        count_result = await db.execute(select(func.count(StudyGroupMember.id)).where(StudyGroupMember.group_id == group.id))
        member_count = count_result.scalar_one()
        responses.append(StudyGroupResponse(
            id=group.id,
            name=group.name,
            description=group.description,
            subject=group.subject,
            is_public=group.is_public,
            max_members=group.max_members,
            owner_id=group.owner_id,
            settings=group.settings,
            member_count=member_count,
            created_at=group.created_at.isoformat(),
            updated_at=group.updated_at.isoformat(),
        ))
    return responses


@router.post("/study-groups/{group_id}/join", response_model=StudyGroupMemberResponse)
async def join_study_group(
    group_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group_result = await db.execute(select(StudyGroup).where(StudyGroup.id == group_id))
    group = group_result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    count_result = await db.execute(select(func.count(StudyGroupMember.id)).where(StudyGroupMember.group_id == group_id))
    if count_result.scalar_one() >= group.max_members:
        raise HTTPException(status_code=400, detail="Group is full")
    member = StudyGroupMember(group_id=group_id, user_id=current_user.id, role="member")
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return StudyGroupMemberResponse(
        id=member.id,
        group_id=member.group_id,
        user_id=member.user_id,
        user_name=current_user.full_name,
        role=member.role,
        xp_contributed=member.xp_contributed,
        joined_at=member.created_at.isoformat(),
    )


@router.get("/study-groups/{group_id}/discussions", response_model=list[GroupDiscussionResponse])
async def list_discussions(
    group_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(GroupDiscussion).where(GroupDiscussion.group_id == group_id, GroupDiscussion.parent_id == None).order_by(GroupDiscussion.created_at.desc()))
    discussions = result.scalars().all()
    return [
        GroupDiscussionResponse(
            id=d.id,
            group_id=d.group_id,
            user_id=d.user_id,
            user_name=None,
            content=d.content,
            parent_id=d.parent_id,
            is_pinned=d.is_pinned,
            is_resolved=d.is_resolved,
            created_at=d.created_at.isoformat(),
            updated_at=d.updated_at.isoformat(),
            replies=[],
        )
        for d in discussions
    ]


@router.post("/study-groups/{group_id}/discussions", response_model=GroupDiscussionResponse)
async def create_discussion(
    group_id: str,
    payload: GroupDiscussionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    discussion = GroupDiscussion(group_id=group_id, user_id=current_user.id, content=payload.content, parent_id=payload.parent_id)
    db.add(discussion)
    await db.commit()
    await db.refresh(discussion)
    return GroupDiscussionResponse(
        id=discussion.id,
        group_id=discussion.group_id,
        user_id=discussion.user_id,
        user_name=current_user.full_name,
        content=discussion.content,
        parent_id=discussion.parent_id,
        is_pinned=discussion.is_pinned,
        is_resolved=discussion.is_resolved,
        created_at=discussion.created_at.isoformat(),
        updated_at=discussion.updated_at.isoformat(),
        replies=[],
    )


@router.post("/study-groups/{group_id}/notes", response_model=SharedNoteResponse)
async def create_shared_note(
    group_id: str,
    payload: SharedNoteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note = SharedNote(group_id=group_id, user_id=current_user.id, title=payload.title, content=payload.content, tags=payload.tags)
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return SharedNoteResponse(
        id=note.id,
        group_id=note.group_id,
        user_id=note.user_id,
        user_name=current_user.full_name,
        title=note.title,
        content=note.content,
        tags=note.tags,
        version=note.version,
        created_at=note.created_at.isoformat(),
        updated_at=note.updated_at.isoformat(),
    )


@router.get("/study-groups/{group_id}/notes", response_model=list[SharedNoteResponse])
async def list_shared_notes(
    group_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SharedNote).where(SharedNote.group_id == group_id).order_by(SharedNote.updated_at.desc()))
    notes = result.scalars().all()
    return [
        SharedNoteResponse(
            id=n.id,
            group_id=n.group_id,
            user_id=n.user_id,
            user_name=None,
            title=n.title,
            content=n.content,
            tags=n.tags,
            version=n.version,
            created_at=n.created_at.isoformat(),
            updated_at=n.updated_at.isoformat(),
        )
        for n in notes
    ]


# ----- Projects -----

@router.post("/projects", response_model=ProjectResponse)
async def create_project(
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = Project(
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        subject=payload.subject,
        difficulty=payload.difficulty,
        career_goal=payload.career_goal,
        milestones=payload.milestones or [],
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return ProjectResponse(
        id=project.id,
        user_id=project.user_id,
        title=project.title,
        description=project.description,
        subject=project.subject,
        difficulty=project.difficulty,
        status=project.status,
        milestones=project.milestones,
        progress=project.progress,
        career_goal=project.career_goal,
        feedback=project.feedback,
        completed_at=project.completed_at.isoformat() if project.completed_at else None,
        created_at=project.created_at.isoformat(),
        updated_at=project.updated_at.isoformat(),
    )


@router.get("/projects", response_model=list[ProjectResponse])
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Project).where(Project.user_id == current_user.id).order_by(Project.created_at.desc()))
    projects = result.scalars().all()
    return [
        ProjectResponse(
            id=p.id,
            user_id=p.user_id,
            title=p.title,
            description=p.description,
            subject=p.subject,
            difficulty=p.difficulty,
            status=p.status,
            milestones=p.milestones,
            progress=p.progress,
            career_goal=p.career_goal,
            feedback=p.feedback,
            completed_at=p.completed_at.isoformat() if p.completed_at else None,
            created_at=p.created_at.isoformat(),
            updated_at=p.updated_at.isoformat(),
        )
        for p in projects
    ]


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Project).where(Project.id == project_id, Project.user_id == current_user.id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.title = payload.title
    project.description = payload.description
    project.subject = payload.subject
    project.difficulty = payload.difficulty
    project.career_goal = payload.career_goal
    project.milestones = payload.milestones or []
    await db.commit()
    await db.refresh(project)
    return ProjectResponse(
        id=project.id,
        user_id=project.user_id,
        title=project.title,
        description=project.description,
        subject=project.subject,
        difficulty=project.difficulty,
        status=project.status,
        milestones=project.milestones,
        progress=project.progress,
        career_goal=project.career_goal,
        feedback=project.feedback,
        completed_at=project.completed_at.isoformat() if project.completed_at else None,
        created_at=project.created_at.isoformat(),
        updated_at=project.updated_at.isoformat(),
    )


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Project).where(Project.id == project_id, Project.user_id == current_user.id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ----- Portfolio -----

@router.post("/portfolio", response_model=PortfolioItemResponse)
async def create_portfolio_item(
    payload: PortfolioItemCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = PortfolioItem(
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        item_type=payload.item_type,
        tags=payload.tags,
        media_urls=payload.media_urls,
        is_public=payload.is_public,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return PortfolioItemResponse(
        id=item.id,
        user_id=item.user_id,
        title=item.title,
        description=item.description,
        item_type=item.item_type,
        tags=item.tags,
        media_urls=item.media_urls,
        is_public=item.is_public,
        certificate_id=item.certificate_id,
        created_at=item.created_at.isoformat(),
        updated_at=item.updated_at.isoformat(),
    )


@router.get("/portfolio", response_model=list[PortfolioItemResponse])
async def list_portfolio(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PortfolioItem).where(PortfolioItem.user_id == current_user.id).order_by(PortfolioItem.created_at.desc()))
    items = result.scalars().all()
    return [
        PortfolioItemResponse(
            id=i.id,
            user_id=i.user_id,
            title=i.title,
            description=i.description,
            item_type=i.item_type,
            tags=i.tags,
            media_urls=i.media_urls,
            is_public=i.is_public,
            certificate_id=i.certificate_id,
            created_at=i.created_at.isoformat(),
            updated_at=i.updated_at.isoformat(),
        )
        for i in items
    ]


# ----- Notifications -----

@router.get("/notifications", response_model=list[NotificationResponse])
async def list_notifications(
    unread_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Notification).where(Notification.user_id == current_user.id)
    if unread_only:
        query = query.where(Notification.is_read == False)
    result = await db.execute(query.order_by(Notification.created_at.desc()))
    notifications = result.scalars().all()
    return [
        NotificationResponse(
            id=n.id,
            type=n.type,
            title=n.title,
            body=n.body,
            data=n.data,
            is_read=n.is_read,
            created_at=n.created_at.isoformat(),
            read_at=n.read_at.isoformat() if n.read_at else None,
        )
        for n in notifications
    ]


@router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Notification).where(Notification.id == notification_id, Notification.user_id == current_user.id))
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    notification.read_at = datetime.utcnow()
    await db.commit()
    return {"read": True}


@router.post("/notifications/read-all")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Notification).where(Notification.user_id == current_user.id, Notification.is_read == False))
    notifications = result.scalars().all()
    for notification in notifications:
        notification.is_read = True
        notification.read_at = datetime.utcnow()
    await db.commit()
    return {"updated": len(notifications)}


# ----- Calendar -----

@router.post("/calendar/events", response_model=CalendarEventResponse)
async def create_calendar_event(
    payload: CalendarEventCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event = CalendarEvent(
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        event_type=payload.event_type,
        start_time=payload.start_time,
        end_time=payload.end_time,
        reminder_minutes=payload.reminder_minutes,
        related_type=payload.related_type,
        related_id=payload.related_id,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return CalendarEventResponse(
        id=event.id,
        title=event.title,
        description=event.description,
        event_type=event.event_type,
        start_time=event.start_time.isoformat(),
        end_time=event.end_time.isoformat(),
        is_completed=event.is_completed,
        reminder_minutes=event.reminder_minutes,
        related_type=event.related_type,
        related_id=event.related_id,
        created_at=event.created_at.isoformat(),
        updated_at=event.updated_at.isoformat(),
    )


@router.get("/calendar/events", response_model=list[CalendarEventResponse])
async def list_calendar_events(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(CalendarEvent).where(CalendarEvent.user_id == current_user.id)
    if start_date:
        query = query.where(CalendarEvent.start_time >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.where(CalendarEvent.end_time <= datetime.fromisoformat(end_date))
    result = await db.execute(query.order_by(CalendarEvent.start_time.asc()))
    events = result.scalars().all()
    return [
        CalendarEventResponse(
            id=e.id,
            title=e.title,
            description=e.description,
            event_type=e.event_type,
            start_time=e.start_time.isoformat(),
            end_time=e.end_time.isoformat(),
            is_completed=e.is_completed,
            reminder_minutes=e.reminder_minutes,
            related_type=e.related_type,
            related_id=e.related_id,
            created_at=e.created_at.isoformat(),
            updated_at=e.updated_at.isoformat(),
        )
        for e in events
    ]


@router.patch("/calendar/events/{event_id}/complete")
async def complete_calendar_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CalendarEvent).where(CalendarEvent.id == event_id, CalendarEvent.user_id == current_user.id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.is_completed = True
    await db.commit()
    return {"completed": True}


# ----- Badges -----

@router.get("/badges", response_model=list[BadgeResponse])
async def list_badges(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(UserBadge).where(UserBadge.user_id == current_user.id).order_by(UserBadge.unlocked_at.desc()))
    badges = result.scalars().all()
    return [
        BadgeResponse(
            id=b.id,
            badge_id=b.badge_id,
            name=b.name,
            description=b.description,
            icon=b.icon,
            unlocked_at=b.unlocked_at.isoformat(),
        )
        for b in badges
    ]


# ----- Interview Simulator -----

@router.post("/interview/sessions", response_model=InterviewSessionResponse)
async def create_interview_session(
    payload: InterviewSessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = InterviewSession(
        user_id=current_user.id,
        interview_type=payload.interview_type,
        role=payload.role,
        questions=[],
        answers=[],
        feedback={},
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return InterviewSessionResponse(
        id=session.id,
        interview_type=session.interview_type,
        role=session.role,
        questions=session.questions,
        answers=session.answers,
        feedback=session.feedback,
        score=session.score,
        completed=session.completed,
        created_at=session.created_at.isoformat(),
        updated_at=session.updated_at.isoformat(),
    )


@router.get("/interview/sessions", response_model=list[InterviewSessionResponse])
async def list_interview_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(InterviewSession).where(InterviewSession.user_id == current_user.id).order_by(InterviewSession.created_at.desc()))
    sessions = result.scalars().all()
    return [
        InterviewSessionResponse(
            id=s.id,
            interview_type=s.interview_type,
            role=s.role,
            questions=s.questions,
            answers=s.answers,
            feedback=s.feedback,
            score=s.score,
            completed=s.completed,
            created_at=s.created_at.isoformat(),
            updated_at=s.updated_at.isoformat(),
        )
        for s in sessions
    ]


# ----- Coding Playground -----

@router.post("/coding/sessions", response_model=CodingSessionResponse)
async def create_coding_session(
    payload: CodingSessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = CodingSession(
        user_id=current_user.id,
        language=payload.language,
        problem=payload.problem,
        code="",
        output=None,
        errors=[],
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return CodingSessionResponse(
        id=session.id,
        language=session.language,
        problem=session.problem,
        code=session.code,
        output=session.output,
        errors=session.errors,
        hints_used=session.hints_used,
        completed=session.completed,
        execution_time=session.execution_time,
        created_at=session.created_at.isoformat(),
        updated_at=session.updated_at.isoformat(),
    )


@router.patch("/coding/sessions/{session_id}", response_model=CodingSessionResponse)
async def update_coding_session(
    session_id: str,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    code = payload.get("code")
    result = await db.execute(select(CodingSession).where(CodingSession.id == session_id, CodingSession.user_id == current_user.id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.code = code
    await db.commit()
    await db.refresh(session)
    return CodingSessionResponse(
        id=session.id,
        language=session.language,
        problem=session.problem,
        code=session.code,
        output=session.output,
        errors=[{"message": err} if isinstance(err, str) else err for err in session.errors] if isinstance(session.errors, list) else [],
        hints_used=session.hints_used,
        completed=session.completed,
        execution_time=session.execution_time,
        created_at=session.created_at.isoformat(),
        updated_at=session.updated_at.isoformat(),
    )


@router.get("/coding/sessions", response_model=list[CodingSessionResponse])
async def list_coding_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CodingSession).where(CodingSession.user_id == current_user.id).order_by(CodingSession.created_at.desc()))
    sessions = result.scalars().all()
    return [
        CodingSessionResponse(
            id=s.id,
            language=s.language,
            problem=s.problem,
            code=s.code,
            output=s.output,
            errors=[{"message": err} if isinstance(err, str) else err for err in s.errors] if isinstance(s.errors, list) else [],
            hints_used=s.hints_used,
            completed=s.completed,
            execution_time=s.execution_time,
            created_at=s.created_at.isoformat(),
            updated_at=s.updated_at.isoformat(),
        )
        for s in sessions
    ]

executor_service = CodeExecutorService()

@router.post("/coding/sessions/{session_id}/run", response_model=CodingSessionResponse)
async def run_coding_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CodingSession).where(CodingSession.id == session_id, CodingSession.user_id == current_user.id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    execution_result = await executor_service.execute(session.code, session.language)
    
    session.output = execution_result["output"]
    # Ensure errors are a list of dicts: [{"message": "..."}]
    formatted_errors = [{"message": err} for err in execution_result.get("errors", []) if err]
    session.errors = formatted_errors
    session.completed = True
    await db.commit()
    await db.refresh(session)
    
    return CodingSessionResponse(
        id=session.id,
        language=session.language,
        problem=session.problem,
        code=session.code,
        output=session.output,
        errors=session.errors,
        hints_used=session.hints_used,
        completed=session.completed,
        execution_time=session.execution_time,
        created_at=session.created_at.isoformat(),
        updated_at=session.updated_at.isoformat(),
    )



# ----- Whiteboard -----

@router.post("/whiteboards", response_model=WhiteboardResponse)
async def create_whiteboard(
    payload: WhiteboardCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    whiteboard = Whiteboard(
        title=payload.title,
        group_id=payload.group_id,
        user_id=current_user.id,
        elements=payload.elements,
        is_public=payload.is_public,
    )
    db.add(whiteboard)
    await db.commit()
    await db.refresh(whiteboard)
    return WhiteboardResponse(
        id=whiteboard.id,
        group_id=whiteboard.group_id,
        user_id=whiteboard.user_id,
        title=whiteboard.title,
        elements=whiteboard.elements,
        is_public=whiteboard.is_public,
        created_at=whiteboard.created_at.isoformat(),
        updated_at=whiteboard.updated_at.isoformat(),
    )


@router.get("/whiteboards", response_model=list[WhiteboardResponse])
async def list_whiteboards(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Whiteboard).where(Whiteboard.user_id == current_user.id).order_by(Whiteboard.updated_at.desc()))
    boards = result.scalars().all()
    return [
        WhiteboardResponse(
            id=b.id,
            group_id=b.group_id,
            user_id=b.user_id,
            title=b.title,
            elements=b.elements,
            is_public=b.is_public,
            created_at=b.created_at.isoformat(),
            updated_at=b.updated_at.isoformat(),
        )
        for b in boards
    ]


@router.patch("/whiteboards/{board_id}", response_model=WhiteboardResponse)
async def update_whiteboard(
    board_id: str,
    payload: WhiteboardCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Whiteboard).where(Whiteboard.id == board_id, Whiteboard.user_id == current_user.id))
    board = result.scalar_one_or_none()
    if not board:
        raise HTTPException(status_code=404, detail="Whiteboard not found")
    board.title = payload.title
    board.elements = payload.elements
    board.is_public = payload.is_public
    await db.commit()
    await db.refresh(board)
    return WhiteboardResponse(
        id=board.id,
        group_id=board.group_id,
        user_id=board.user_id,
        title=board.title,
        elements=board.elements,
        is_public=board.is_public,
        created_at=board.created_at.isoformat(),
        updated_at=board.updated_at.isoformat(),
    )


# ----- Forum -----

@router.post("/forum/posts", response_model=ForumPostResponse)
async def create_forum_post(
    payload: ForumPostCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = ForumPost(
        user_id=current_user.id,
        title=payload.title,
        content=payload.content,
        topic=payload.topic,
        tags=payload.tags,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    count_result = await db.execute(select(func.count(ForumComment.id)).where(ForumComment.post_id == post.id))
    comment_count = count_result.scalar_one()
    return ForumPostResponse(
        id=post.id,
        user_id=post.user_id,
        user_name=current_user.full_name,
        title=post.title,
        content=post.content,
        topic=post.topic,
        tags=post.tags,
        views=post.views,
        upvotes=post.upvotes,
        is_resolved=post.is_resolved,
        comment_count=comment_count,
        created_at=post.created_at.isoformat(),
        updated_at=post.updated_at.isoformat(),
    )


@router.get("/forum/posts", response_model=list[ForumPostResponse])
async def list_forum_posts(
    topic: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(ForumPost)
    if topic:
        query = query.where(ForumPost.topic == topic)
    result = await db.execute(query.order_by(ForumPost.created_at.desc()))
    posts = result.scalars().all()
    return [
        ForumPostResponse(
            id=p.id,
            user_id=p.user_id,
            user_name=None,
            title=p.title,
            content=p.content,
            topic=p.topic,
            tags=p.tags,
            views=p.views,
            upvotes=p.upvotes,
            is_resolved=p.is_resolved,
            comment_count=0,
            created_at=p.created_at.isoformat(),
            updated_at=p.updated_at.isoformat(),
        )
        for p in posts
    ]


@router.post("/forum/posts/{post_id}/comments", response_model=ForumCommentResponse)
async def create_forum_comment(
    post_id: str,
    payload: ForumCommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    comment = ForumComment(post_id=post_id, user_id=current_user.id, content=payload.content, parent_id=payload.parent_id)
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return ForumCommentResponse(
        id=comment.id,
        post_id=comment.post_id,
        user_id=comment.user_id,
        user_name=current_user.full_name,
        content=comment.content,
        parent_id=comment.parent_id,
        is_accepted=comment.is_accepted,
        created_at=comment.created_at.isoformat(),
        updated_at=comment.updated_at.isoformat(),
    )


@router.get("/forum/posts/{post_id}/comments", response_model=list[ForumCommentResponse])
async def list_forum_comments(
    post_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ForumComment).where(ForumComment.post_id == post_id).order_by(ForumComment.created_at.asc()))
    comments = result.scalars().all()
    return [
        ForumCommentResponse(
            id=c.id,
            post_id=c.post_id,
            user_id=c.user_id,
            user_name=None,
            content=c.content,
            parent_id=c.parent_id,
            is_accepted=c.is_accepted,
            created_at=c.created_at.isoformat(),
            updated_at=c.updated_at.isoformat(),
        )
        for c in comments
    ]


# ----- Privacy -----

@router.get("/privacy", response_model=PrivacySettingsResponse)
async def get_privacy_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PrivacySettings).where(PrivacySettings.user_id == current_user.id))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = PrivacySettings(user_id=current_user.id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return PrivacySettingsResponse(
        id=settings.id,
        profile_visibility=settings.profile_visibility,
        show_xp=settings.show_xp,
        show_badges=settings.show_badges,
        show_progress=settings.show_progress,
        allow_study_group_invites=settings.allow_study_group_invites,
        allow_mentor_messages=settings.allow_mentor_messages,
        data_sharing=settings.data_sharing,
        allow_analytics=settings.allow_analytics,
    )


@router.patch("/privacy", response_model=PrivacySettingsResponse)
async def update_privacy_settings(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PrivacySettings).where(PrivacySettings.user_id == current_user.id))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = PrivacySettings(user_id=current_user.id)
        db.add(settings)
    allowed = {
        "profile_visibility", "show_xp", "show_badges", "show_progress",
        "allow_study_group_invites", "allow_mentor_messages", "data_sharing", "allow_analytics",
    }
    for key, value in payload.items():
        if key in allowed and hasattr(settings, key):
            setattr(settings, key, value)
    await db.commit()
    await db.refresh(settings)
    return PrivacySettingsResponse(
        id=settings.id,
        profile_visibility=settings.profile_visibility,
        show_xp=settings.show_xp,
        show_badges=settings.show_badges,
        show_progress=settings.show_progress,
        allow_study_group_invites=settings.allow_study_group_invites,
        allow_mentor_messages=settings.allow_mentor_messages,
        data_sharing=settings.data_sharing,
        allow_analytics=settings.allow_analytics,
    )
