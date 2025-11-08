import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Send, CheckCircle, AlertCircle, Phone, Mail, MapPin, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  leadSource: string;
  requestDemo: boolean;
}

const ContactForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    
    try {
      // Inserir lead na tabela leads
      const { error: leadError } = await supabase
        .from('leads')
        .insert([
          {
            name: data.name,
            email: data.email,
            phone: data.phone,
            company: data.company,
            message: data.message,
            lead_source: data.leadSource,
            status: 'new',
          },
        ]);

      if (leadError) throw leadError;

      // Se solicitou demo, inserir na tabela demo_requests
      if (data.requestDemo) {
        const { error: demoError } = await supabase
          .from('demo_requests')
          .insert([
            {
              name: data.name,
              email: data.email,
              phone: data.phone,
              company: data.company,
              preferred_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Amanhã
              status: 'pending',
            },
          ]);

        if (demoError) throw demoError;
      }

      // Registrar interação
      await supabase
        .from('interactions')
        .insert([
          {
            type: data.requestDemo ? 'demo_request' : 'contact_form',
            user_email: data.email,
            metadata: {
              form_data: data,
              timestamp: new Date().toISOString(),
            },
          },
        ]);

      setIsSuccess(true);
      reset();
      toast.success(
        data.requestDemo 
          ? 'Solicitação de demo enviada! Entraremos em contato em breve.'
          : 'Mensagem enviada com sucesso! Retornaremos em breve.'
      );
    } catch (error) {
      console.error('Erro ao enviar formulário:', error);
      toast.error('Erro ao enviar mensagem. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-12"
      >
        <CheckCircle className="w-16 h-16 text-boracume-green mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          Mensagem Enviada!
        </h3>
        <p className="text-gray-600 mb-6">
          Obrigado pelo seu interesse. Nossa equipe entrará em contato em breve.
        </p>
        <button
          onClick={() => setIsSuccess(false)}
          className="text-boracume-orange hover:text-boracume-orange/80 font-medium"
        >
          Enviar nova mensagem
        </button>
      </motion.div>
    );
  }

  return (
    <section className="py-20 bg-gray-50" id="contato">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Vamos conversar sobre seu{' '}
              <span className="text-boracume-orange">restaurante</span>?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Entre em contato conosco e descubra como o BoraCumê pode transformar seu negócio
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Informações de Contato */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="space-y-8"
            >
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-6">
                  Fale Conosco
                </h3>
                <p className="text-gray-600 mb-8">
                  Nossa equipe está pronta para ajudar você a revolucionar seu restaurante. 
                  Entre em contato e agende uma demonstração personalizada.
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-boracume-blue/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Phone className="w-6 h-6 text-boracume-blue" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Telefone</h4>
                    <p className="text-gray-600">(11) 9 9999-9999</p>
                    <p className="text-sm text-gray-500">Segunda a Sexta, 9h às 18h</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-boracume-green/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Mail className="w-6 h-6 text-boracume-green" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">E-mail</h4>
                    <p className="text-gray-600">contato@boracume.com</p>
                    <p className="text-sm text-gray-500">Resposta em até 2 horas</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-boracume-orange/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-boracume-orange" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Endereço</h4>
                    <p className="text-gray-600">São Paulo, SP</p>
                    <p className="text-sm text-gray-500">Atendimento presencial com agendamento</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-boracume-gray/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-boracume-gray" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Horário de Atendimento</h4>
                    <p className="text-gray-600">Segunda a Sexta: 9h às 18h</p>
                    <p className="text-sm text-gray-500">Suporte 24/7 para clientes</p>
                  </div>
                </div>
              </div>

              {/* Estatísticas */}
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h4 className="font-semibold text-gray-900 mb-4">Por que nos escolher?</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">1000+</div>
                    <div className="text-sm text-gray-600">Restaurantes ativos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">40%</div>
                    <div className="text-sm text-gray-600">Aumento médio em vendas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-500">4.9/5</div>
                    <div className="text-sm text-gray-600">Satisfação do cliente</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">24/7</div>
                    <div className="text-sm text-gray-600">Suporte técnico</div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Formulário */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="bg-white rounded-2xl p-8 shadow-lg"
            >
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nome completo *
                    </label>
                    <input
                      type="text"
                      {...register('name', { required: 'Nome é obrigatório' })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-boracume-orange focus:border-transparent"
                      placeholder="Seu nome completo"
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-600 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {errors.name.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      E-mail *
                    </label>
                    <input
                      type="email"
                      {...register('email', { 
                        required: 'E-mail é obrigatório',
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'E-mail inválido'
                        }
                      })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-boracume-orange focus:border-transparent"
                      placeholder="seu@email.com"
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {errors.email.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Telefone *
                    </label>
                    <input
                      type="tel"
                      {...register('phone', { required: 'Telefone é obrigatório' })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-boracume-orange focus:border-transparent"
                      placeholder="(11) 9 9999-9999"
                    />
                    {errors.phone && (
                      <p className="mt-1 text-sm text-red-600 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {errors.phone.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nome do restaurante
                    </label>
                    <input
                      type="text"
                      {...register('company')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-boracume-orange focus:border-transparent"
                      placeholder="Nome do seu restaurante"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Como nos conheceu?
                  </label>
                  <select
                    {...register('leadSource')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-boracume-orange focus:border-transparent"
                  >
                    <option value="">Selecione uma opção</option>
                    <option value="google">Google</option>
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                    <option value="indicacao">Indicação</option>
                    <option value="evento">Evento</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mensagem
                  </label>
                  <textarea
                    {...register('message')}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-boracume-orange focus:border-transparent resize-none"
                    placeholder="Conte-nos mais sobre seu restaurante e como podemos ajudar..."
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('requestDemo')}
                    className="w-4 h-4 text-boracume-orange border-gray-300 rounded focus:ring-boracume-orange"
                  />
                  <label className="ml-2 text-sm text-gray-700">
                    Gostaria de agendar uma demonstração personalizada
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-boracume-orange text-white px-8 py-4 rounded-xl font-semibold hover:bg-boracume-orange/90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isSubmitting ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      Enviar Mensagem
                    </>
                  )}
                </button>

                <p className="text-xs text-gray-500 text-center">
                  Ao enviar este formulário, você concorda com nossa Política de Privacidade
                </p>
              </form>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactForm;