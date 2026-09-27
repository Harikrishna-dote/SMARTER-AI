import asyncio
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
import logging
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.orchestrator import AIOrchestrator
from app.core.database import get_db
from app.core.deps import get_current_user, get_orchestrator
from app.models.user import User
from app.schemas.classroom import (
    AutonomousSessionRequest,
    CheckpointUpdateRequest,
    ChangeAutonomousTopicRequest,
    CreateLearningClassRequest,
    CurriculumUpdateRequest,
    ContinueAutonomousLessonRequest,
    EvaluateHomeworkRequest,
    GenerateHomeworkRequest,
    GenerateLessonRequest,
    GenerateNotesRequest,
    GenerateQuizRequest,
    GeneratedHomework,
    GeneratedLesson,
    GeneratedNotes,
    GeneratedQuiz,
    HomeworkEvaluation,
    LearningClassRead,
    StartLearningClassRead,
    SyllabusExtractionRead,
    ProgressUpdate,
    ClassroomProgressRead,
)
from app.services.classroom_service import ClassroomService
from app.services.class_preparation_service import ClassPreparationService

router = APIRouter()

logger = logging.getLogger(__name__)


def _preparation_service(db: AsyncSession, orchestrator: AIOrchestrator) -> ClassPreparationService:
    return ClassPreparationService(db, orchestrator.gateway, orchestrator=orchestrator)


@router.post("/classes/syllabus", response_model=SyllabusExtractionRead)
async def extract_class_syllabus(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> SyllabusExtractionRead:
    """Store and extract a syllabus using the existing safe upload pipeline."""
    document = await orchestrator.document_service.save_upload(current_user.id, file)
    if not document.extracted_text and document.content_type.startswith("image/"):
        # DocumentService owns safe storage; VisionService supplies OCR for
        # image syllabi without inventing content when OCR is unavailable.
        extracted = await asyncio.to_thread(
            orchestrator.vision_service.ocr_bytes,
            Path(document.storage_path).read_bytes(),
        )
        document.extracted_text = extracted
        db.add(document)
        await db.commit()
    return await _preparation_service(db, orchestrator).extract_syllabus(document.filename, document.extracted_text)


@router.post("/classes", response_model=LearningClassRead, status_code=status.HTTP_201_CREATED)
async def create_learning_class(
    payload: CreateLearningClassRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> LearningClassRead:
    try:
        return await _preparation_service(db, orchestrator).create(payload, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/classes", response_model=list[LearningClassRead])
async def list_learning_classes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> list[LearningClassRead]:
    return await _preparation_service(db, orchestrator).list_for_user(current_user.id)


@router.get("/classes/{class_id}", response_model=LearningClassRead)
async def read_learning_class(
    class_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> LearningClassRead:
    try:
        record = await _preparation_service(db, orchestrator).get_for_user(class_id, current_user.id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return LearningClassRead.model_validate(record)


@router.patch("/classes/{class_id}/curriculum", response_model=LearningClassRead)
async def update_learning_class_curriculum(
    class_id: str,
    payload: CurriculumUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> LearningClassRead:
    try:
        return await _preparation_service(db, orchestrator).update_curriculum(class_id, payload, current_user.id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/classes/{class_id}/checkpoint", response_model=LearningClassRead)
async def save_learning_class_checkpoint(
    class_id: str,
    payload: CheckpointUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> LearningClassRead:
    try:
        return await _preparation_service(db, orchestrator).save_checkpoint(class_id, payload, current_user.id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/classes/{class_id}/start", response_model=StartLearningClassRead)
async def start_learning_class(
    class_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> dict:
    try:
        return await _preparation_service(db, orchestrator).start(class_id, current_user.id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post("/lesson", response_model=GeneratedLesson)
async def create_lesson(
    payload: GenerateLessonRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> GeneratedLesson:
    return await orchestrator.classroom_service.generate_lesson(payload.config, payload.topic, current_user.id)


@router.post("/autonomous/start")
async def start_autonomous_lesson(
    payload: GenerateLessonRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
):
    return await orchestrator.classroom_service.start_autonomous_lesson(payload.config, payload.topic, current_user.id)


@router.get("/autonomous/stream/{session_id}")
async def stream_autonomous_lesson(
    session_id: str,
    current_user: User = Depends(get_current_user),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
):
    from starlette.responses import StreamingResponse
    import json

    async def event_generator():
        config = await orchestrator.classroom_service.get_lesson_config(session_id, current_user.id)
        if not config:
            yield f"data: {json.dumps({'type': 'error', 'message': 'Session not found'})}\n\n"
            return

        async for chunk in orchestrator.classroom_service.stream_autonomous_lesson(session_id, current_user.id, config):
            yield f"data: {json.dumps(chunk)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/autonomous/continue")
async def continue_autonomous_lesson(
    payload: ContinueAutonomousLessonRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
):
    return await orchestrator.classroom_service.continue_lesson(
        payload.session_id,
        current_user.id,
        payload.student_input,
    )


@router.post("/autonomous/pause")
async def pause_autonomous_lesson(
    payload: AutonomousSessionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
):
    return {"paused": await orchestrator.classroom_service.pause_lesson(payload.session_id, current_user.id)}


@router.post("/autonomous/resume")
async def resume_autonomous_lesson(
    payload: AutonomousSessionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
):
    return await orchestrator.classroom_service.resume_lesson(payload.session_id, current_user.id)


@router.post("/autonomous/change-topic")
async def change_topic(
    payload: ChangeAutonomousTopicRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
):
    return await orchestrator.classroom_service.change_topic(
        payload.session_id,
        current_user.id,
        payload.new_topic,
        payload.config,
    )


@router.post("/quiz", response_model=GeneratedQuiz)
async def create_quiz(
    payload: GenerateQuizRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> GeneratedQuiz:
    return await orchestrator.classroom_service.generate_quiz(
        payload.config, payload.topic, payload.count, payload.types
    )


@router.post("/notes", response_model=GeneratedNotes)
async def create_notes(
    payload: GenerateNotesRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> GeneratedNotes:
    return await orchestrator.classroom_service.generate_notes(payload.config, payload.topic)


@router.post("/homework", response_model=GeneratedHomework)
async def create_homework(
    payload: GenerateHomeworkRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> GeneratedHomework:
    return await orchestrator.classroom_service.generate_homework(
        payload.config, payload.topic, payload.difficulty
    )


@router.post("/evaluate", response_model=HomeworkEvaluation)
async def evaluate_homework(
    payload: EvaluateHomeworkRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> HomeworkEvaluation:
    items = [item.model_dump() for item in payload.items]
    return await orchestrator.classroom_service.evaluate_homework(payload.config, items, "")


@router.get("/progress", response_model=ClassroomProgressRead)
async def read_progress(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> ClassroomProgressRead:
    return await orchestrator.classroom_service.get_progress(current_user.id)


@router.post("/progress", response_model=ClassroomProgressRead)
async def update_progress(
    payload: ProgressUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> ClassroomProgressRead:
    return await orchestrator.classroom_service.update_progress(current_user.id, payload)


@router.post("/visualization")
async def generate_visualization(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
):
    topic = payload.get("topic", "General")
    concept = payload.get("concept", topic)
    subject = payload.get("subject", topic)
    difficulty = payload.get("difficulty", "medium")
    level = payload.get("level", "Adaptive")
    mode_hint = payload.get("mode_hint")
    real_world_example = payload.get("real_world_example", "")

    try:
        import re
        text = f"{topic} {concept} {subject}".lower()
        if re.search(r"sort|search|loop|recursion|stack|heap|variable|algorithm|code|program", text):
            mode = "code_trace"
        elif re.search(r"gravity|motion|force|orbit|solar|planet|reaction|dna|cell|circuit", text):
            mode = "simulation"
        elif re.search(r"function|graph|calculus|vector|matrix|probability|statistics|equation", text):
            mode = "math_graph"
        elif re.search(r"history|timeline|constitution|geography|law|political", text):
            mode = "timeline"
        elif re.search(r"network|routing|packet|cloud|security|cyber", text):
            mode = "network"
        elif re.search(r"process|architecture|system|workflow|database|join", text):
            mode = "flowchart"
        elif re.search(r"algebra|geometry|trigonometry|math", text):
            mode = "math_graph"
        else:
            mode = mode_hint or "diagram"

        if mode == "code_trace":
            scene = {
                "mode": "code_trace",
                "title": f"{topic}: {concept}",
                "description": f"Step-by-step code execution trace for {concept}",
                "complexity": "medium",
                "elements": [
                    {"type": "code_block", "x": 50, "y": 50, "width": 340, "height": 520, "code": f"function {topic}() {{\n  // step 1\n  // step 2\n  return result;\n}}", "language": "javascript", "color": "#1e293b"},
                    {"type": "arrow", "from": [390, 310], "to": [450, 310], "color": "#38bdf8"},
                    {"type": "stack", "x": 450, "y": 50, "width": 300, "height": 520, "frames": ["main()", topic + "()", "return"], "color": "#334155"},
                ],
                "animation_steps": [
                    {"id": "1", "label": "Code", "description": "Show the code", "duration_ms": 1000, "actions": [{"type": "highlight_line", "line": 1}], "narration": f"Let's trace this {topic} code."},
                    {"id": "2", "label": "Stack", "description": "Push to stack", "duration_ms": 1200, "actions": [{"type": "push_stack", "frame": topic + "()"}], "narration": "Function is called."},
                    {"id": "3", "label": "Execute", "description": "Run step by step", "duration_ms": 2000, "actions": [{"type": "highlight_line", "line": 3}], "narration": "Executing line by line..."},
                    {"id": "4", "label": "Return", "description": "Pop from stack", "duration_ms": 1200, "actions": [{"type": "pop_stack"}], "narration": "Function returns."},
                ],
                "real_world_demo": real_world_example or f"Trace {concept} like a debugger: input, variable changes, and output.",
                "accessibility_description": f"This code trace visualization demonstrates {concept} within {topic}. Difficulty: {difficulty}. Level: {level}.",
                "interactive_points": [{"x": 200, "y": 300, "label": "Code", "description": f"Source code for {topic}"}, {"x": 600, "y": 300, "label": "Stack", "description": "Call stack visualization"}],
            }
        elif mode == "simulation":
            scene = {
                "mode": "simulation",
                "title": f"{topic}: {concept}",
                "description": f"Real-time simulation demonstrating {concept}",
                "complexity": "high",
                "elements": [
                    {"type": "container", "x": 50, "y": 50, "width": 700, "height": 500, "color": "#1e293b", "label": "Simulation"},
                    {"type": "particle", "x": 150, "y": 300, "radius": 12, "color": "#38bdf8", "label": "Input"},
                    {"type": "arrow", "from": [162, 300], "to": [300, 300], "color": "#22c55e", "label": "Process"},
                    {"type": "node", "x": 300, "y": 280, "width": 80, "height": 40, "color": "#22c55e", "label": topic},
                    {"type": "arrow", "from": [340, 300], "to": [500, 300], "color": "#f59e0b", "label": "Output"},
                    {"type": "particle", "x": 550, "y": 300, "radius": 12, "color": "#f59e0b", "label": "Result"},
                ],
                "animation_steps": [
                    {"id": "1", "label": "Initialize", "description": "Set up initial conditions", "duration_ms": 1000, "actions": [{"type": "highlight", "element": "container"}], "narration": f"Let's start with {topic}."},
                    {"id": "2", "label": "Input", "description": "Introduce input parameters", "duration_ms": 1500, "actions": [{"type": "animate", "property": "x", "from": 150, "to": 300}], "narration": "Now watch how the input flows through."},
                    {"id": "3", "label": "Process", "description": "Apply the core process", "duration_ms": 2000, "actions": [{"type": "highlight", "element": "node"}], "narration": f"Here is the key {concept} logic."},
                    {"id": "4", "label": "Output", "description": "Observe the result", "duration_ms": 1500, "actions": [{"type": "animate", "property": "x", "from": 500, "to": 600}], "narration": "And here is the output!"},
                ],
                "real_world_demo": real_world_example or f"Real-time simulation of {topic} showing input, processing, and output.",
                "accessibility_description": f"This simulation demonstrates {concept} in {topic}. Watch particles flow through the system.",
                "interactive_points": [{"x": 300, "y": 300, "label": "Core Process", "description": f"This is where {concept} happens"}, {"x": 150, "y": 300, "label": "Input", "description": "Where data enters"}, {"x": 550, "y": 300, "label": "Output", "description": "The result"}],
            }
        elif mode == "math_graph":
            scene = {
                "mode": "math_graph",
                "title": f"{topic}: {concept}",
                "description": f"Mathematical visualization of {concept}",
                "complexity": "medium",
                "elements": [
                    {"type": "axes", "x": 100, "y": 500, "width": 600, "height": 400, "color": "#94a3b8", "label": "Graph"},
                    {"type": "curve", "points": [[100, 400], [200, 350], [300, 280], [400, 200], [500, 150], [600, 100]], "color": "#38bdf8", "strokeWidth": 3, "label": topic},
                    {"type": "label", "x": 650, "y": 90, "text": concept, "color": "#f1f5f9", "fontSize": 14},
                ],
                "animation_steps": [
                    {"id": "1", "label": "Axes", "description": "Draw coordinate system", "duration_ms": 1000, "actions": [], "narration": "First, let's set up our graph."},
                    {"id": "2", "label": "Plot", "description": "Draw the curve", "duration_ms": 2000, "actions": [{"type": "draw_curve"}], "narration": f"This is the graph of {topic}."},
                    {"id": "3", "label": "Analyze", "description": "Point out key features", "duration_ms": 1500, "actions": [{"type": "highlight_point", "x": 400, "y": 200}], "narration": "Notice the key point here."},
                ],
                "real_world_demo": real_world_example or f"Mathematical relationship in {topic} showing how variables interact.",
                "accessibility_description": f"Graph showing {concept} with axes, curve, and key points.",
                "interactive_points": [{"x": 400, "y": 200, "label": "Key Point", "description": f"Important point on the {topic} graph"}],
            }
        elif mode == "flowchart":
            scene = {
                "mode": "flowchart",
                "title": f"{topic}: {concept}",
                "description": f"Flowchart explaining the process of {concept}",
                "complexity": "medium",
                "elements": [
                    {"type": "rect", "x": 400, "y": 50, "width": 100, "height": 40, "color": "#38bdf8", "label": "Start"},
                    {"type": "arrow", "from": [400, 90], "to": [400, 150], "color": "#94a3b8"},
                    {"type": "diamond", "x": 400, "y": 180, "width": 100, "height": 60, "color": "#f59e0b", "label": topic},
                    {"type": "arrow", "from": [400, 210], "to": [400, 280], "color": "#94a3b8"},
                    {"type": "rect", "x": 400, "y": 300, "width": 100, "height": 40, "color": "#22c55e", "label": "Result"},
                ],
                "animation_steps": [
                    {"id": "1", "label": "Start", "description": "Begin the flow", "duration_ms": 800, "actions": [{"type": "highlight", "element": "start"}], "narration": f"Let's trace the flow of {topic}."},
                    {"id": "2", "label": "Decision", "description": "Make a decision", "duration_ms": 1200, "actions": [{"type": "highlight", "element": "decision"}], "narration": "Here is the key decision point."},
                    {"id": "3", "label": "Result", "description": "Reach the outcome", "duration_ms": 1000, "actions": [{"type": "highlight", "element": "result"}], "narration": "And this is the result."},
                ],
                "real_world_demo": real_world_example or f"Workflow showing how {topic} processes information from start to finish.",
                "accessibility_description": f"Flowchart showing the step-by-step process of {concept}.",
                "interactive_points": [{"x": 400, "y": 70, "label": "Start", "description": "Entry point"}, {"x": 400, "y": 180, "label": "Decision", "description": f"Key {concept} decision"}, {"x": 400, "y": 320, "label": "Result", "description": "Final outcome"}],
            }
        elif mode == "network":
            scene = {
                "mode": "network",
                "title": f"{topic}: {concept}",
                "description": f"Network diagram showing relationships in {concept}",
                "complexity": "medium",
                "elements": [
                    {"type": "node", "x": 400, "y": 300, "radius": 24, "color": "#38bdf8", "label": topic},
                    {"type": "node", "x": 200, "y": 150, "radius": 18, "color": "#22c55e", "label": "Input A"},
                    {"type": "node", "x": 600, "y": 150, "radius": 18, "color": "#f59e0b", "label": "Input B"},
                    {"type": "node", "x": 200, "y": 450, "radius": 18, "color": "#ef4444", "label": "Output"},
                    {"type": "edge", "from": [218, 150], "to": [386, 300], "color": "#64748b"},
                    {"type": "edge", "from": [582, 150], "to": [414, 300], "color": "#64748b"},
                    {"type": "edge", "from": [400, 324], "to": [218, 450], "color": "#64748b"},
                ],
                "animation_steps": [
                    {"id": "1", "label": "Nodes", "description": "Show all nodes", "duration_ms": 1000, "actions": [{"type": "highlight", "element": "node"}], "narration": f"Here are the key components of {topic}."},
                    {"id": "2", "label": "Connections", "description": "Show relationships", "duration_ms": 1500, "actions": [{"type": "animate", "property": "opacity", "from": 0, "to": 1}], "narration": "These are the connections between them."},
                ],
                "real_world_demo": real_world_example or f"Network of {topic} showing how components interact and communicate.",
                "accessibility_description": f"Network diagram with nodes and edges representing {concept}.",
                "interactive_points": [{"x": 400, "y": 300, "label": "Central", "description": f"Main {concept} node"}, {"x": 200, "y": 150, "label": "Input A", "description": "First input"}, {"x": 600, "y": 150, "label": "Input B", "description": "Second input"}],
            }
        elif mode == "timeline":
            scene = {
                "mode": "timeline",
                "title": f"{topic}: {concept}",
                "description": f"Timeline showing the progression of {concept}",
                "complexity": "low",
                "elements": [
                    {"type": "line", "from": [100, 400], "to": [700, 400], "color": "#94a3b8", "strokeWidth": 2},
                    {"type": "circle", "x": 150, "y": 400, "radius": 8, "color": "#38bdf8", "label": "Past"},
                    {"type": "circle", "x": 400, "y": 400, "radius": 10, "color": "#f59e0b", "label": concept},
                    {"type": "circle", "x": 650, "y": 400, "radius": 8, "color": "#22c55e", "label": "Future"},
                ],
                "animation_steps": [
                    {"id": "1", "label": "Past", "description": "Show origins", "duration_ms": 1000, "actions": [], "narration": "Let's start from the beginning."},
                    {"id": "2", "label": "Event", "description": "Key moment", "duration_ms": 1500, "actions": [{"type": "highlight", "element": "event"}], "narration": f"Here is the key {concept} event."},
                    {"id": "3", "label": "Future", "description": "What comes next", "duration_ms": 1000, "actions": [], "narration": "And this is where it leads."},
                ],
                "real_world_demo": real_world_example or f"Timeline of {topic} showing past, present, and future developments.",
                "accessibility_description": f"Timeline showing the progression of {concept} from past to future.",
                "interactive_points": [{"x": 150, "y": 400, "label": "Past", "description": "Earlier events"}, {"x": 400, "y": 400, "label": concept, "description": "Key event"}, {"x": 650, "y": 400, "label": "Future", "description": "What comes next"}],
            }
        else:
            scene = {
                "mode": "diagram",
                "title": f"{topic}: {concept}",
                "description": f"Clear diagram showing the structure of {concept}",
                "complexity": "medium",
                "elements": [
                    {"type": "rect", "x": 400, "y": 200, "width": 300, "height": 200, "color": "#1e293b", "label": topic},
                    {"type": "label", "x": 300, "y": 280, "text": concept, "color": "#f1f5f9", "fontSize": 16},
                    {"type": "label", "x": 300, "y": 320, "text": "Interactive visualization", "color": "#94a3b8", "fontSize": 12},
                ],
                "animation_steps": [
                    {"id": "1", "label": "Overview", "description": "Show the concept", "duration_ms": 2000, "actions": [], "narration": f"Let's look at {concept}."},
                ],
                "real_world_demo": real_world_example or f"Real-world application of {topic} in everyday technology and industry.",
                "accessibility_description": f"Diagram showing the structure and components of {concept}.",
                "interactive_points": [{"x": 400, "y": 300, "label": concept, "description": f"Main concept: {topic}"}],
            }

        return scene
    except Exception as exc:
        logger.warning("Visualization generation failed, using fallback: %s", exc)
        return {
            "mode": "diagram",
            "title": f"{topic}: {concept}",
            "description": f"Visual explanation of {concept}",
            "complexity": "medium",
            "elements": [{"type": "rect", "x": 400, "y": 300, "width": 200, "height": 100, "color": "#38bdf8", "label": concept}],
            "animation_steps": [],
            "real_world_demo": real_world_example or f"Real-world application of {topic}",
            "accessibility_description": f"Visual explanation of {concept} at {level} level",
        }


@router.post("/avatar/control")
async def control_avatar(
    payload: dict,
    current_user: User = Depends(get_current_user),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
):
    from app.schemas.classroom import AvatarControlRequest
    try:
        validated = AvatarControlRequest.model_validate(payload)
        response = {
            "status": "ok",
            "avatar_state": validated.model_dump(exclude_none=True),
            "timestamp": datetime.utcnow().isoformat(),
        }
        if orchestrator.classroom_service:
            response["hint"] = "Avatar state updated successfully"
        return response
    except Exception as exc:
        logger.warning("Avatar control failed: %s", exc)
        return {"status": "error", "detail": str(exc)}
