import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Terms() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <FileText className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Termos de Uso</h1>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>1. Aceitação dos Termos</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none text-muted-foreground">
            <p>
              Ao acessar ou utilizar os serviços da KingYouBe, você concorda em cumprir e estar
              vinculado a estes Termos de Uso. Se você não concordar com qualquer parte destes
              termos, não poderá acessar ou usar nossos serviços.
            </p>
            <p>
              <strong>Última atualização:</strong> {new Date().toLocaleDateString('pt-BR')}
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>2. Descrição do Serviço</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none text-muted-foreground">
            <p>
              A KingYouBe é uma plataforma de gestão financeira empresarial que oferece:
            </p>
            <ul>
              <li>Gestão de contas a pagar e receber</li>
              <li>Emissão e controle de notas fiscais</li>
              <li>Integrações bancárias via Open Finance</li>
              <li>Relatórios e análises financeiras</li>
              <li>Assistente de IA para suporte financeiro</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>3. Cadastro e Conta</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none text-muted-foreground">
            <p>Para utilizar nossos serviços, você deve:</p>
            <ul>
              <li>Ter capacidade legal para celebrar contratos</li>
              <li>Fornecer informações verdadeiras, precisas e atualizadas</li>
              <li>Manter a confidencialidade de suas credenciais de acesso</li>
              <li>Ser responsável por todas as atividades realizadas em sua conta</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>4. Uso Aceitável</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none text-muted-foreground">
            <p>Você concorda em não:</p>
            <ul>
              <li>Violar qualquer lei ou regulamento aplicável</li>
              <li>Tentar acessar sistemas ou dados sem autorização</li>
              <li>Transmitir vírus ou código malicioso</li>
              <li>Usar o serviço para fins fraudulentos ou ilícitos</li>
              <li>Revender ou redistribuir o serviço sem autorização</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>5. Propriedade Intelectual</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none text-muted-foreground">
            <p>
              Todos os direitos de propriedade intelectual relacionados à plataforma,
              incluindo software, design, marcas e conteúdo, pertencem à KingYouBe
              ou seus licenciadores. Você recebe uma licença limitada, não exclusiva
              e não transferível para uso do serviço.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>6. Limitação de Responsabilidade</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none text-muted-foreground">
            <p>
              A KingYouBe não se responsabiliza por:
            </p>
            <ul>
              <li>Decisões financeiras tomadas com base nas informações do sistema</li>
              <li>Erros em integrações com sistemas externos</li>
              <li>Interrupções temporárias no serviço</li>
              <li>Perdas indiretas ou consequentes</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>7. Rescisão</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none text-muted-foreground">
            <p>
              Você pode encerrar sua conta a qualquer momento através das configurações
              de privacidade. A KingYouBe pode suspender ou encerrar seu acesso em caso
              de violação destes termos.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>8. Disposições Gerais</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none text-muted-foreground">
            <p>
              Estes termos são regidos pelas leis da República Federativa do Brasil.
              Qualquer disputa será resolvida no foro da comarca de São Paulo, SP.
            </p>
          </CardContent>
        </Card>

        <Separator className="my-8" />

        <div className="flex justify-center gap-4">
          <Link to="/privacy-policy">
            <Button variant="outline">Política de Privacidade</Button>
          </Link>
          <Link to="/">
            <Button variant="outline">Voltar para o início</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
