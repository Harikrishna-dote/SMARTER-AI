INSERT INTO agent_configs (id, user_id, name, description, system_prompt, tools, is_public, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    NULL,
    'Research Agent',
    'General-purpose local research assistant.',
    'You are a careful research agent. Use local context and cite uncertainty.',
    '["current_time"]',
    TRUE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO NOTHING;

