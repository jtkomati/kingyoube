import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Shield, Mail, Phone, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Política de Privacidade</h1>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>1. Introdução</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none text-muted-foreground">
            <p>
              A KingYouBe ("nós", "nosso" ou "Empresa") está comprometida em proteger a privacidade
              dos dados pessoais de nossos usuários. Esta Política de Privacidade descreve como
              coletamos, usamos, armazenamos e protegemos suas informações pessoais em conformidade
              com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
            </p>
            <p>
              <strong>Última atualização:</strong> {new Date().toLocaleDateString('pt-BR')}
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>2. Dados Coletados</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none text-muted-foreground">
            <p>Coletamos as seguintes categorias de dados pessoais:</p>
            <ul>
              <li><strong>Dados de Identificação:</strong> Nome completo, CPF, CNPJ, email, telefone</li>
              <li><strong>Dados de Contato:</strong> Endereço, cidade, estado</li>
              <li><strong>Dados Financeiros:</strong> Transações, faturas, contas bancárias vinculadas</li>
              <li><strong>Dados de Uso:</strong> Logs de acesso, ações realizadas na plataforma</li>
              <li><strong>Dados Técnicos:</strong> Endereço IP, tipo de navegador, dispositivo utilizado</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>3. Finalidade do Tratamento</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none text-muted-foreground">
            <p>Utilizamos seus dados para:</p>
            <ul>
              <li>Prestação dos serviços de gestão financeira contratados</li>
              <li>Processamento de transações e emissão de notas fiscais</li>
              <li>Comunicação sobre atualizações do serviço e suporte técnico</li>
              <li>Cumprimento de obrigações legais e regulatórias</li>
              <li>Análise e melhoria dos nossos serviços</li>
              <li>Envio de comunicações de marketing (mediante consentimento)</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>4. Base Legal</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none text-muted-foreground">
            <p>O tratamento dos dados pessoais é realizado com base nas seguintes hipóteses legais (Art. 7º da LGPD):</p>
            <ul>
              <li><strong>Consentimento:</strong> Para marketing e comunicações opcionais</li>
              <li><strong>Execução de Contrato:</strong> Para prestação dos serviços contratados</li>
              <li><strong>Obrigação Legal:</strong> Para cumprimento de exigências fiscais e contábeis</li>
              <li><strong>Legítimo Interesse:</strong> Para segurança e melhoria dos serviços</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>5. Compartilhamento de Dados</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none text-muted-foreground">
            <p>Seus dados podem ser compartilhados com:</p>
            <ul>
              <li>Autoridades fiscais e órgãos reguladores (quando legalmente exigido)</li>
              <li>Prestadores de serviços essenciais (processadores de pagamento, serviços de nuvem)</li>
              <li>Parceiros de integração bancária (mediante seu consentimento)</li>
            </ul>
            <p>
              <strong>Não vendemos ou alugamos seus dados pessoais para terceiros.</strong>
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>6. Seus Direitos (Art. 18 da LGPD)</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none text-muted-foreground">
            <p>Como titular dos dados, você tem direito a:</p>
            <ul>
              <li><strong>Confirmação e Acesso:</strong> Confirmar a existência e acessar seus dados</li>
              <li><strong>Correção:</strong> Solicitar a correção de dados incompletos ou desatualizados</li>
              <li><strong>Anonimização/Bloqueio:</strong> Solicitar anonimização ou bloqueio de dados desnecessários</li>
              <li><strong>Portabilidade:</strong> Receber seus dados em formato estruturado</li>
              <li><strong>Eliminação:</strong> Solicitar a exclusão de dados tratados com consentimento</li>
              <li><strong>Revogação:</strong> Revogar o consentimento a qualquer momento</li>
              <li><strong>Informação:</strong> Saber com quem seus dados são compartilhados</li>
            </ul>
            <p>
              Para exercer seus direitos, acesse as{' '}
              <Link to="/privacy-settings" className="text-primary hover:underline">
                Configurações de Privacidade
              </Link>{' '}
              ou entre em contato com nosso Encarregado de Dados.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>7. Retenção de Dados</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none text-muted-foreground">
            <p>
              Mantemos seus dados pelo tempo necessário para cumprir as finalidades para as quais
              foram coletados, incluindo obrigações legais. Dados fiscais e contábeis são retidos
              por no mínimo 5 anos conforme legislação tributária.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>8. Segurança</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none text-muted-foreground">
            <p>Implementamos medidas técnicas e organizacionais para proteger seus dados:</p>
            <ul>
              <li>Criptografia de dados em trânsito e em repouso</li>
              <li>Controle de acesso baseado em funções (RBAC)</li>
              <li>Monitoramento e logs de auditoria</li>
              <li>Backups regulares e planos de recuperação</li>
              <li>Revisões periódicas de segurança</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>9. Contato do Encarregado de Dados (DPO)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-muted-foreground">
              <p>Para dúvidas, solicitações ou reclamações sobre o tratamento de seus dados:</p>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <span>dpo@kingyoube.com.br</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                <span>+55 (11) 0000-0000</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span>São Paulo, SP - Brasil</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator className="my-8" />

        <div className="flex justify-center">
          <Link to="/">
            <Button variant="outline">Voltar para o início</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
