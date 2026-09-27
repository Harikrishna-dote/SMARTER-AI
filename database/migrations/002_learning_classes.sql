-- Durable class-builder state and declarative pre-class assets.
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
