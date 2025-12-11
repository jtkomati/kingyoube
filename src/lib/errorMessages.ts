/**
 * Sistema de mensagens de erro user-friendly
 * Traduz erros técnicos em linguagem compreensível
 */

export interface ErrorAction {
  label: string;
  action: () => void;
}

export interface FriendlyError {
  title: string;
  message: string;
  action?: ErrorAction;
}

const errorMap: Record<string, FriendlyError> = {
  // Erros de Autenticação
  'Invalid login credentials': {
    title: 'Login Incorreto',
    message: 'Email ou senha incorretos. Verifique seus dados e tente novamente.',
  },
  'User already registered': {
    title: 'Conta Já Existe',
    message: 'Este email já está cadastrado. Faça login ou use "Esqueci minha senha" se não lembrar.',
  },
  'Signup requires a valid password': {
    title: 'Senha Inválida',
    message: 'A senha deve ter pelo menos 8 caracteres com letras maiúsculas, minúsculas, números e caracteres especiais.',
  },
  'Unable to validate email address': {
    title: 'Email Inválido',
    message: 'O formato do email está incorreto. Verifique e tente novamente.',
  },
  'Database error saving new user': {
    title: 'Erro ao Criar Conta',
    message: 'Não foi possível criar sua conta. Tente novamente em alguns instantes.',
  },
  'Failed to create user': {
    title: 'Erro ao Criar Conta',
    message: 'Ocorreu um erro ao criar sua conta. Verifique os dados e tente novamente.',
  },
  'Email not confirmed': {
    title: 'Email Não Confirmado',
    message: 'Verifique sua caixa de entrada e confirme seu email antes de fazer login.',
  },
  'Invalid email': {
    title: 'Email Inválido',
    message: 'Por favor, digite um endereço de email válido.',
  },
  'Password is too weak': {
    title: 'Senha Fraca',
    message: 'Sua senha deve ter pelo menos 8 caracteres, incluindo maiúsculas, minúsculas, números e caracteres especiais.',
  },
  'User not found': {
    title: 'Usuário Não Encontrado',
    message: 'Não encontramos uma conta com este email. Verifique o email ou crie uma nova conta.',
  },

  // Erros de Rede
  'Network request failed': {
    title: 'Sem Conexão',
    message: 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.',
  },
  'Failed to fetch': {
    title: 'Erro de Conexão',
    message: 'Não foi possível carregar os dados. Verifique sua internet e recarregue a página.',
  },
  'timeout': {
    title: 'Tempo Esgotado',
    message: 'A operação demorou muito para responder. Tente novamente.',
  },

  // Erros de Permissão
  'Insufficient permissions': {
    title: 'Sem Permissão',
    message: 'Você não tem permissão para realizar esta ação. Contate um administrador se precisar de acesso.',
  },
  'Access denied': {
    title: 'Acesso Negado',
    message: 'Você não tem permissão para acessar este recurso.',
  },

  // Erros de Validação
  'Invalid input': {
    title: 'Dados Inválidos',
    message: 'Alguns campos contêm informações inválidas. Revise o formulário e tente novamente.',
  },
  'Required field missing': {
    title: 'Campo Obrigatório',
    message: 'Preencha todos os campos obrigatórios antes de continuar.',
  },

  // Erros do Supabase
  'row-level security policy': {
    title: 'Erro de Segurança',
    message: 'Você não tem permissão para acessar estes dados. Verifique suas credenciais.',
  },
  'duplicate key value': {
    title: 'Registro Duplicado',
    message: 'Este registro já existe. Verifique se você não está tentando criar um duplicado.',
  },
  'foreign key constraint': {
    title: 'Erro de Referência',
    message: 'Esta operação não pode ser concluída porque há registros relacionados. Remova as dependências primeiro.',
  },

  // Erros de Rate Limit
  'Too many requests': {
    title: 'Muitas Tentativas',
    message: 'Você fez muitas tentativas. Aguarde alguns minutos antes de tentar novamente.',
  },
  '429': {
    title: 'Limite Excedido',
    message: 'Você atingiu o limite de requisições. Por favor, aguarde um momento.',
  },
  'For security purposes': {
    title: 'Aguarde um Momento',
    message: 'Por segurança, aguarde alguns segundos antes de solicitar outro e-mail.',
  },
  'over_email_send_rate_limit': {
    title: 'Limite de E-mails',
    message: 'Você já solicitou um e-mail recentemente. Aguarde alguns minutos e verifique sua caixa de entrada.',
  },
  'Email rate limit exceeded': {
    title: 'Limite de E-mails',
    message: 'Muitas solicitações de e-mail. Aguarde alguns minutos antes de tentar novamente.',
  },

  // Erros de AI
  '402': {
    title: 'Créditos Insuficientes',
    message: 'Seus créditos de IA acabaram. Adicione créditos em Configurações > Workspace > Uso.',
  },
  'Rate limits exceeded': {
    title: 'Limite de IA Excedido',
    message: 'Você atingiu o limite de uso da IA. Aguarde alguns minutos ou adicione mais créditos.',
  },
};

/**
 * Converte um erro técnico em mensagem amigável
 */
export function getFriendlyError(error: any): FriendlyError {
  // Se já for um objeto de erro amigável
  if (error.title && error.message) {
    return error;
  }

  const errorMessage = error?.message || error?.toString() || 'unknown';
  const errorCode = error?.code || error?.status?.toString();

  // Procurar por correspondência exata
  if (errorMap[errorMessage]) {
    return errorMap[errorMessage];
  }

  // Procurar por código de erro
  if (errorCode && errorMap[errorCode]) {
    return errorMap[errorCode];
  }

  // Procurar por correspondência parcial
  for (const [key, value] of Object.entries(errorMap)) {
    if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  // Erro genérico como fallback
  return {
    title: 'Algo Deu Errado',
    message: 'Ocorreu um erro inesperado. Por favor, tente novamente. Se o problema persistir, entre em contato com o suporte.',
  };
}

/**
 * Determina se um erro é recuperável com retry
 */
export function isRetryableError(error: any): boolean {
  const retryableErrors = [
    'Network request failed',
    'Failed to fetch',
    'timeout',
    'ECONNREFUSED',
    '429',
    '503',
    '504',
  ];

  const errorMessage = error?.message || error?.toString() || '';
  const errorCode = error?.code || error?.status?.toString();

  return retryableErrors.some(
    (retryable) =>
      errorMessage.includes(retryable) || errorCode === retryable
  );
}

/**
 * Determina se um erro deve ser logado (não sensível)
 */
export function shouldLogError(error: any): boolean {
  const sensitiveErrors = [
    'Invalid login credentials',
    'Password',
    'Token',
    'Authentication',
  ];

  const errorMessage = error?.message || '';
  
  return !sensitiveErrors.some((sensitive) =>
    errorMessage.includes(sensitive)
  );
}
