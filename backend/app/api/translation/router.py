from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.language_learning_engine import LanguageLearningEngine
from app.application.orchestrator import AIOrchestrator
from app.core.database import get_db
from app.core.deps import get_current_user, get_orchestrator
from app.models.user import User
from app.schemas.translation import (
    AnalysisRequest,
    AnalysisResponse,
    BookmarkResponse,
    ExplainRequest,
    ExplainResponse,
    FlashcardGenerateRequest,
    FlashcardResponse,
    GrammarRequest,
    GrammarResponse,
    LanguageOption,
    OCRResponse,
    PronunciationRequest,
    QuizGenerateRequest,
    QuizResponse,
    SavedPhraseResponse,
    SentenceBreakdown,
    TranslationHistoryItem,
    TranslationLearningPlanRequest,
    TranslationLearningPlanResponse,
    TranslationTextRequest,
    TranslationTextResponse,
    TranslationTone,
    VocabularyItemResponse,
)
from app.services.translation_engine import TranslationEngine, supported_languages


router = APIRouter()


@router.get("/languages", response_model=list[LanguageOption])
async def languages(current_user: User = Depends(get_current_user)) -> list[LanguageOption]:
    return supported_languages()


@router.post("/text", response_model=TranslationTextResponse)
async def translate_text(
    payload: TranslationTextRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> TranslationTextResponse:
    engine = orchestrator.translation_engine
    result = await engine.translate(payload)
    await engine.save_history(current_user.id, payload.content, result)
    return result


@router.post("/file", response_model=TranslationTextResponse)
async def translate_file(
    file: UploadFile = File(...),
    source_language: str = Form("auto"),
    target_language: str = Form(...),
    tone: TranslationTone = Form("preserve"),
    preserve_formatting: bool = Form(True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> TranslationTextResponse:
    engine = orchestrator.translation_engine
    content, mode = await engine.extract_upload(file)
    if not content:
        raise HTTPException(status_code=422, detail="No readable text was found in the uploaded file")
    result = await engine.translate(
        TranslationTextRequest(
            content=content,
            source_language=source_language,
            target_language=target_language,
            tone=tone,
            preserve_formatting=preserve_formatting,
        )
    )
    await engine.save_history(current_user.id, content, result, mode=mode)
    return result


@router.post("/grammar", response_model=GrammarResponse)
async def grammar(
    payload: GrammarRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> GrammarResponse:
    return await orchestrator.translation_engine.grammar(payload)


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze(
    payload: AnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> AnalysisResponse:
    return await orchestrator.translation_engine.analyze(payload)


@router.post("/ocr", response_model=OCRResponse)
async def ocr(
    file: UploadFile = File(...),
    language: str = Query("auto", min_length=2, max_length=16),
    current_user: User = Depends(get_current_user),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> OCRResponse:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded image is empty")
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image must be 20 MB or smaller")
    return await orchestrator.vision_service.ocr_with_boxes(content, language=language)


@router.post("/explain", response_model=ExplainResponse)
async def explain(
    payload: ExplainRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> ExplainResponse:
    return await orchestrator.translation_engine.explain(payload)


@router.post("/learning-plan", response_model=TranslationLearningPlanResponse)
async def learning_plan(
    payload: TranslationLearningPlanRequest,
    current_user: User = Depends(get_current_user),
) -> TranslationLearningPlanResponse:
    return LanguageLearningEngine().create_learning_plan(payload)


@router.post("/flashcards", response_model=list[FlashcardResponse])
async def generate_flashcards(
    payload: FlashcardGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> list[FlashcardResponse]:
    return await orchestrator.translation_engine.generate_flashcards(payload)


@router.post("/quiz", response_model=QuizResponse)
async def generate_quiz(
    payload: QuizGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> QuizResponse:
    return await orchestrator.translation_engine.generate_quiz(payload)


@router.get("/history", response_model=list[TranslationHistoryItem])
async def history(
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> list[TranslationHistoryItem]:
    rows = await orchestrator.translation_engine.history(current_user.id, limit)
    return [
        TranslationHistoryItem(
            id=row.id,
            source_language=row.source_language,
            target_language=row.target_language,
            original_content=row.original_content,
            translated_content=row.translated_content,
            mode=row.mode,
            created_at=row.created_at.isoformat(),
            character_count=row.character_count,
        )
        for row in rows
    ]


@router.delete("/history", status_code=status.HTTP_204_NO_CONTENT)
async def clear_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> Response:
    await orchestrator.translation_engine.clear_history(current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/vocabulary", response_model=list[VocabularyItemResponse])
async def list_vocabulary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> list[VocabularyItemResponse]:
    items = await orchestrator.translation_engine.vocabulary_list(current_user.id, db)
    return [
        VocabularyItemResponse(
            id=item.id,
            word=item.word,
            translation=item.translation,
            source_language=item.source_language,
            target_language=item.target_language,
            pronunciation=item.pronunciation,
            ipa=item.ipa,
            part_of_speech=item.part_of_speech,
            synonyms=item.synonyms.splitlines(),
            antonyms=item.antonyms.splitlines(),
            examples=item.examples.splitlines(),
            difficulty=item.difficulty,
            mastery=item.mastery,
            review_count=item.review_count,
            last_reviewed=item.last_reviewed.isoformat(),
            created_at=item.created_at.isoformat(),
        )
        for item in items
    ]


@router.post("/vocabulary", response_model=VocabularyItemResponse)
async def save_vocabulary(
    word: str = Form(...),
    translation: str = Form(...),
    source_language: str = Form(...),
    target_language: str = Form(...),
    pronunciation: str = Form(""),
    ipa: str = Form(""),
    part_of_speech: str = Form(""),
    synonyms: str = Form(""),
    antonyms: str = Form(""),
    examples: str = Form(""),
    difficulty: str = Form("medium"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> VocabularyItemResponse:
    from app.models.translation import VocabularyItem

    item = VocabularyItem(
        user_id=current_user.id,
        word=word,
        translation=translation,
        source_language=source_language,
        target_language=target_language,
        pronunciation=pronunciation,
        ipa=ipa,
        part_of_speech=part_of_speech,
        synonyms=synonyms,
        antonyms=antonyms,
        examples=examples,
        difficulty=difficulty,
    )
    saved = await orchestrator.translation_engine.add_vocabulary(current_user.id, item, db)
    return VocabularyItemResponse(
        id=saved.id,
        word=saved.word,
        translation=saved.translation,
        source_language=saved.source_language,
        target_language=saved.target_language,
        pronunciation=saved.pronunciation,
        ipa=saved.ipa,
        part_of_speech=saved.part_of_speech,
        synonyms=saved.synonyms.splitlines(),
        antonyms=saved.antonyms.splitlines(),
        examples=saved.examples.splitlines(),
        difficulty=saved.difficulty,
        mastery=saved.mastery,
        review_count=saved.review_count,
        last_reviewed=saved.last_reviewed.isoformat(),
        created_at=saved.created_at.isoformat(),
    )


@router.delete("/vocabulary/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vocabulary(
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> Response:
    await orchestrator.translation_engine.remove_vocabulary(item_id, db)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/bookmarks", response_model=list[BookmarkResponse])
async def list_bookmarks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> list[BookmarkResponse]:
    items = await orchestrator.translation_engine.bookmark_list(current_user.id, db)
    return [
        BookmarkResponse(
            id=item.id,
            original_text=item.original_text,
            translated_text=item.translated_text,
            source_language=item.source_language,
            target_language=item.target_language,
            note=item.note,
            tags=item.tags,
            created_at=item.created_at.isoformat(),
        )
        for item in items
    ]


@router.post("/bookmarks", response_model=BookmarkResponse)
async def add_bookmark(
    original_text: str = Form(...),
    translated_text: str = Form(...),
    source_language: str = Form(...),
    target_language: str = Form(...),
    note: str = Form(""),
    tags: str = Form(""),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> BookmarkResponse:
    from app.models.translation import Bookmark

    bookmark = Bookmark(
        user_id=current_user.id,
        original_text=original_text,
        translated_text=translated_text,
        source_language=source_language,
        target_language=target_language,
        note=note,
        tags=tags,
    )
    saved = await orchestrator.translation_engine.add_bookmark(current_user.id, bookmark, db)
    return BookmarkResponse(
        id=saved.id,
        original_text=saved.original_text,
        translated_text=saved.translated_text,
        source_language=saved.source_language,
        target_language=saved.target_language,
        note=saved.note,
        tags=saved.tags,
        created_at=saved.created_at.isoformat(),
    )


@router.delete("/bookmarks/{bookmark_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bookmark(
    bookmark_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> Response:
    await orchestrator.translation_engine.remove_bookmark(bookmark_id, db)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/favorites", response_model=list[SavedPhraseResponse])
async def list_favorites(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> list[SavedPhraseResponse]:
    items = await orchestrator.translation_engine.saved_phrase_list(current_user.id, db)
    return [
        SavedPhraseResponse(
            id=item.id,
            phrase=item.phrase,
            translation=item.translation,
            source_language=item.source_language,
            target_language=item.target_language,
            context=item.context,
            category=item.category,
            usage_count=item.usage_count,
            created_at=item.created_at.isoformat(),
        )
        for item in items
    ]


@router.post("/favorites", response_model=SavedPhraseResponse)
async def add_favorite(
    phrase: str = Form(...),
    translation: str = Form(...),
    source_language: str = Form(...),
    target_language: str = Form(...),
    context: str = Form(""),
    category: str = Form("general"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> SavedPhraseResponse:
    from app.models.translation import SavedPhrase

    fav = SavedPhrase(
        user_id=current_user.id,
        phrase=phrase,
        translation=translation,
        source_language=source_language,
        target_language=target_language,
        context=context,
        category=category,
    )
    saved = await orchestrator.translation_engine.add_saved_phrase(current_user.id, fav, db)
    return SavedPhraseResponse(
        id=saved.id,
        phrase=saved.phrase,
        translation=saved.translation,
        source_language=saved.source_language,
        target_language=saved.target_language,
        context=saved.context,
        category=saved.category,
        usage_count=saved.usage_count,
        created_at=saved.created_at.isoformat(),
    )


@router.delete("/favorites/{phrase_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_favorite(
    phrase_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> Response:
    await orchestrator.translation_engine.remove_saved_phrase(phrase_id, db)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/quizzes/save", response_model=QuizResponse)
async def save_quiz(
    topic: str = Form(...),
    questions: str = Form(...),
    source_language: str = Form(...),
    target_language: str = Form(...),
    score: int = Form(0),
    total: int = Form(0),
    completed: bool = Form(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> QuizResponse:
    import json as json_mod

    from app.models.translation import Quiz

    parsed_questions = json_mod.loads(questions) if questions else []
    quiz = Quiz(
        user_id=current_user.id,
        topic=topic,
        source_language=source_language,
        target_language=target_language,
        questions=json_mod.dumps(parsed_questions),
        score=score,
        total=total,
        completed=completed,
        completed_at=datetime.utcnow() if completed else None,
    )
    saved = await orchestrator.translation_engine.save_quiz(current_user.id, quiz, db)
    return QuizResponse(
        id=saved.id,
        topic=saved.topic,
        source_language=saved.source_language,
        target_language=saved.target_language,
        questions=parsed_questions,
        score=saved.score,
        total=saved.total,
        completed=saved.completed,
        created_at=saved.created_at.isoformat(),
    )


@router.get("/quizzes", response_model=list[QuizResponse])
async def list_quizzes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> list[QuizResponse]:
    import json as json_mod

    items = await orchestrator.translation_engine.list_quizzes(current_user.id, db)
    result = []
    for item in items:
        questions = json_mod.loads(item.questions) if item.questions else []
        result.append(
            QuizResponse(
                id=item.id,
                topic=item.topic,
                source_language=item.source_language,
                target_language=item.target_language,
                questions=questions,
                score=item.score,
                total=item.total,
                completed=item.completed,
                created_at=item.created_at.isoformat(),
            )
        )
    return result
