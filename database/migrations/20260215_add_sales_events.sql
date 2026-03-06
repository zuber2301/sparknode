-- Modify existing sales_events table for gamified sales events

-- add new columns required by the sales marketing gamification spec
ALTER TABLE sales_events ADD COLUMN IF NOT EXISTS dept_id UUID REFERENCES departments(id);
ALTER TABLE sales_events ADD COLUMN IF NOT EXISTS eligible_dept_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE sales_events ADD COLUMN IF NOT EXISTS eligible_region_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE sales_events ADD COLUMN IF NOT EXISTS invited_user_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE sales_events ADD COLUMN IF NOT EXISTS invited_dept_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE sales_events ADD COLUMN IF NOT EXISTS goal_metric TEXT;
ALTER TABLE sales_events ADD COLUMN IF NOT EXISTS goal_value INTEGER;
ALTER TABLE sales_events ADD COLUMN IF NOT EXISTS reward_points INTEGER;
ALTER TABLE sales_events ADD COLUMN IF NOT EXISTS total_budget_cap INTEGER;
ALTER TABLE sales_events ADD COLUMN IF NOT EXISTS distributed_so_far INTEGER DEFAULT 0;

-- create event_progress table to record individual user progress
CREATE TABLE IF NOT EXISTS event_progress (
    event_id UUID NOT NULL REFERENCES sales_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    current_value INTEGER DEFAULT 0,
    is_rewarded BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (event_id, user_id)
);
