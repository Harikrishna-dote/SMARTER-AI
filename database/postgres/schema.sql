CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(320) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    role VARCHAR(32) NOT NULL DEFAULT 'student',
    xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    streak INTEGER NOT NULL DEFAULT 0,
    last_active_date DATE,
    career_goals JSONB NOT NULL DEFAULT '[]',
    skills JSONB NOT NULL DEFAULT '[]',
    interests JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(180) NOT NULL DEFAULT 'New conversation',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(36) PRIMARY KEY,
    conversation_id VARCHAR(36) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS memory_items (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key VARCHAR(120) NOT NULL,
    value TEXT NOT NULL,
    source VARCHAR(80) NOT NULL DEFAULT 'manual',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(120) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    extracted_text TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_configs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    system_prompt TEXT NOT NULL,
    tools JSONB NOT NULL DEFAULT '[]',
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_settings (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(20) NOT NULL DEFAULT 'system',
    model VARCHAR(80) NOT NULL DEFAULT 'qwen3:8b',
    voice_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    memory_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS ix_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS ix_memory_user_id ON memory_items(user_id);
CREATE INDEX IF NOT EXISTS ix_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS ix_agent_user_id ON agent_configs(user_id);

CREATE TABLE IF NOT EXISTS translation_history (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_language VARCHAR(16) NOT NULL,
    target_language VARCHAR(16) NOT NULL,
    original_content TEXT NOT NULL,
    translated_content TEXT NOT NULL,
    mode VARCHAR(16) NOT NULL DEFAULT 'text',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    character_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ix_translation_history_user_id ON translation_history(user_id);
CREATE INDEX IF NOT EXISTS ix_translation_history_user_mode ON translation_history(user_id, mode);
CREATE INDEX IF NOT EXISTS ix_translation_history_user_languages ON translation_history(user_id, source_language, target_language);

CREATE TABLE IF NOT EXISTS learning_classes (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(180) NOT NULL,
    goal VARCHAR(500) NOT NULL,
    subject VARCHAR(160) NOT NULL DEFAULT 'General',
    level VARCHAR(80) NOT NULL DEFAULT 'Adaptive',
    language VARCHAR(24) NOT NULL DEFAULT 'en',
    status VARCHAR(32) NOT NULL DEFAULT 'preparing',
    syllabus_source VARCHAR(32) NOT NULL DEFAULT 'smart',
    syllabus_filename VARCHAR(255),
    syllabus_text TEXT NOT NULL DEFAULT '',
    syllabus_topics JSONB NOT NULL DEFAULT '[]',
    curriculum JSONB NOT NULL DEFAULT '[]',
    comparison JSONB NOT NULL DEFAULT '{}',
    prepared_content JSONB NOT NULL DEFAULT '{}',
    preparation JSONB NOT NULL DEFAULT '[]',
    checkpoint JSONB NOT NULL DEFAULT '{}',
    content_hash VARCHAR(64) NOT NULL DEFAULT '',
    current_lesson INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_learning_classes_user_id ON learning_classes(user_id);
CREATE INDEX IF NOT EXISTS ix_learning_classes_status ON learning_classes(status);

CREATE TABLE IF NOT EXISTS study_groups (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(180) NOT NULL,
    description TEXT,
    subject VARCHAR(120),
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    max_members INTEGER NOT NULL DEFAULT 20,
    owner_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS study_group_members (
    id VARCHAR(36) PRIMARY KEY,
    group_id VARCHAR(36) NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL DEFAULT 'member',
    xp_contributed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS group_discussions (
    id VARCHAR(36) PRIMARY KEY,
    group_id VARCHAR(36) NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_id VARCHAR(36) REFERENCES group_discussions(id) ON DELETE CASCADE,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shared_notes (
    id VARCHAR(36) PRIMARY KEY,
    group_id VARCHAR(36) NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(180) NOT NULL,
    content TEXT NOT NULL,
    tags JSONB NOT NULL DEFAULT '[]',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(180) NOT NULL,
    description TEXT NOT NULL,
    subject VARCHAR(120),
    difficulty VARCHAR(32) NOT NULL DEFAULT 'intermediate',
    status VARCHAR(32) NOT NULL DEFAULT 'in_progress',
    milestones JSONB NOT NULL DEFAULT '[]',
    progress INTEGER NOT NULL DEFAULT 0,
    career_goal VARCHAR(180),
    feedback TEXT,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portfolio_items (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(180) NOT NULL,
    description TEXT NOT NULL,
    item_type VARCHAR(32) NOT NULL DEFAULT 'project',
    tags JSONB NOT NULL DEFAULT '[]',
    media_urls JSONB NOT NULL DEFAULT '[]',
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    certificate_id VARCHAR(36),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS certificates (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(180) NOT NULL,
    issuer VARCHAR(180) NOT NULL,
    issue_date TIMESTAMP NOT NULL,
    expiry_date TIMESTAMP,
    credential_id VARCHAR(180),
    verification_url VARCHAR(255),
    skills JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL,
    title VARCHAR(180) NOT NULL,
    body TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS calendar_events (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(180) NOT NULL,
    description TEXT,
    event_type VARCHAR(32) NOT NULL DEFAULT 'study',
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    reminder_minutes INTEGER NOT NULL DEFAULT 15,
    related_type VARCHAR(32),
    related_id VARCHAR(36),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_badges (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id VARCHAR(64) NOT NULL,
    name VARCHAR(120) NOT NULL,
    description TEXT NOT NULL,
    icon VARCHAR(64),
    unlocked_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS interview_sessions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interview_type VARCHAR(32) NOT NULL,
    role VARCHAR(120) NOT NULL,
    questions JSONB NOT NULL DEFAULT '[]',
    answers JSONB NOT NULL DEFAULT '[]',
    feedback JSONB NOT NULL DEFAULT '{}',
    score INTEGER NOT NULL DEFAULT 0,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coding_sessions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    language VARCHAR(32) NOT NULL,
    problem TEXT NOT NULL,
    code TEXT NOT NULL,
    output TEXT,
    errors JSONB NOT NULL DEFAULT '[]',
    hints_used INTEGER NOT NULL DEFAULT 0,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    execution_time INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_study_groups_owner_id ON study_groups(owner_id);
CREATE INDEX IF NOT EXISTS ix_study_group_members_group_id ON study_group_members(group_id);
CREATE INDEX IF NOT EXISTS ix_study_group_members_user_id ON study_group_members(user_id);
CREATE INDEX IF NOT EXISTS ix_group_discussions_group_id ON group_discussions(group_id);
CREATE INDEX IF NOT EXISTS ix_group_discussions_user_id ON group_discussions(user_id);
CREATE INDEX IF NOT EXISTS ix_shared_notes_group_id ON shared_notes(group_id);
CREATE INDEX IF NOT EXISTS ix_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS ix_portfolio_user_id ON portfolio_items(user_id);
CREATE INDEX IF NOT EXISTS ix_certificates_user_id ON certificates(user_id);
CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS ix_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS ix_calendar_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS ix_calendar_start_time ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS ix_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS ix_interview_user_id ON interview_sessions(user_id);
CREATE INDEX IF NOT EXISTS ix_coding_user_id ON coding_sessions(user_id);

CREATE TABLE IF NOT EXISTS whiteboards (
    id VARCHAR(36) PRIMARY KEY,
    group_id VARCHAR(36) REFERENCES study_groups(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(180) NOT NULL,
    elements JSONB NOT NULL DEFAULT '[]',
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS forum_posts (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(180) NOT NULL,
    content TEXT NOT NULL,
    topic VARCHAR(120),
    tags JSONB NOT NULL DEFAULT '[]',
    views INTEGER NOT NULL DEFAULT 0,
    upvotes INTEGER NOT NULL DEFAULT 0,
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS forum_comments (
    id VARCHAR(36) PRIMARY KEY,
    post_id VARCHAR(36) NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_id VARCHAR(36) REFERENCES forum_comments(id) ON DELETE CASCADE,
    is_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS privacy_settings (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profile_visibility VARCHAR(32) NOT NULL DEFAULT 'friends',
    show_xp BOOLEAN NOT NULL DEFAULT TRUE,
    show_badges BOOLEAN NOT NULL DEFAULT TRUE,
    show_progress BOOLEAN NOT NULL DEFAULT TRUE,
    allow_study_group_invites BOOLEAN NOT NULL DEFAULT TRUE,
    allow_mentor_messages BOOLEAN NOT NULL DEFAULT TRUE,
    data_sharing VARCHAR(32) NOT NULL DEFAULT 'essential',
    allow_analytics BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_whiteboards_user_id ON whiteboards(user_id);
CREATE INDEX IF NOT EXISTS ix_whiteboards_group_id ON whiteboards(group_id);
CREATE INDEX IF NOT EXISTS ix_forum_posts_user_id ON forum_posts(user_id);
CREATE INDEX IF NOT EXISTS ix_forum_posts_topic ON forum_posts(topic);
CREATE INDEX IF NOT EXISTS ix_forum_comments_post_id ON forum_comments(post_id);
CREATE INDEX IF NOT EXISTS ix_forum_comments_user_id ON forum_comments(user_id);
CREATE INDEX IF NOT EXISTS ix_privacy_user_id ON privacy_settings(user_id);

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    action VARCHAR(120) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id VARCHAR(36),
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_id VARCHAR(36),
    status VARCHAR(32) NOT NULL,
    details JSONB,
    duration_ms INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS security_events (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    event_type VARCHAR(64) NOT NULL,
    severity VARCHAR(32) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS ix_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS ix_audit_logs_status ON audit_logs(status);
CREATE INDEX IF NOT EXISTS ix_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS ix_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS ix_security_events_severity ON security_events(severity);
