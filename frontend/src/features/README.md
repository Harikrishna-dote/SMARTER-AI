# Frontend Feature Modules

Future frontend work should move page-specific logic into feature modules.

- `classroom`: tutor state, classroom panels, whiteboard, voice controls, lesson timeline, notes, quiz, and homework.
- `chat`: conversation streams, attachments, tutor profile controls, and chat history.
- `translator`: OCR, word analysis, sentence analysis, and learning panels.
- `ui`: design-system policy, responsive experience planning, onboarding, dashboard, accessibility, and motion rules.
- `voice`: speech recognition, synthesis, voice status, and language capability checks.
- `vision`: OCR, media context, and visual explanation tools.
- `admin`: operational dashboards, audit views, and platform settings.

Pages should compose feature modules. They should not own large business workflows.
