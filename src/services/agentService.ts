import { supabase } from '@/integrations/supabase/client';

export interface AgentCommandResult {
  success: boolean;
  message: string;
  metadata?: any;
}

export interface Ingredient {
  id: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  is_active: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  expense_date: string;
  receipt_url?: string;
  user_id: string;
  created_at: string;
}

// Expense categories for validation
const EXPENSE_CATEGORIES = [
  'alimentação',
  'transporte', 
  'insumos',
  'outros',
  'aluguel',
  'água',
  'luz',
  'gás',
  'manutenção',
  'marketing',
  'equipamentos'
];

/**
 * Process natural language commands and execute deterministic tasks using GPT-4o
 */
export async function processAgentCommand(command: string, userId: string): Promise<AgentCommandResult> {
  try {
    // Log the command for tracking
    await logAgentActivity(userId, 'command_received', command);

    // Call Supabase Edge Function to interpret intent with GPT-4o
    // Using direct fetch for reliability
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    console.log('Sending command to agent-chat function...');
    
    const response = await fetch('https://gcfyrcpugmducptktjic.supabase.co/functions/v1/agent-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || import.meta.env.VITE_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ message: command })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Function error (${response.status}): ${errorText}`);
    }

    const aiResponse = await response.json();

    if (!aiResponse.success) throw new Error(aiResponse.error);

    const { intent, parameters, reply } = aiResponse.data;

    console.log('AI Intent:', intent, parameters);

    // Execute logic based on intent
    if (intent === 'DISABLE_INGREDIENT') {
      if (parameters.ingredient) {
        return await executeDisableIngredient(parameters.ingredient, userId, reply);
      }
    } 
    else if (intent === 'REGISTER_EXPENSE') {
      if (parameters.amount && parameters.category) {
        return await executeRegisterExpense(parameters.amount, parameters.category, parameters.description || 'Despesa via Assistente', userId, reply);
      }
    }
    else if (intent === 'QUERY_INGREDIENTS') {
      return await handleIngredientQuery('mostrar ingredientes', userId); // Reuse existing
    }
    else if (intent === 'UPDATE_PRODUCT_PRICE') {
      if (parameters.product_name && parameters.new_price) {
        return await executeProductPriceUpdate(parameters.product_name, parameters.new_price, userId, reply);
      }
    }
    else if (intent === 'TOGGLE_PRODUCT_AVAILABILITY') {
      if (parameters.product_name && parameters.status) {
        return await executeProductAvailabilityToggle(parameters.product_name, parameters.status === 'active', userId, reply);
      }
    }
    
    // Default fallback for CHAT or unknown
    return {
      success: true,
      message: reply || 'Entendido.'
    };

  } catch (error) {
    console.error('Error processing agent command:', error);
    
    // Fallback to local regex if AI fails
    console.log('Falling back to local regex processing...');
    return processLocalAgentCommand(command, userId);
  }
}

// ... (Existing regex functions renamed to processLocalAgentCommand or kept as helpers)

// Helper to execute disabling directly with AI params
async function executeDisableIngredient(ingredientName: string, userId: string, aiReply: string): Promise<AgentCommandResult> {
  try {
    const { data: ingredients, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .ilike('name', `%${ingredientName}%`);

    if (error) throw error;

    if (!ingredients || ingredients.length === 0) {
      return {
        success: false,
        message: `Não encontrei nenhum ingrediente ativo chamado "${ingredientName}".`
      };
    }

    const ingredientIds = ingredients.map(ing => ing.id);
    await supabase
      .from('ingredients')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in('id', ingredientIds);

    await logAgentActivity(userId, 'ingredient_disable', `IA: Desativado(s) ${ingredients.length} ingrediente(s): ${ingredients.map(ing => ing.name).join(', ')}`);

    return {
      success: true,
      message: aiReply || `✅ ${ingredients.length} ingrediente(s) desativado(s): ${ingredients.map(ing => ing.name).join(', ')}`,
      metadata: { action: 'ingredient_disable', count: ingredients.length }
    };
  } catch (e: any) {
    return { success: false, message: `Erro: ${e.message}` };
  }
}

async function executeRegisterExpense(amount: number, category: string, description: string, userId: string, aiReply: string): Promise<AgentCommandResult> {
  try {
     const expense: Omit<Expense, 'id' | 'created_at'> = {
      description: description,
      amount: amount,
      category: category.toLowerCase(),
      expense_date: new Date().toISOString().split('T')[0],
      user_id: userId
    };

    await supabase.from('expenses').insert(expense);
    await logAgentActivity(userId, 'expense_register', `IA: Despesa registrada: R$ ${amount}`);

    return {
      success: true,
      message: aiReply || `✅ Despesa registrada: R$ ${amount.toFixed(2)} em ${category}`,
      metadata: { action: 'expense_register' }
    };
  } catch (e: any) {
    return { success: false, message: `Erro: ${e.message}` };
  }
}

/**
 * Legacy local processing (Fallback)
 */
async function processLocalAgentCommand(command: string, userId: string): Promise<AgentCommandResult> {
    // ... (Old processAgentCommand logic here)
    const normalizedCommand = command.toLowerCase().trim();
    if (isIngredientDisableCommand(normalizedCommand)) {
      return await handleIngredientDisable(normalizedCommand, userId);
    } else if (isExpenseRegistrationCommand(normalizedCommand)) {
      return await handleExpenseRegistration(normalizedCommand, userId);
    } else if (isIngredientQueryCommand(normalizedCommand)) {
      return await handleIngredientQuery(normalizedCommand, userId);
    } else if (isHelpCommand(normalizedCommand)) {
      return await handleHelpCommand();
    } else {
      return {
        success: false,
        message: 'Não entendi. (Modo Offline)'
      };
    }
}


/**
 * Check if command is for disabling ingredients
 */
function isIngredientDisableCommand(command: string): boolean {
  const patterns = [
    /desativar\s+(.+?)\s*(?:de\s+)?(?:todos\s+os\s+)?produtos?/i,
    /desabilitar\s+(.+?)\s*(?:de\s+)?(?:todos\s+os\s+)?produtos?/i,
    /remover\s+(.+?)\s*(?:de\s+)?(?:todos\s+os\s+)?produtos?/i,
    /tirar\s+(.+?)\s*(?:de\s+)?(?:todos\s+os\s+)?produtos?/i
  ];
  
  return patterns.some(pattern => pattern.test(command));
}

/**
 * Handle ingredient disable command
 */
async function handleIngredientDisable(command: string, userId: string): Promise<AgentCommandResult> {
  const patterns = [
    /desativar\s+(.+?)\s*(?:de\s+)?(?:todos\s+os\s+)?produtos?/i,
    /desabilitar\s+(.+?)\s*(?:de\s+)?(?:todos\s+os\s+)?produtos?/i,
    /remover\s+(.+?)\s*(?:de\s+)?(?:todos\s+os\s+)?produtos?/i,
    /tirar\s+(.+?)\s*(?:de\s+)?(?:todos\s+os\s+)?produtos?/i
  ];
  
  let ingredientName = '';
  for (const pattern of patterns) {
    const match = command.match(pattern);
    if (match) {
      ingredientName = match[1].trim();
      break;
    }
  }
  
  if (!ingredientName) {
    return {
      success: false,
      message: 'Não consegui identificar o ingrediente. Tente: "Desativar carne de sol de todos os produtos"'
    };
  }

  try {
    // Find ingredients matching the name (fuzzy search)
    const { data: ingredients, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .ilike('name', `%${ingredientName}%`);

    if (error) throw error;

    if (!ingredients || ingredients.length === 0) {
      return {
        success: false,
        message: `Nenhum ingrediente ativo encontrado com o nome "${ingredientName}"`
      };
    }

    // Disable all matching ingredients
    const ingredientIds = ingredients.map(ing => ing.id);
    const { error: updateError } = await supabase
      .from('ingredients')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in('id', ingredientIds);

    if (updateError) throw updateError;

    // Log the action
    await logAgentActivity(userId, 'ingredient_disable', `Desativado(s) ${ingredients.length} ingrediente(s): ${ingredients.map(ing => ing.name).join(', ')}`);

    return {
      success: true,
      message: `✅ ${ingredients.length} ingrediente(s) desativado(s) com sucesso: ${ingredients.map(ing => ing.name).join(', ')}`,
      metadata: {
        action: 'ingredient_disable',
        count: ingredients.length,
        ingredients: ingredients.map(ing => ing.name)
      }
    };
  } catch (error) {
    console.error('Error disabling ingredients:', error);
    return {
      success: false,
      message: `Erro ao desativar ingrediente "${ingredientName}": ${error.message}`
    };
  }
}

/**
 * Check if command is for expense registration
 */
function isExpenseRegistrationCommand(command: string): boolean {
  const patterns = [
    /lançar\s+despesa\s+de\s+r?\$?\s?(\d+(?:\.\d{1,2})?)\s*(?:para\s+)?(.+)?/i,
    /registrar\s+despesa\s+de\s+r?\$?\s?(\d+(?:\.\d{1,2})?)\s*(?:para\s+)?(.+)?/i,
    /adicionar\s+despesa\s+de\s+r?\$?\s?(\d+(?:\.\d{1,2})?)\s*(?:para\s+)?(.+)?/i,
    /despesa\s+r?\$?\s?(\d+(?:\.\d{1,2})?)\s*(?:para\s+)?(.+)?/i
  ];
  
  return patterns.some(pattern => pattern.test(command));
}

/**
 * Handle expense registration command
 */
async function handleExpenseRegistration(command: string, userId: string): Promise<AgentCommandResult> {
  const patterns = [
    /lançar\s+despesa\s+de\s+r?\$?\s?(\d+(?:\.\d{1,2})?)\s*(?:para\s+)?(.+)?/i,
    /registrar\s+despesa\s+de\s+r?\$?\s?(\d+(?:\.\d{1,2})?)\s*(?:para\s+)?(.+)?/i,
    /adicionar\s+despesa\s+de\s+r?\$?\s?(\d+(?:\.\d{1,2})?)\s*(?:para\s+)?(.+)?/i,
    /despesa\s+r?\$?\s?(\d+(?:\.\d{1,2})?)\s*(?:para\s+)?(.+)?/i
  ];
  
  let amount = 0;
  let category = '';
  
  for (const pattern of patterns) {
    const match = command.match(pattern);
    if (match) {
      amount = parseFloat(match[1]);
      category = match[2] ? match[2].trim().toLowerCase() : '';
      break;
    }
  }
  
  if (amount <= 0) {
    return {
      success: false,
      message: 'Não consegui identificar o valor da despesa. Tente: "Lançar despesa de R$ 150,00 para alimentação"'
    };
  }

  // Validate category
  let validatedCategory = category;
  if (!validatedCategory || !EXPENSE_CATEGORIES.includes(validatedCategory)) {
    // Try to extract category from command context
    if (command.includes('alimentação') || command.includes('comida')) {
      validatedCategory = 'alimentação';
    } else if (command.includes('transporte') || command.includes('gasolina')) {
      validatedCategory = 'transporte';
    } else if (command.includes('insumo') || command.includes('material')) {
      validatedCategory = 'insumos';
    } else {
      validatedCategory = 'outros';
    }
  }

  // Generate description from command
  const description = command
    .replace(/lançar|registrar|adicionar/gi, '')
    .replace(/despesa\s+de\s+r?\$?\s?\d+(?:\.\d{1,2})?/gi, '')
    .replace(/para\s+\w+/gi, '')
    .trim() || `Despesa de R$ ${amount.toFixed(2)}`;

  try {
    const expense: Omit<Expense, 'id' | 'created_at'> = {
      description: description.charAt(0).toUpperCase() + description.slice(1),
      amount: amount,
      category: validatedCategory,
      expense_date: new Date().toISOString().split('T')[0], // Today's date
      user_id: userId
    };

    const { data, error } = await supabase
      .from('expenses')
      .insert(expense)
      .select()
      .single();

    if (error) throw error;

    // Log the action
    await logAgentActivity(userId, 'expense_register', `Despesa registrada: R$ ${amount.toFixed(2)} para ${validatedCategory}`);

    return {
      success: true,
      message: `✅ Despesa registrada com sucesso: R$ ${amount.toFixed(2)} para ${validatedCategory}`,
      metadata: {
        action: 'expense_register',
        expense: data
      }
    };
  } catch (error) {
    console.error('Error registering expense:', error);
    return {
      success: false,
      message: `Erro ao registrar despesa: ${error.message}`
    };
  }
}

/**
 * Check if command is for querying ingredients
 */
function isIngredientQueryCommand(command: string): boolean {
  const patterns = [
    /mostrar\s+ingredientes?/i,
    /listar\s+ingredientes?/i,
    /ver\s+ingredientes?/i,
    /ingredientes?\s+ativos?/i,
    /quantos\s+ingredientes?/i
  ];
  
  return patterns.some(pattern => pattern.test(command));
}

/**
 * Handle ingredient query command
 */
async function handleIngredientQuery(command: string, userId: string): Promise<AgentCommandResult> {
  try {
    const { data: ingredients, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;

    if (!ingredients || ingredients.length === 0) {
      return {
        success: true,
        message: 'Nenhum ingrediente ativo encontrado.'
      };
    }

    const ingredientList = ingredients.map(ing => 
      `• ${ing.name} (${ing.category}) - R$ ${ing.price.toFixed(2)}/${ing.unit}`
    ).join('\n');

    return {
      success: true,
      message: `📋 Ingredientes ativos (${ingredients.length}):\n${ingredientList}`,
      metadata: {
        action: 'ingredient_query',
        count: ingredients.length,
        ingredients: ingredients
      }
    };
  } catch (error) {
    console.error('Error querying ingredients:', error);
    return {
      success: false,
      message: `Erro ao buscar ingredientes: ${error.message}`
    };
  }
}

/**
 * Check if command is for help
 */
function isHelpCommand(command: string): boolean {
  const patterns = [
    /ajuda/i,
    /help/i,
    /comandos/i,
    /o\s+que\s+você\s+faz/i,
    /como\s+usar/i
  ];
  
  return patterns.some(pattern => pattern.test(command));
}

/**
 * Handle help command
 */
async function handleHelpCommand(): Promise<AgentCommandResult> {
  return {
    success: true,
    message: `🤖 **Comandos disponíveis:**

**Controle de Ingredientes:**
• "Desativar [ingrediente] de todos os produtos"
• "Mostrar ingredientes ativos"

**Lançamento de Despesas:**
• "Lançar despesa de R$ [valor] para [categoria]"
• Categorias: alimentação, transporte, insumos, outros

**Exemplos:**
• "Desativar carne de sol de todos os produtos"
• "Lançar despesa de R$ 150,00 para alimentação"
• "Mostrar ingredientes ativos"`
  };
}

/**
 * Log agent activity for audit purposes
 */
async function logAgentActivity(userId: string, actionType: string, description: string, metadata?: any) {
  try {
    await supabase.from('agent_activity_logs').insert({
      user_id: userId,
      action_type: actionType,
      description: description,
      metadata: metadata || {},
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error logging agent activity:', error);
  }
}