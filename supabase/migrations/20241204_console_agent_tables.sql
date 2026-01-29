-- Migration for Console Agent System
-- Created: 2024-12-04
-- Purpose: Database schema for ingredient control and expense management

-- Create ingredients table
CREATE TABLE IF NOT EXISTS ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  price DECIMAL(10,2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT true,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  category VARCHAR(50) NOT NULL,
  expense_date DATE NOT NULL,
  receipt_url TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create agent activity logs table for tracking agent actions
CREATE TABLE IF NOT EXISTS agent_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- 'ingredient_disable', 'expense_register', etc.
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ingredients_user_id ON ingredients(user_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients(category);
CREATE INDEX IF NOT EXISTS idx_ingredients_active ON ingredients(is_active);
CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients(name);

CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_logs_user_id ON agent_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_action_type ON agent_activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_agent_logs_created_at ON agent_activity_logs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_activity_logs ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT ON ingredients TO anon;
GRANT SELECT ON expenses TO anon;
GRANT SELECT ON agent_activity_logs TO anon;

GRANT ALL PRIVILEGES ON ingredients TO authenticated;
GRANT ALL PRIVILEGES ON expenses TO authenticated;
GRANT ALL PRIVILEGES ON agent_activity_logs TO authenticated;

-- RLS Policies: Users can only see their own data
CREATE POLICY "Users see own ingredients" ON ingredients
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see own expenses" ON expenses
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see own agent logs" ON agent_activity_logs
  FOR ALL USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for ingredients updated_at
CREATE TRIGGER update_ingredients_updated_at
  BEFORE UPDATE ON ingredients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default expense categories
INSERT INTO ingredients (name, category, unit, price, is_active, user_id) VALUES
  ('Carne de Sol', 'Proteínas', 'kg', 45.00, true, (SELECT id FROM auth.users LIMIT 1)),
  ('Queijo Coalho', 'Laticínios', 'kg', 32.00, true, (SELECT id FROM auth.users LIMIT 1)),
  ('Tomate', 'Verduras', 'kg', 8.50, true, (SELECT id FROM auth.users LIMIT 1)),
  ('Cebola', 'Verduras', 'kg', 6.00, true, (SELECT id FROM auth.users LIMIT 1)),
  ('Farinha de Mandioca', 'Grãos', 'kg', 4.20, true, (SELECT id FROM auth.users LIMIT 1))
ON CONFLICT DO NOTHING;