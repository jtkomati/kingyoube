/**
 * Password Breach Check usando HaveIBeenPwned API
 * Implementa k-Anonymity para verificar senhas vazadas de forma segura
 */

/**
 * Calcula o hash SHA-1 de uma string
 */
async function sha1(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Verifica se uma senha foi exposta em vazamentos de dados
 * Usa a API k-Anonymity do HaveIBeenPwned que não expõe a senha real
 * 
 * @param password - A senha a ser verificada
 * @returns Promise<{ breached: boolean; count: number }> - Se foi vazada e quantas vezes
 */
export async function checkPasswordBreach(password: string): Promise<{
  breached: boolean;
  count: number;
  error?: string;
}> {
  try {
    const hash = await sha1(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        'Add-Padding': 'true', // Adiciona padding para dificultar análise de tráfego
      },
    });

    if (!response.ok) {
      console.warn('HIBP API error:', response.status);
      return { breached: false, count: 0 }; // Falha silenciosa - não bloquear signup
    }

    const data = await response.text();
    const lines = data.split('\n');

    for (const line of lines) {
      const [hashSuffix, countStr] = line.split(':');
      if (hashSuffix.trim() === suffix) {
        const count = parseInt(countStr.trim(), 10);
        return { breached: true, count };
      }
    }

    return { breached: false, count: 0 };
  } catch (error) {
    console.warn('Failed to check password breach:', error);
    // Em caso de erro de rede, não bloquear o usuário
    return { breached: false, count: 0, error: 'Não foi possível verificar a senha' };
  }
}

/**
 * Mensagem amigável para senhas vazadas
 */
export function getBreachWarningMessage(count: number): string {
  if (count > 1000000) {
    return `Esta senha foi encontrada em mais de 1 milhão de vazamentos de dados. Por favor, escolha uma senha mais segura.`;
  }
  if (count > 100000) {
    return `Esta senha foi encontrada em mais de 100 mil vazamentos de dados. Recomendamos fortemente escolher outra senha.`;
  }
  if (count > 10000) {
    return `Esta senha foi encontrada em mais de 10 mil vazamentos de dados. Considere usar uma senha diferente.`;
  }
  if (count > 1000) {
    return `Esta senha apareceu em mais de ${count.toLocaleString('pt-BR')} vazamentos. Para sua segurança, escolha outra senha.`;
  }
  return `Esta senha foi encontrada em ${count.toLocaleString('pt-BR')} vazamento(s) de dados. Para sua segurança, escolha outra senha.`;
}
