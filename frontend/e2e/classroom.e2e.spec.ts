import { expect, test, type Page, type Route } from '@playwright/test';

const AUDIO_CHUNK = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=';

function learningClass() {
  return {
    id: 'class-1',
    title: "Newton's laws class",
    goal: "Newton's laws",
    subject: 'Physics',
    level: 'Beginner',
    language: 'te',
    status: 'ready',
    syllabus_source: 'smart',
    syllabus_filename: null,
    syllabus_text: '',
    syllabus_topics: [],
    curriculum: ["Newton's first law", "Newton's second law"],
    comparison: { counts: {}, matches: [] },
    prepared_content: {
      curriculum_tree: {
        subject: 'Physics',
        modules: [{
          id: 'module-1',
          title: 'Foundations',
          chapters: [{
            id: 'chapter-1',
            title: "Newton's second law",
            topics: [{ id: 'topic-1', title: "Newton's second law", subtopics: ['force', 'mass', 'acceleration'] }],
          }],
        }],
      },
      board_scenes: [{
        id: 'scene-1',
        order: 0,
        topic: "Newton's second law",
        visual_type: 'formula',
        title: "Newton's second law",
        body: 'Acceleration is force divided by mass: a = F / m.',
        language: 'te',
        real_world_example: 'Push a school bag gently and then harder to compare the change in motion.',
        animation: { kind: 'motion', labels: ['Cause', 'Change', 'Result'], duration_ms: 500 },
        interactions: [
          { type: 'range', id: 'force', label: 'Force', min: 1, max: 60, unit: 'N' },
          { type: 'range', id: 'mass', label: 'Mass', min: 1, max: 20, unit: 'kg' },
        ],
        events: [{ type: 'highlight', target: 'title', at: 0 }],
      }, {
        id: 'scene-2',
        order: 1,
        topic: 'Momentum practice',
        visual_type: 'diagram',
        title: 'Momentum practice',
        body: 'Use the relationship between mass and velocity to compare momentum.',
        language: 'te',
        real_world_example: 'Compare a rolling ball and a moving school bag.',
        animation: { kind: 'concept_flow', labels: ['Idea', 'Example', 'Practice'], duration_ms: 500 },
        interactions: [{ type: 'stepper', id: 'teaching_step', label: 'Teaching step', min: 0, max: 2 }],
        events: [{ type: 'highlight', target: 'title', at: 0 }],
      }],
      narration: [],
      practice: [{ id: 'practice-1', topic: "Newton's second law", prompt: 'Explain how force changes acceleration.' }],
      notes: { summary: 'Force, mass, and acceleration are related.', key_points: ['a = F / m'], generated: true },
      quiz: { questions: [], topic: "Newton's second law" },
    },
    preparation: [
      { id: 'goal', label: 'Understanding your learning goal', status: 'complete' },
      { id: 'curriculum', label: 'Building your curriculum', status: 'complete' },
      { id: 'comparison', label: 'Checking syllabus alignment', status: 'complete' },
      { id: 'lesson', label: 'Preparing the first lesson', status: 'complete' },
      { id: 'board', label: 'Compiling interactive board scenes', status: 'complete' },
      { id: 'practice', label: 'Preparing practice and notes', status: 'complete' },
    ],
      checkpoint: {
        current_lesson: 0,
        scene_id: 'scene-1',
        session_id: 'session-1',
      stage: 'Newton\'s second law',
      paused: false,
      mastery: {},
    },
    content_hash: 'hash-1',
    current_lesson: 0,
    last_error: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

async function installClassroomApi(page: Page) {
  const state = {
    classRecord: learningClass(),
    startSessionIds: [] as string[],
    checkpointPayloads: [] as Array<Record<string, unknown>>,
    transcribeCalls: 0,
    synthesizeCalls: 0,
    synthesizedTexts: [] as string[],
  };

  await page.addInitScript(() => {
    window.localStorage.setItem('smarterai.token', 'e2e-token');
    class FakeMediaRecorder {
      static isTypeSupported() { return true; }
      state = 'inactive';
      mimeType = 'audio/webm';
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      constructor(_stream: MediaStream) {}
      start() { this.state = 'recording'; }
      stop() {
        this.state = 'inactive';
        this.ondataavailable?.({ data: new Blob(['test audio'], { type: this.mimeType }) });
        this.onstop?.();
      }
    }
    Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: FakeMediaRecorder });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) },
    });
  });

  await page.route('**/api/v1/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/\/+$/, '');
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });

    if (path === '/api/v1/auth/me' && request.method() === 'GET') {
      return json({ id: 'student-1', email: 'student@example.com', full_name: 'Test Student', is_admin: false });
    }
    if (path === '/api/v1/chats/conversations' && request.method() === 'GET') return json([]);
    if (path === '/api/v1/classroom/classes' && request.method() === 'GET') return json([]);
    if (path === '/api/v1/classroom/classes' && request.method() === 'POST') return json(state.classRecord, 201);
    if (path === '/api/v1/classroom/classes/class-1/start' && request.method() === 'POST') {
      state.startSessionIds.push('session-1');
      return json({
        learning_class: state.classRecord,
        session: {
          session_id: 'session-1',
          content: 'ఇప్పుడు బలాన్ని మరియు ద్రవ్యరాశిని చూద్దాం.',
          paused: state.classRecord.checkpoint.paused,
        },
      });
    }
    if (path === '/api/v1/classroom/classes/class-1/checkpoint' && request.method() === 'POST') {
      const payload = request.postDataJSON() as Record<string, unknown>;
      state.checkpointPayloads.push(payload);
      state.classRecord = {
        ...state.classRecord,
        checkpoint: { ...state.classRecord.checkpoint, ...payload },
      };
      return json(state.classRecord);
    }
    if (path === '/api/v1/classroom/autonomous/pause' && request.method() === 'POST') return json({ paused: true });
    if (path === '/api/v1/classroom/autonomous/resume' && request.method() === 'POST') return json({ resumed: true });
    if (path === '/api/v1/classroom/autonomous/continue' && request.method() === 'POST') {
      return json({ content: 'This is the tutor answer.' });
    }
    if (path === '/api/v1/voice/transcribe' && request.method() === 'POST') {
      state.transcribeCalls += 1;
      return json({ text: 'బలాన్ని నెమ్మదిగా వివరించండి', language: 'te' });
    }
    if (path === '/api/v1/voice/synthesize/stream' && request.method() === 'POST') {
      state.synthesizeCalls += 1;
      const body = request.postDataJSON() as { text?: string };
      if (body.text) state.synthesizedTexts.push(body.text);
      return route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/x-ndjson' },
        body: `${JSON.stringify({ type: 'audio', data: AUDIO_CHUNK, mime_type: 'audio/wav' })}\n`,
      });
    }
    return json({});
  });

  return state;
}

test('prepares a Telugu class, synchronizes visuals, checkpoints pause/resume, and resumes the same session', async ({ page }) => {
  const state = await installClassroomApi(page);

  await page.goto('/classroom');
  await expect(page.getByText('Create your classroom')).toBeVisible();
  await page.locator('#learning-goal').fill("Newton's laws");
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /Telugu-first explanations/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Prepare my class' }).click();
  await expect(page.getByText('Class ready')).toBeVisible();

  await page.getByRole('button', { name: 'Enter classroom' }).click();
  await expect(page.getByText('Dynamic concept visualization')).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Simulation force' })).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Simulation mass' })).toBeVisible();
  await expect.poll(() => state.synthesizeCalls).toBeGreaterThan(0);
  await page.getByRole('slider', { name: 'Classroom voice speed' }).fill('1.2');
  const nextConcept = page.getByRole('button', { name: 'Next concept' });
  await nextConcept.click();
  await expect(page.getByText('Complete the understanding checkpoint before moving to the next concept.')).toBeVisible();
  await page.getByRole('button', { name: 'I understand this concept' }).click();
  await expect.poll(() => state.checkpointPayloads.some((payload) => (payload.mastery as Record<string, unknown>)?.["Newton's second law"] === 100)).toBe(true);
  await nextConcept.click();
  await expect(page.getByRole('heading', { name: 'Momentum practice' })).toBeVisible();

  const pauseButton = page.getByRole('button', { name: 'Pause class' });
  await expect(pauseButton).toBeEnabled();
  await pauseButton.click();
  await expect.poll(() => state.checkpointPayloads.some((payload) => payload.paused === true)).toBe(true);
  const pausedCheckpoint = state.checkpointPayloads.find((payload) => payload.paused === true);
  expect(pausedCheckpoint?.animation_time).toBe(0);
  expect((pausedCheckpoint?.voice_settings as Record<string, unknown>)?.rate).toBe(1.2);
  await expect(page.getByRole('button', { name: 'Resume class' })).toBeVisible();

  await page.getByRole('button', { name: 'Resume class' }).click();
  await expect(page.getByRole('button', { name: 'Pause class' })).toBeVisible();
  await expect.poll(() => state.checkpointPayloads.some((payload) => payload.paused === false)).toBe(true);

  await page.getByRole('button', { name: 'Ask by voice' }).first().click();
  await expect(page.getByRole('button', { name: 'Stop listening' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Stop listening' }).first().click();
  await expect.poll(() => state.transcribeCalls).toBe(1);
  await expect.poll(() => state.synthesizedTexts.some((text) => text.includes('This is the tutor answer.'))).toBe(true);

  await page.getByRole('button', { name: 'Save & leave' }).click();
  await expect(page.getByText('Class ready')).toBeVisible();
  await page.getByRole('button', { name: 'Enter classroom' }).click();
  await expect(page.getByText('Dynamic concept visualization')).toBeVisible();
  expect(state.startSessionIds).toEqual(['session-1', 'session-1']);
  expect(state.checkpointPayloads.at(-1)?.voice_settings).toBeTruthy();
});
