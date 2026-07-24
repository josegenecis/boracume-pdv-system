import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, FileCheck2, LockKeyhole, Scale, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

const updatedAt = '24 de julho de 2026';

const pages = {
  '/privacidade': {
    title: 'Política de Privacidade',
    subtitle: 'Como o PopSystem trata dados pessoais e operacionais.',
    icon: LockKeyhole,
    sections: [
      ['Dados tratados', 'Tratamos dados de cadastro, autenticação, operação do restaurante, pedidos, pagamentos e registros técnicos necessários para prestar, proteger e melhorar o serviço. Dados financeiros sensíveis são processados pelos provedores de pagamento autorizados.'],
      ['Finalidades', 'Os dados são usados para autenticação, execução dos serviços contratados, prevenção a fraudes, suporte, conciliação, cumprimento de obrigações legais e segurança da plataforma.'],
      ['Compartilhamento e segurança', 'Compartilhamos somente o necessário com operadores essenciais, como infraestrutura, autenticação e meios de pagamento. Aplicamos controles de acesso, registros de auditoria e proteção de credenciais.'],
      ['Seus direitos', 'O titular pode solicitar confirmação, acesso, correção e demais direitos aplicáveis pelos canais oficiais do PopSystem, respeitadas as obrigações legais de retenção.'],
    ],
  },
  '/lgpd': {
    title: 'LGPD e proteção de dados',
    subtitle: 'Compromissos do PopSystem com privacidade e transparência.',
    icon: ShieldCheck,
    sections: [
      ['Papéis e responsabilidades', 'Cada restaurante é responsável pelos dados de seus clientes e colaboradores inseridos no sistema. O PopSystem atua no tratamento necessário para fornecer a plataforma, conforme as instruções, contratos e bases legais aplicáveis.'],
      ['Segurança e incidentes', 'Mantemos medidas técnicas e administrativas proporcionais aos riscos. Incidentes relevantes são avaliados e tratados conforme a legislação e as orientações da autoridade competente.'],
      ['Solicitações', 'Pedidos relacionados a dados pessoais devem identificar o titular e a relação com o restaurante. Poderemos solicitar informações adicionais para confirmar a identidade antes de responder.'],
    ],
  },
  '/termos': {
    title: 'Termos de Uso',
    subtitle: 'Regras para utilização do PopSystem e do PopPay.',
    icon: Scale,
    sections: [
      ['Uso da plataforma', 'O cliente deve manter seus dados corretos, proteger seus acessos e utilizar o sistema de acordo com a legislação. O restaurante é responsável por sua operação comercial, fiscal, produtos, preços e atendimento ao consumidor.'],
      ['Serviços de terceiros', 'Recursos como pagamentos dependem de serviços de terceiros e dos respectivos contratos, tarifas, análises e disponibilidade. O PopSystem não substitui o Mercado Pago nem instituições financeiras.'],
      ['Disponibilidade e suporte', 'O PopSystem busca manter os serviços disponíveis e seguros, mas manutenções, falhas de internet e indisponibilidades de terceiros podem afetar temporariamente algumas funções.'],
      ['PopPay — versão 2026-07-v3', 'Ao conectar o PopPay, o titular autoriza o PopSystem a iniciar a conexão OAuth com sua conta Mercado Pago e a criar, consultar, conciliar e solicitar devoluções de pagamentos comandados pelo sistema. Na condição comercial vigente, os recebimentos via PIX possuem tarifa integrada de referência de 1,99% por transação para processamento, conciliação e repasse imediato. Essa tarifa é composta pela tarifa operacional PopPay de 1% e pela tarifa de processamento do Mercado Pago aplicável à conta conectada. O crédito online é uma modalidade opcional, ativada mediante aceite específico, disponível exclusivamente para pagamento à vista (uma parcela). Em cada transação de crédito online aprovada são descontadas do recebível do restaurante a tarifa de processamento definida pelo Mercado Pago para sua conta e a tarifa operacional PopPay apresentada na tela do aceite específico, cujo padrão comercial atual é de 0,5% sobre o valor da transação. Não é oferecido parcelamento. A tarifa aceita fica registrada com sua versão, data e usuário; uma alteração exige novo aceite antes da reativação. Tarifas, prazos, promoções e condições do Mercado Pago podem variar conforme o contrato do titular. As tarifas incidem sobre o recebível do restaurante e não são acrescentadas ao valor pago pelo consumidor. A modalidade de crédito online pode ser desativada pelo restaurante, e a autorização do PopPay pode ser revogada, sem apagar registros cuja conservação seja necessária por obrigação legal, segurança, conciliação ou comprovação de operações realizadas.'],
      ['Aceite eletrônico', 'O aceite é vinculado ao usuário autenticado, à versão apresentada e à data e hora do consentimento. Uma nova versão relevante poderá exigir novo aceite.'],
    ],
  },
} as const;

export default function LegalPage() {
  const { pathname } = useLocation();
  const page = pages[pathname as keyof typeof pages] ?? pages['/termos'];
  const Icon = page.icon;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#ecfdf5,_transparent_38%),radial-gradient(circle_at_bottom_right,_#fff7ed,_transparent_38%)] px-4 py-10 text-slate-900 sm:py-16">
      <article className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-xl shadow-emerald-950/5">
        <header className="bg-gradient-to-br from-emerald-950 via-emerald-800 to-orange-500 px-6 py-10 text-white sm:px-10">
          <Icon className="mb-5 h-9 w-9" aria-hidden="true" />
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{page.title}</h1>
          <p className="mt-3 max-w-2xl text-emerald-50">{page.subtitle}</p>
          <p className="mt-5 text-xs font-medium uppercase tracking-widest text-white/70">Atualizado em {updatedAt}</p>
        </header>
        <div className="space-y-8 px-6 py-8 sm:px-10 sm:py-10">
          {page.sections.map(([title, content]) => (
            <section key={title} id={title.startsWith('PopPay') ? 'poppay' : undefined} className="scroll-mt-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-emerald-950">
                <FileCheck2 className="h-5 w-5 text-orange-500" aria-hidden="true" />{title}
              </h2>
              <p className="mt-3 leading-7 text-slate-600">{content}</p>
            </section>
          ))}
          <Button asChild variant="outline"><Link to="/landing"><ArrowLeft className="mr-2 h-4 w-4" />Voltar ao site</Link></Button>
        </div>
      </article>
    </main>
  );
}
