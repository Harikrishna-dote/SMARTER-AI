# Project Quality Assurance Plan

## 1. Automated Testing
- **Backend:** Expand `pytest` coverage for `classroom_service` and `voice_service`.
- **Frontend:** Implement `vitest` for component testing of `MathRenderer`, `ScienceLab`, and `AILab`.

## 2. Integration Testing
- Test the full lesson loop (generation -> state persistence -> quiz/homework generation -> evaluation).
- Validate Telugu voice fallback mechanisms when Piper fails or is unavailable.

## 3. Manual Validation
- Conduct "Tutor Persona" testing to ensure consistent "mentor/friend" tone.
- Validate rendering of complex mathematical LaTeX in `MathRenderer`.
