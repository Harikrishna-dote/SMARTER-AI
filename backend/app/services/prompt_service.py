import json
import os
from pathlib import Path
from app.core.config import get_settings

# Assuming the template file is in backend/app/data/prompt_templates/subjects.json
# Adjust path if necessary
TEMPLATE_DIR = Path(__file__).parent.parent / "data" / "prompt_templates"
SUBJECT_TEMPLATES_FILE = TEMPLATE_DIR / "subjects.json"

def load_subject_templates():
    if not SUBJECT_TEMPLATES_FILE.exists():
        return {}
    with open(SUBJECT_TEMPLATES_FILE, "r") as f:
        return json.load(f)

def get_prompt_for_subject(subject: str):
    templates = load_subject_templates()
    subject_key = subject.lower()
    
    # Fallback to default if subject not found
    template = templates.get(subject_key, templates.get("default", {}))
    
    base_prompt = template.get("base_prompt", "")
    formatting_rules = "\n".join([f"- {rule}" for rule in template.get("formatting_rules", [])])
    
    return f"{base_prompt}\n\nFormatting Rules:\n{formatting_rules}"

if __name__ == "__main__":
    # Quick test
    print(get_prompt_for_subject("math"))
    print("\n---\n")
    print(get_prompt_for_subject("history"))
