CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    author VARCHAR(100),
    dynasty VARCHAR(50),
    description TEXT,
    total_pages INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE book_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    original_image_url VARCHAR(500),
    corrected_image_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'uploaded',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(book_id, page_number)
);

CREATE TABLE text_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id UUID REFERENCES book_pages(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    bounding_box JSONB,
    confidence_score FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE annotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    line_id UUID REFERENCES text_lines(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    punctuation TEXT,
    annotated_by UUID REFERENCES users(id),
    annotated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    version INTEGER DEFAULT 1,
    is_latest BOOLEAN DEFAULT true,
    lock_owner UUID REFERENCES users(id),
    lock_acquired_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE annotation_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    annotation_id UUID REFERENCES annotations(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    punctuation TEXT,
    version INTEGER NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    change_note TEXT
);

CREATE TABLE collaborations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    permission_level VARCHAR(20) NOT NULL DEFAULT 'viewer',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(book_id, user_id)
);

CREATE TABLE collaboration_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id UUID REFERENCES book_pages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_book_pages_book_id ON book_pages(book_id);
CREATE INDEX idx_text_lines_page_id ON text_lines(page_id);
CREATE INDEX idx_annotations_line_id ON annotations(line_id);
CREATE INDEX idx_annotation_versions_annotation_id ON annotation_versions(annotation_id);
CREATE INDEX idx_collaborations_book_id ON collaborations(book_id);
CREATE INDEX idx_collaboration_sessions_page_id ON collaboration_sessions(page_id);

CREATE TABLE variant_chars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    variant_char VARCHAR(10) NOT NULL,
    standard_char VARCHAR(10) NOT NULL,
    similarity_score FLOAT DEFAULT 1.0,
    source VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE annotation_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    permission_level VARCHAR(20) NOT NULL DEFAULT 'viewer',
    granted_by UUID REFERENCES users(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(book_id, user_id)
);

CREATE TABLE punctuation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_pattern TEXT NOT NULL,
    punctuation_type VARCHAR(10) NOT NULL,
    usage_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    confidence_score FLOAT DEFAULT 0.5,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE model_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    annotation_id UUID REFERENCES annotations(id) ON DELETE CASCADE,
    original_content TEXT,
    corrected_content TEXT,
    feedback_type VARCHAR(20),
    submitted_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (username, email, password_hash, role) VALUES 
('admin', 'admin@example.com', '$2b$10$EjKp/Rp1Q6z0V9z5Y7x8W.u5h2d3f4g5h6j7k8l9m0n1b2v3c4x5', 'admin'),
('reviewer', 'reviewer@example.com', '$2b$10$EjKp/Rp1Q6z0V9z5Y7x8W.u5h2d3f4g5h6j7k8l9m0n1b2v3c4x5', 'reviewer'),
('annotator', 'annotator@example.com', '$2b$10$EjKp/Rp1Q6z0V9z5Y7x8W.u5h2d3f4g5h6j7k8l9m0n1b2v3c4x5', 'annotator'),
('viewer', 'viewer@example.com', '$2b$10$EjKp/Rp1Q6z0V9z5Y7x8W.u5h2d3f4g5h6j7k8l9m0n1b2v3c4x5', 'viewer');

INSERT INTO variant_chars (variant_char, standard_char, similarity_score, source) VALUES
('無', '无', 1.0, '康熙字典'),
('萬', '万', 1.0, '康熙字典'),
('禮', '礼', 1.0, '康熙字典'),
('體', '体', 1.0, '康熙字典'),
('漢', '汉', 1.0, '康熙字典'),
('學', '学', 1.0, '康熙字典'),
('發', '发', 1.0, '康熙字典'),
('國', '国', 1.0, '康熙字典'),
('會', '会', 1.0, '康熙字典'),
('來', '来', 1.0, '康熙字典'),
('後', '后', 1.0, '康熙字典'),
('裏', '里', 1.0, '康熙字典'),
('裏', '里', 1.0, '异体字表'),
('後', '后', 1.0, '异体字表'),
('云', '云', 0.95, '通假字'),
('說', '说', 1.0, '康熙字典'),
('謂', '谓', 1.0, '康熙字典'),
('爲', '为', 1.0, '康熙字典'),
('與', '与', 1.0, '康熙字典'),
('從', '从', 1.0, '康熙字典'),
('見', '见', 1.0, '康熙字典'),
('問', '问', 1.0, '康熙字典'),
('聞', '闻', 1.0, '康熙字典'),
('對', '对', 1.0, '康熙字典'),
('將', '将', 1.0, '康熙字典'),
('時', '时', 1.0, '康熙字典');

INSERT INTO punctuation_rules (rule_pattern, punctuation_type, confidence_score) VALUES
('.*[之乎者也矣焉哉]$', '。', 0.95),
('.*[曰云道]$', '：', 0.90),
('.*[而则故是然但虽且及与以].*', '，', 0.70),
('.*[何胡焉奚安岂孰乌恶乎].*', '？', 0.75),
('^[盖夫盖维若夫].*', '，', 0.60),
('.*[矣哉耶耶乎]$', '！', 0.65),
('.*[也矣]$', '。', 0.80),
('.*[也]$', '，', 0.50);

INSERT INTO annotation_permissions (book_id, user_id, permission_level, granted_by)
SELECT b.id, u.id, 'owner', u.id FROM books b, users u WHERE u.username = 'admin';
