import asyncio
import os
import sys
from pathlib import Path

# Add backend to path
ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT / "backend"))
os.environ["AUTO_CREATE_TABLES"] = "false"

from app.services.translation_engine import TranslationEngine, LanguageCode, ToneStyle

async def main():
    try:
        # Initialize
        engine = TranslationEngine()
        
        # Request
        content = "Hello, how are you today?"
        print(f"Translating: '{content}'")
        
        # Explicitly setting target to TE
        result = await engine.translate_text(
            content=content,
            source_lang=LanguageCode.EN,
            target_lang=LanguageCode.TE,
            tone=ToneStyle.CONVERSATIONAL
        )
        
        print("\n--- Result ---")
        print(f"Original: {result.original_content}")
        print(f"Translated: {result.translated_content}")
        print(f"Target Language Code: {result.target_language}")
        print("Success!")
        
    except Exception as e:
        print(f"\n--- Error ---")
        print(f"Live translation failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
