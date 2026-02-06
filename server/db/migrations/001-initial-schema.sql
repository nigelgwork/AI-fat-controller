-- Settings (key/value store)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  has_beads INTEGER NOT NULL DEFAULT 0,
  has_claude INTEGER NOT NULL DEFAULT 0,
  last_modified TEXT,
  git_remote TEXT,
  git_branch TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  project_id TEXT,
  project_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  last_attempt_at TEXT,
  next_retry_at TEXT,
  blocked_by TEXT, -- JSON array of task IDs
  scheduled_at TEXT
);

-- Controller state
CREATE TABLE IF NOT EXISTS controller_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT NOT NULL DEFAULT 'idle',
  current_task_id TEXT,
  current_action TEXT,
  started_at TEXT,
  processed_count INTEGER NOT NULL DEFAULT 0,
  approved_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  current_progress TEXT, -- JSON
  conversation_session_id TEXT,
  token_usage TEXT, -- JSON
  usage_limit_config TEXT, -- JSON
  daily_token_usage TEXT, -- JSON
  usage_limit_status TEXT NOT NULL DEFAULT 'ok',
  paused_due_to_limit INTEGER NOT NULL DEFAULT 0
);

-- Approval requests
CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  task_title TEXT NOT NULL,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT
);

-- Action logs
CREATE TABLE IF NOT EXISTS action_logs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  task_title TEXT NOT NULL,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  auto_approved INTEGER NOT NULL DEFAULT 0,
  result TEXT NOT NULL,
  output TEXT,
  duration INTEGER NOT NULL DEFAULT 0,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Conversation sessions
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
  entry_count INTEGER NOT NULL DEFAULT 0,
  total_tokens_input INTEGER NOT NULL DEFAULT 0,
  total_tokens_output INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  claude_session_id TEXT,
  claude_session_path TEXT,
  is_resumable INTEGER NOT NULL DEFAULT 0
);

-- Conversation entries
CREATE TABLE IF NOT EXISTS conversation_entries (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  project_id TEXT,
  task_id TEXT,
  tokens_input INTEGER,
  tokens_output INTEGER
);
CREATE INDEX IF NOT EXISTS idx_conversation_entries_session ON conversation_entries(session_id);

-- Activity logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  category TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT, -- JSON
  task_id TEXT,
  project_id TEXT,
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost_usd REAL,
  duration INTEGER
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_logs_category ON activity_logs(category);

-- Token history
CREATE TABLE IF NOT EXISTS token_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  hour INTEGER NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  UNIQUE(date, hour)
);

-- Clawdbot messages
CREATE TABLE IF NOT EXISTS clawdbot_messages (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  intent TEXT, -- JSON
  used_claude_code INTEGER NOT NULL DEFAULT 0
);

-- Clawdbot personalities
CREATE TABLE IF NOT EXISTS clawdbot_personalities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  traits TEXT NOT NULL, -- JSON
  custom_instructions TEXT,
  greeting TEXT,
  signoff TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ntfy config
CREATE TABLE IF NOT EXISTS ntfy_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  config TEXT NOT NULL -- JSON
);

-- ntfy pending questions
CREATE TABLE IF NOT EXISTS ntfy_pending_questions (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  options TEXT, -- JSON array
  free_text INTEGER NOT NULL DEFAULT 1,
  task_id TEXT NOT NULL,
  task_title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  answer TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- Project briefs
CREATE TABLE IF NOT EXISTS project_briefs (
  project_id TEXT PRIMARY KEY,
  brief TEXT NOT NULL, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Deep dive plans
CREATE TABLE IF NOT EXISTS deep_dive_plans (
  project_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- GUI test scenarios
CREATE TABLE IF NOT EXISTS gui_test_scenarios (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  application TEXT,
  steps TEXT NOT NULL, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- GUI test results
CREATE TABLE IF NOT EXISTS gui_test_results (
  id TEXT PRIMARY KEY,
  scenario_id TEXT NOT NULL REFERENCES gui_test_scenarios(id) ON DELETE CASCADE,
  result TEXT NOT NULL, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- MCP configs
CREATE TABLE IF NOT EXISTS mcp_configs (
  name TEXT PRIMARY KEY,
  config TEXT NOT NULL -- JSON
);

-- Execution sessions
CREATE TABLE IF NOT EXISTS execution_sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  task_title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'starting',
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  last_activity TEXT NOT NULL DEFAULT (datetime('now')),
  tool_calls INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL,
  error TEXT,
  result TEXT
);

-- Execution session logs
CREATE TABLE IF NOT EXISTS execution_session_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES execution_sessions(id) ON DELETE CASCADE,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  details TEXT -- JSON
);
CREATE INDEX IF NOT EXISTS idx_execution_session_logs_session ON execution_session_logs(session_id);

-- Auto-approval rules
CREATE TABLE IF NOT EXISTS auto_approval_rules (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  config TEXT NOT NULL -- JSON
);

-- Insert default controller state
INSERT OR IGNORE INTO controller_state (id, status, token_usage, usage_limit_config, daily_token_usage)
VALUES (1, 'idle',
  '{"inputTokens":0,"outputTokens":0,"limit":200000,"resetAt":"' || datetime('now', '+1 hour') || '"}',
  '{"maxTokensPerHour":200000,"maxTokensPerDay":1000000,"pauseThreshold":0.8,"warningThreshold":0.6,"autoResumeOnReset":true}',
  '{"input":0,"output":0,"date":"' || date('now') || '"}'
);
