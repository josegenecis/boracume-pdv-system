
<<<<<<< HEAD
import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, Globe, CheckCircle, Star, Shield, Smartphone, Package, TrendingUp, Clock, Users, DollarSign, BarChart3, Truck, CreditCard, MessageCircle, Award, ArrowRight, Play, Plus, Rocket } from 'lucide-react';

const Index = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md shadow-lg border-b border-orange-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3">
            <div className="flex items-center space-x-3 group">
              <div className="text-3xl animate-bounce">🍽️</div>
              <div className="text-3xl font-bold">
                <span className="text-boracume-orange bg-gradient-to-r from-boracume-orange to-orange-600 bg-clip-text text-transparent">Bora</span>
                <span className="text-boracume-green bg-gradient-to-r from-boracume-green to-green-600 bg-clip-text text-transparent">Cumê</span>
              </div>
              <div className="hidden md:flex items-center ml-4 px-3 py-1 bg-gradient-to-r from-orange-100 to-green-100 rounded-full">
                <span className="text-xs font-semibold text-gray-700">Sistema Completo</span>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <nav className="hidden md:flex items-center space-x-8">
                <a href="#recursos" className="text-gray-600 hover:text-boracume-orange transition-colors font-medium">Recursos</a>
                <a href="#precos" className="text-gray-600 hover:text-boracume-orange transition-colors font-medium">Preços</a>
                <a href="#depoimentos" className="text-gray-600 hover:text-boracume-orange transition-colors font-medium">Clientes</a>
              </nav>
              <Link to="/login" className="text-gray-600 hover:text-boracume-orange transition-colors font-medium">
                Entrar
              </Link>
              <Link 
                to="/signup" 
                className="bg-gradient-to-r from-boracume-orange to-orange-600 text-white px-8 py-3 rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 font-semibold"
              >
                Começar Agora
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen overflow-hidden">
        {/* Full Width Background Image */}
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80" 
            alt="Atendente de restaurante no caixa recebendo pedido do cliente" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
        </div>
        
        {/* Background Animation Overlay */}
        <div className="absolute inset-0 z-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-boracume-orange/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-green-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-boracume-orange/5 to-green-500/5 rounded-full blur-3xl animate-spin" style={{animationDuration: '20s'}}></div>
        </div>
        
        {/* Content Overlay */}
        <div className="relative z-20 min-h-screen flex items-center">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="max-w-4xl">
              {/* Content */}
              <div className="text-left">
                <div className="mb-6">
                  <div className="inline-flex items-center bg-white/10 backdrop-blur-md px-6 py-3 rounded-full shadow-lg border border-white/20 text-sm text-white mb-8 hover:bg-white/20 transition-all duration-300">
                    <div className="flex items-center">
                      <Star className="w-5 h-5 text-yellow-400 mr-2 animate-pulse" />
                      <span className="font-semibold text-boracume-orange mr-2">🚀 Mais de 1.000</span>
                      <span>restaurantes já confiam no BoraCumê</span>
                    </div>
                  </div>
                </div>
                <h1 className='text-4xl md:text-6xl lg:text-8xl font-bold mb-6 leading-tight'>
                  <span className='text-white drop-shadow-2xl'>Transforme seu</span>
                  <br />
                  <span className='text-white drop-shadow-2xl'>Restaurante em uma</span>
                  <br />
                  <span className='bg-gradient-to-r from-boracume-orange to-orange-400 bg-clip-text text-transparent animate-pulse drop-shadow-2xl'>Máquina de Vendas Digital</span>
                </h1>
                <p className="text-xl text-white/90 mb-8 leading-relaxed drop-shadow-lg max-w-3xl">
                  Sistema completo de gestão que <strong className="text-boracume-orange">aumenta suas vendas em até 300%</strong> com delivery integrado, 
                  PDV inteligente, cozinha otimizada e relatórios que mostram exatamente onde ganhar mais dinheiro.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                  <Link 
                    to="/dashboard" 
                    className="group bg-gradient-to-r from-boracume-orange to-orange-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 flex items-center justify-center gap-2"
                  >
                    <Zap className="w-5 h-5 group-hover:animate-bounce" />
                    Experimente Grátis por 7 Dias
                  </Link>
                  <Link 
                    to="/login" 
                    className="group bg-white/10 backdrop-blur-md border-2 border-white/30 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-white/20 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center justify-center gap-2"
                  >
                    <Play className="w-5 h-5 group-hover:animate-pulse" />
                    Ver Demo ao Vivo
                  </Link>
                </div>
                <div className="flex flex-wrap items-center gap-8 text-sm text-white/80">
                  <div className="flex items-center gap-2 group hover:text-green-400 transition-colors">
                    <CheckCircle className="w-4 h-4 text-green-400 group-hover:animate-pulse" />
                    <span>Sem compromisso</span>
                  </div>
                  <div className="flex items-center gap-2 group hover:text-green-400 transition-colors">
                    <CheckCircle className="w-4 h-4 text-green-400 group-hover:animate-pulse" />
                    <span>Configuração em 5 minutos</span>
                  </div>
                  <div className="flex items-center gap-2 group hover:text-green-400 transition-colors">
                    <CheckCircle className="w-4 h-4 text-green-400 group-hover:animate-pulse" />
                    <span>Suporte incluído</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Floating Stats */}
        <div className="absolute top-1/4 right-8 z-30 hidden lg:block">
          <div className="bg-white/95 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-white/20 hover:scale-110 transition-transform duration-300">
            <div className="text-4xl font-bold bg-gradient-to-r from-boracume-orange to-orange-600 bg-clip-text text-transparent mb-2">+300%</div>
            <div className="text-sm text-gray-600 font-medium">Aumento nas Vendas</div>
          </div>
        </div>
        
        <div className="absolute bottom-1/4 right-8 z-30 hidden lg:block">
          <div className="bg-white/95 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-white/20 hover:scale-110 transition-transform duration-300">
            <div className="text-4xl font-bold bg-gradient-to-r from-green-500 to-green-600 bg-clip-text text-transparent mb-2">1000+</div>
            <div className="text-sm text-gray-600 font-medium">Restaurantes Ativos</div>
          </div>
        </div>
      </section>

      {/* Mockups Section */}
      <section className="py-20 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center bg-gradient-to-r from-boracume-orange/10 to-orange-100 px-4 py-2 rounded-full text-sm font-semibold text-boracume-orange mb-6">
              💻 Interface Responsiva
            </div>
            <h2 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-6">
              Sistema que funciona em qualquer dispositivo
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Interface moderna e intuitiva, otimizada para desktop, tablet e celular
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 items-end">
            {/* Desktop Mockup */}
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Desktop</h3>
              <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
                <svg viewBox="0 0 400 250" className="w-full h-auto">
                  {/* Monitor */}
                  <rect x="20" y="20" width="360" height="200" rx="8" fill="#1f2937" stroke="#374151" strokeWidth="2"/>
                  <rect x="30" y="30" width="340" height="170" rx="4" fill="#ffffff"/>
                  
                  {/* Header */}
                  <rect x="30" y="30" width="340" height="40" fill="#f97316"/>
                  <text x="50" y="52" fill="white" fontSize="12" fontWeight="bold">BoraCumê</text>
                  
                  {/* Sidebar */}
                  <rect x="30" y="70" width="80" height="130" fill="#f3f4f6"/>
                  <rect x="40" y="80" width="60" height="8" fill="#d1d5db" rx="2"/>
                  <rect x="40" y="95" width="60" height="8" fill="#d1d5db" rx="2"/>
                  <rect x="40" y="110" width="60" height="8" fill="#f97316" rx="2"/>
                  
                  {/* Main Content */}
                  <rect x="120" y="80" width="240" height="60" fill="#fef3c7" rx="4"/>
                  <rect x="130" y="90" width="100" height="8" fill="#f59e0b" rx="2"/>
                  <rect x="130" y="105" width="80" height="6" fill="#d97706" rx="2"/>
                  
                  {/* Cards */}
                  <rect x="120" y="150" width="70" height="40" fill="#ecfdf5" rx="4"/>
                  <rect x="200" y="150" width="70" height="40" fill="#fef2f2" rx="4"/>
                  <rect x="280" y="150" width="70" height="40" fill="#eff6ff" rx="4"/>
                  
                  {/* Monitor Stand */}
                  <rect x="180" y="220" width="40" height="15" fill="#6b7280" rx="2"/>
                  <rect x="160" y="235" width="80" height="8" fill="#9ca3af" rx="4"/>
                </svg>
              </div>
            </div>

            {/* Tablet Mockup */}
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Tablet</h3>
              <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
                <svg viewBox="0 0 300 400" className="w-full h-auto max-w-xs mx-auto">
                  {/* Tablet Frame */}
                  <rect x="30" y="30" width="240" height="340" rx="20" fill="#1f2937" stroke="#374151" strokeWidth="3"/>
                  <rect x="45" y="45" width="210" height="310" rx="8" fill="#ffffff"/>
                  
                  {/* Header */}
                  <rect x="45" y="45" width="210" height="35" fill="#f97316"/>
                  <text x="60" y="65" fill="white" fontSize="10" fontWeight="bold">BoraCumê</text>
                  
                  {/* Navigation */}
                  <rect x="45" y="85" width="210" height="30" fill="#f3f4f6"/>
                  <rect x="55" y="92" width="40" height="6" fill="#f97316" rx="2"/>
                  <rect x="105" y="92" width="40" height="6" fill="#d1d5db" rx="2"/>
                  <rect x="155" y="92" width="40" height="6" fill="#d1d5db" rx="2"/>
                  
                  {/* Content Grid */}
                  <rect x="55" y="125" width="85" height="60" fill="#fef3c7" rx="4"/>
                  <rect x="150" y="125" width="85" height="60" fill="#ecfdf5" rx="4"/>
                  <rect x="55" y="195" width="85" height="60" fill="#fef2f2" rx="4"/>
                  <rect x="150" y="195" width="85" height="60" fill="#eff6ff" rx="4"/>
                  
                  {/* Stats */}
                  <rect x="55" y="265" width="180" height="40" fill="#f9fafb" rx="4"/>
                  <rect x="65" y="275" width="50" height="8" fill="#f97316" rx="2"/>
                  <rect x="65" y="287" width="30" height="6" fill="#d1d5db" rx="2"/>
                  
                  {/* Home Button */}
                  <circle cx="150" cy="380" r="8" fill="#6b7280"/>
                </svg>
              </div>
            </div>

            {/* Mobile Mockup */}
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Mobile</h3>
              <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
                <svg viewBox="0 0 200 400" className="w-full h-auto max-w-xs mx-auto">
                  {/* Phone Frame */}
                  <rect x="20" y="20" width="160" height="360" rx="25" fill="#1f2937" stroke="#374151" strokeWidth="2"/>
                  <rect x="30" y="40" width="140" height="320" rx="15" fill="#ffffff"/>
                  
                  {/* Status Bar */}
                  <rect x="30" y="40" width="140" height="20" fill="#f3f4f6"/>
                  <text x="40" y="52" fill="#6b7280" fontSize="8">9:41</text>
                  <text x="150" y="52" fill="#6b7280" fontSize="8">100%</text>
                  
                  {/* Header */}
                  <rect x="30" y="60" width="140" height="40" fill="#f97316"/>
                  <text x="40" y="82" fill="white" fontSize="10" fontWeight="bold">BoraCumê</text>
                  
                  {/* Menu Button */}
                  <rect x="140" y="70" width="20" height="20" fill="#ffffff" rx="2" opacity="0.2"/>
                  
                  {/* Content Cards */}
                  <rect x="40" y="110" width="120" height="50" fill="#fef3c7" rx="6"/>
                  <rect x="50" y="120" width="80" height="6" fill="#f59e0b" rx="2"/>
                  <rect x="50" y="130" width="60" height="4" fill="#d97706" rx="2"/>
                  
                  <rect x="40" y="170" width="120" height="50" fill="#ecfdf5" rx="6"/>
                  <rect x="50" y="180" width="80" height="6" fill="#10b981" rx="2"/>
                  <rect x="50" y="190" width="60" height="4" fill="#059669" rx="2"/>
                  
                  <rect x="40" y="230" width="120" height="50" fill="#fef2f2" rx="6"/>
                  <rect x="50" y="240" width="80" height="6" fill="#ef4444" rx="2"/>
                  <rect x="50" y="250" width="60" height="4" fill="#dc2626" rx="2"/>
                  
                  {/* Bottom Navigation */}
                  <rect x="30" y="320" width="140" height="40" fill="#f3f4f6"/>
                  <circle cx="60" cy="340" r="6" fill="#f97316"/>
                  <circle cx="100" cy="340" r="6" fill="#d1d5db"/>
                  <circle cx="140" cy="340" r="6" fill="#d1d5db"/>
                  
                  {/* Home Indicator */}
                  <rect x="80" y="370" width="40" height="4" fill="#6b7280" rx="2"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-white relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 bg-gradient-to-br from-boracume-orange/10 to-transparent"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center bg-gradient-to-r from-boracume-orange/10 to-orange-100 px-4 py-2 rounded-full text-sm font-semibold text-boracume-orange mb-6">
              📊 Resultados Comprovados
            </div>
            <h2 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-6">
              Veja como o BoraCumê está transformando restaurantes em todo o Brasil
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Resultados reais de mais de 1.000 restaurantes que já confiam no nosso sistema
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="group text-center bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
              <div className="w-16 h-16 bg-gradient-to-r from-boracume-orange to-orange-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <div className="text-4xl font-bold bg-gradient-to-r from-boracume-orange to-orange-600 bg-clip-text text-transparent mb-2 group-hover:scale-110 transition-transform duration-300">+300%</div>
              <div className="text-gray-600 font-medium">Aumento médio nas vendas</div>
              <div className="text-sm text-gray-500 mt-2">Em até 90 dias de uso</div>
            </div>
            <div className="group text-center bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
              <div className="w-16 h-16 bg-gradient-to-r from-boracume-green to-green-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                <Clock className="w-8 h-8 text-white" />
              </div>
              <div className="text-4xl font-bold bg-gradient-to-r from-boracume-green to-green-600 bg-clip-text text-transparent mb-2 group-hover:scale-110 transition-transform duration-300">-40%</div>
              <div className="text-gray-600 font-medium">Redução no tempo de preparo</div>
              <div className="text-sm text-gray-500 mt-2">Cozinha mais eficiente</div>
            </div>
            <div className="group text-center bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                <Star className="w-8 h-8 text-white" />
              </div>
              <div className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent mb-2 group-hover:scale-110 transition-transform duration-300">98%</div>
              <div className="text-gray-600 font-medium">Satisfação dos clientes</div>
              <div className="text-sm text-gray-500 mt-2">Avaliação média 4.9/5</div>
            </div>
          </div>
          
          {/* Additional Trust Indicators */}
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-6 h-6 text-yellow-500 fill-current" />
                ))}
              </div>
              <p className="text-gray-600 font-medium">4.9/5 estrelas</p>
              <p className="text-sm text-gray-500">Avaliação dos clientes</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">🏆</div>
              <p className="text-gray-600 font-medium">Melhor Sistema 2024</p>
              <p className="text-sm text-gray-500">Prêmio Foodtech Brasil</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">🔒</div>
              <p className="text-gray-600 font-medium">100% Seguro</p>
              <p className="text-sm text-gray-500">Certificação PCI DSS</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">⚡</div>
              <p className="text-gray-600 font-medium">Setup em 5min</p>
              <p className="text-sm text-gray-500">Implementação rápida</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Tudo que você precisa para dominar o mercado
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Não é só um sistema, é uma estratégia completa para multiplicar seus resultados
            </p>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">
            <div>
              <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-1 rounded-lg inline-block mb-4">
                <Truck className="w-8 h-8 m-2" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Delivery que Vende Sozinho
              </h3>
              <p className="text-gray-600 mb-6">
                Integração automática com iFood, Uber Eats e Rappi. Cardápio sincronizado, 
                pedidos centralizados e entregadores otimizados por IA.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Gestão unificada de todos os apps</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Roteamento inteligente de entregadores</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Preços dinâmicos por horário</span>
                </li>
              </ul>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-xl">
              <div className="text-center">
                <div className="text-3xl mb-4">📱</div>
                <h4 className="font-semibold mb-2">Pedidos Unificados</h4>
                <p className="text-sm text-gray-600">Todos os apps em uma tela</p>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">
            <div className="bg-white p-8 rounded-2xl shadow-xl order-2 lg:order-1">
              <div className="text-center">
                <div className="text-3xl mb-4">🧠</div>
                <h4 className="font-semibold mb-2">IA Preditiva</h4>
                <p className="text-sm text-gray-600">Decisões baseadas em dados</p>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-1 rounded-lg inline-block mb-4">
                <BarChart3 className="w-8 h-8 m-2" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Decisões Inteligentes com IA
              </h3>
              <p className="text-gray-600 mb-6">
                Nossa IA analisa padrões de venda, prevê demanda e sugere ações que 
                aumentam seu faturamento automaticamente.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Previsão de demanda por produto</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Sugestões de combos rentáveis</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Alertas de oportunidades de venda</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">
            <div>
              <div className="bg-gradient-to-r from-green-500 to-teal-500 text-white p-1 rounded-lg inline-block mb-4">
                <Package className="w-8 h-8 m-2" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Zero Desperdício, Máximo Lucro
              </h3>
              <p className="text-gray-600 mb-6">
                Controle de estoque inteligente que evita perdas e garante que você 
                sempre tenha o que vender, quando vender.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Alertas de vencimento automáticos</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Compras sugeridas por IA</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Receitas que se ajustam ao estoque</span>
                </li>
              </ul>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-xl">
              <div className="text-center">
                <div className="text-3xl mb-4">📦</div>
                <h4 className="font-semibold mb-2">Estoque Inteligente</h4>
                <p className="text-sm text-gray-600">Nunca mais perca dinheiro</p>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="bg-white p-8 rounded-2xl shadow-xl order-2 lg:order-1">
              <div className="text-center">
                <div className="text-3xl mb-4">💳</div>
                <h4 className="font-semibold mb-2">PDV Completo</h4>
                <p className="text-sm text-gray-600">Vendas presenciais otimizadas</p>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-1 rounded-lg inline-block mb-4">
                <CreditCard className="w-8 h-8 m-2" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                PDV que Acelera suas Vendas
              </h3>
              <p className="text-gray-600 mb-6">
                Sistema de ponto de venda integrado que processa pedidos em segundos 
                e sugere vendas adicionais automaticamente.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Sugestões de upsell automáticas</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Pagamentos via PIX, cartão e dinheiro</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Relatórios de vendedor em tempo real</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-gradient-to-br from-white via-orange-50/30 to-green-50/30 relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute top-10 left-10 w-64 h-64 bg-gradient-to-r from-boracume-orange/5 to-orange-200/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-gradient-to-r from-green-500/5 to-emerald-200/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center bg-gradient-to-r from-green-100 to-emerald-100 px-4 py-2 rounded-full text-sm font-semibold text-green-700 mb-6">
              💬 Depoimentos Reais
            </div>
            <h2 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-6">
              Mais de 1.000 donos de restaurante já transformaram seus negócios
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Histórias reais de transformação de restaurantes em todo o Brasil
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="group bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3 border border-gray-100 relative overflow-hidden">
              {/* Card Background Gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-boracume-orange/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <div className="relative z-10">
                <div className="flex items-center mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-500 fill-current animate-pulse" style={{animationDelay: `${i * 100}ms`}} />
                  ))}
                  <span className="ml-2 text-sm font-semibold text-gray-600">5.0</span>
                </div>
                <blockquote className="text-gray-700 mb-6 text-lg leading-relaxed italic">
                  "Em 3 meses, nossas vendas aumentaram 280%. O sistema é incrível e o suporte é excepcional. A integração com delivery foi um divisor de águas."
                </blockquote>
                <div className="flex items-center">
                  <div className="relative">
                    <img 
                      src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80" 
                      alt="Maria Clara" 
                      className="w-14 h-14 rounded-full object-cover border-3 border-white shadow-lg group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white"></div>
                  </div>
                  <div className="ml-4">
                    <div className="font-bold text-gray-900 text-lg">Maria Clara</div>
                    <div className="text-boracume-orange font-semibold text-sm">Pizzaria Bella Vista</div>
                    <div className="text-gray-500 text-xs">São Paulo, SP</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="group bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3 border border-gray-100 relative overflow-hidden">
              {/* Card Background Gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <div className="relative z-10">
                <div className="flex items-center mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-500 fill-current animate-pulse" style={{animationDelay: `${i * 100}ms`}} />
                  ))}
                  <span className="ml-2 text-sm font-semibold text-gray-600">5.0</span>
                </div>
                <blockquote className="text-gray-700 mb-6 text-lg leading-relaxed italic">
                  "Finalmente um sistema que entende restaurante. Reduziu meu desperdício em 60% e aumentou o lucro. Os relatórios são fantásticos!"
                </blockquote>
                <div className="flex items-center">
                  <div className="relative">
                    <img 
                      src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80" 
                      alt="Roberto Silva" 
                      className="w-14 h-14 rounded-full object-cover border-3 border-white shadow-lg group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white"></div>
                  </div>
                  <div className="ml-4">
                    <div className="font-bold text-gray-900 text-lg">Roberto Silva</div>
                    <div className="text-boracume-orange font-semibold text-sm">Hamburgueria do Chef</div>
                    <div className="text-gray-500 text-xs">Rio de Janeiro, RJ</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="group bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3 border border-gray-100 relative overflow-hidden">
              {/* Card Background Gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <div className="relative z-10">
                <div className="flex items-center mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-500 fill-current animate-pulse" style={{animationDelay: `${i * 100}ms`}} />
                  ))}
                  <span className="ml-2 text-sm font-semibold text-gray-600">5.0</span>
                </div>
                <blockquote className="text-gray-700 mb-6 text-lg leading-relaxed italic">
                  "Impressionante como a IA sugere combos que realmente vendem. Meu ticket médio subiu 45%. Recomendo 100%!"
                </blockquote>
                <div className="flex items-center">
                  <div className="relative">
                    <img 
                      src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80" 
                      alt="Ana Ferreira" 
                      className="w-14 h-14 rounded-full object-cover border-3 border-white shadow-lg group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white"></div>
                  </div>
                  <div className="ml-4">
                    <div className="font-bold text-gray-900 text-lg">Ana Ferreira</div>
                    <div className="text-boracume-orange font-semibold text-sm">Restaurante Tempero Caseiro</div>
                    <div className="text-gray-500 text-xs">Belo Horizonte, MG</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Additional Social Proof */}
          <div className="mt-16 text-center">
            <div className="inline-flex items-center bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg border border-gray-200">
              <div className="flex -space-x-2 mr-4">
                <img className="w-8 h-8 rounded-full border-2 border-white" src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80" alt="" />
                <img className="w-8 h-8 rounded-full border-2 border-white" src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80" alt="" />
                <img className="w-8 h-8 rounded-full border-2 border-white" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80" alt="" />
                <div className="w-8 h-8 rounded-full border-2 border-white bg-boracume-orange flex items-center justify-center text-white text-xs font-bold">+997</div>
              </div>
              <span className="text-gray-700 font-semibold">Junte-se a mais de 1.000 restaurantes satisfeitos</span>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-gradient-to-br from-orange-50 to-green-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Por que escolher o BoraCumê?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Não somos apenas mais um sistema. Somos seus parceiros no crescimento.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="bg-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Smartphone className="w-8 h-8 text-boracume-orange" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Mobile First</h3>
              <p className="text-gray-600">Funciona perfeitamente em qualquer dispositivo</p>
            </div>
            <div className="text-center">
              <div className="bg-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Shield className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">100% Seguro</h3>
              <p className="text-gray-600">Seus dados protegidos com criptografia bancária</p>
            </div>
            <div className="text-center">
              <div className="bg-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Clock className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Suporte 24/7</h3>
              <p className="text-gray-600">Equipe especializada sempre disponível</p>
            </div>
            <div className="text-center">
              <div className="bg-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <TrendingUp className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">ROI Garantido</h3>
              <p className="text-gray-600">Retorno do investimento em até 30 dias</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 bg-gradient-to-br from-gray-900 via-gray-800 to-black relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-96 h-96 bg-boracume-orange/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-80 h-80 bg-green-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-boracume-orange/5 to-green-500/5 rounded-full blur-3xl animate-spin" style={{animationDuration: '30s'}}></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center bg-gradient-to-r from-boracume-orange/20 to-orange-600/20 px-4 py-2 rounded-full text-sm font-semibold text-boracume-orange mb-6 border border-boracume-orange/30">
              💰 Planos Especiais
            </div>
            <h2 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-6">
              Planos que cabem no seu bolso e multiplicam seus resultados
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
              Comece grátis e veja a diferença. Depois escolha o plano ideal para seu crescimento.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Plano Básico */}
            <div className="group bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <div className="relative z-10">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-gradient-to-r from-gray-600 to-gray-800 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Zap className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Básico</h3>
                  <p className="text-gray-600 mb-4">Perfeito para começar</p>
                  <div className="mb-6">
                    <div className="flex items-center justify-center">
                      <span className="text-sm text-gray-500 line-through mr-2">R$ 194</span>
                      <span className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">R$ 97</span>
                    </div>
                    <span className="text-gray-600">/mês</span>
                    <div className="mt-2 inline-flex items-center bg-green-100 px-3 py-1 rounded-full text-xs font-semibold text-green-700">
                      50% OFF no 1º mês
                    </div>
                  </div>
                </div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="text-gray-700">PDV completo</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="text-gray-700">Controle de estoque</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="text-gray-700">Relatórios básicos</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="text-gray-700">Suporte por email</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="text-gray-700">Até 1.000 pedidos/mês</span>
                  </li>
                </ul>
                <Link 
                  to="/dashboard" 
                  className="w-full bg-gradient-to-r from-gray-800 to-gray-900 text-white py-4 px-6 rounded-xl font-semibold hover:from-gray-700 hover:to-gray-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center justify-center gap-2 group"
                >
                  <Zap className="w-5 h-5 group-hover:animate-bounce" />
                  Começar Grátis
                </Link>
              </div>
            </div>

            {/* Plano Profissional */}
            <div className="group bg-gradient-to-br from-boracume-orange to-orange-600 rounded-2xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-500 transform hover:-translate-y-3 relative overflow-hidden scale-105">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20">
                <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 px-6 py-2 rounded-full text-sm font-bold shadow-lg animate-pulse">
                  ⭐ Mais Popular
                </div>
              </div>
              
              <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <div className="relative z-10">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Star className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Profissional</h3>
                  <p className="text-orange-100 mb-4">Para restaurantes em crescimento</p>
                  <div className="mb-6">
                    <div className="flex items-center justify-center">
                      <span className="text-sm text-orange-200 line-through mr-2">R$ 394</span>
                      <span className="text-4xl font-bold text-white">R$ 197</span>
                    </div>
                    <span className="text-orange-100">/mês</span>
                    <div className="mt-2 inline-flex items-center bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-white">
                      50% OFF no 1º mês
                    </div>
                  </div>
                </div>
                <ul className="space-y-4 mb-8 text-white">
                  <li className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <span>Tudo do plano Básico</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <span>Integração com delivery</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <span>IA para sugestões de venda</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <span>Relatórios avançados</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <span>Suporte prioritário</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <span>Pedidos ilimitados</span>
                  </li>
                </ul>
                <Link 
                  to="/dashboard" 
                  className="w-full bg-white text-boracume-orange py-4 px-6 rounded-xl font-semibold hover:bg-gray-50 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center justify-center gap-2 group"
                >
                  <Star className="w-5 h-5 group-hover:animate-spin" />
                  Começar Teste Grátis
                </Link>
              </div>
            </div>

            {/* Plano Enterprise */}
            <div className="group bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <div className="relative z-10">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-purple-800 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Award className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Enterprise</h3>
                  <p className="text-gray-600 mb-4">Para redes e franquias</p>
                  <div className="mb-6">
                    <div className="flex items-center justify-center">
                      <span className="text-sm text-gray-500 line-through mr-2">R$ 794</span>
                      <span className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">R$ 397</span>
                    </div>
                    <span className="text-gray-600">/mês</span>
                    <div className="mt-2 inline-flex items-center bg-purple-100 px-3 py-1 rounded-full text-xs font-semibold text-purple-700">
                      50% OFF no 1º mês
                    </div>
                  </div>
                </div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                    </div>
                    <span className="text-gray-700">Tudo do plano Profissional</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                    </div>
                    <span className="text-gray-700">Multi-lojas ilimitadas</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                    </div>
                    <span className="text-gray-700">API personalizada</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                    </div>
                    <span className="text-gray-700">Treinamento da equipe</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                    </div>
                    <span className="text-gray-700">Suporte 24/7 por telefone</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                    </div>
                    <span className="text-gray-700">Consultor de crescimento</span>
                  </li>
                </ul>
                <Link 
                  to="/dashboard" 
                  className="w-full bg-gradient-to-r from-purple-600 to-purple-800 text-white py-4 px-6 rounded-xl font-semibold hover:from-purple-500 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center justify-center gap-2 group"
                >
                  <MessageCircle className="w-5 h-5 group-hover:animate-pulse" />
                  Falar com Consultor
                </Link>
              </div>
            </div>
          </div>
          
          <div className="text-center mt-16">
            <div className="bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border border-white/20 rounded-2xl p-8 max-w-4xl mx-auto">
              <div className="flex items-center justify-center mb-4">
                <div className="text-4xl mr-3">🎉</div>
                <h3 className="text-2xl font-bold text-white">Oferta Especial de Lançamento</h3>
              </div>
              <p className="text-xl text-gray-300 mb-6">
                <strong className="text-boracume-orange">7 dias grátis</strong> + <strong className="text-green-400">50% OFF no primeiro mês</strong> + <strong className="text-blue-400">Setup gratuito</strong>
              </p>
              <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-400">
                <div className="flex items-center justify-center">
                  <Shield className="w-4 h-4 mr-2 text-green-400" />
                  <span>Sem compromisso</span>
                </div>
                <div className="flex items-center justify-center">
                  <Clock className="w-4 h-4 mr-2 text-blue-400" />
                  <span>Cancele quando quiser</span>
                </div>
                <div className="flex items-center justify-center">
                  <Users className="w-4 h-4 mr-2 text-purple-400" />
                  <span>Suporte incluído</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center bg-gradient-to-r from-blue-100 to-purple-100 px-4 py-2 rounded-full text-sm font-semibold text-blue-600 mb-6">
              ❓ Perguntas Frequentes
            </div>
            <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-6">
              Tire Suas Dúvidas
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Respondemos as principais perguntas sobre o BoraCumê
            </p>
          </div>
          
          <div className="space-y-6">
            {/* FAQ Item 1 */}
            <div className="group bg-white border border-gray-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between cursor-pointer">
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-boracume-orange transition-colors">
                  Como funciona o período de teste gratuito?
                </h3>
                <div className="w-8 h-8 bg-gradient-to-r from-boracume-orange to-orange-600 rounded-full flex items-center justify-center">
                  <Plus className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="mt-4 text-gray-600 leading-relaxed">
                Você tem 7 dias para testar todas as funcionalidades do BoraCumê sem pagar nada. Não pedimos cartão de crédito para começar. Após o período, você escolhe o plano que mais se adequa ao seu negócio.
              </div>
            </div>
            
            {/* FAQ Item 2 */}
            <div className="group bg-white border border-gray-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between cursor-pointer">
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-boracume-orange transition-colors">
                  Posso cancelar a qualquer momento?
                </h3>
                <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center">
                  <Plus className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="mt-4 text-gray-600 leading-relaxed">
                Sim! Não há fidelidade ou multa por cancelamento. Você pode cancelar seu plano a qualquer momento através do painel administrativo ou entrando em contato conosco.
              </div>
            </div>
            
            {/* FAQ Item 3 */}
            <div className="group bg-white border border-gray-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between cursor-pointer">
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-boracume-orange transition-colors">
                  O BoraCumê funciona com delivery?
                </h3>
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
                  <Plus className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="mt-4 text-gray-600 leading-relaxed">
                Sim! Temos integração nativa com as principais plataformas de delivery (iFood, Uber Eats, Rappi) e também oferecemos nossa própria solução de delivery para você vender direto ao cliente.
              </div>
            </div>
            
            {/* FAQ Item 4 */}
            <div className="group bg-white border border-gray-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between cursor-pointer">
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-boracume-orange transition-colors">
                  Preciso de equipamentos especiais?
                </h3>
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                  <Plus className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="mt-4 text-gray-600 leading-relaxed">
                Não! O BoraCumê funciona em qualquer dispositivo: computador, tablet ou smartphone. Para impressão de comandas, qualquer impressora térmica comum serve. Oferecemos suporte completo na configuração.
              </div>
            </div>
            
            {/* FAQ Item 5 */}
            <div className="group bg-white border border-gray-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between cursor-pointer">
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-boracume-orange transition-colors">
                  Como funciona o suporte técnico?
                </h3>
                <div className="w-8 h-8 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-full flex items-center justify-center">
                  <Plus className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="mt-4 text-gray-600 leading-relaxed">
                Oferecemos suporte por WhatsApp, email e telefone. No plano Profissional, você tem suporte prioritário. No Enterprise, suporte 24/7 com consultor dedicado. Também temos uma base de conhecimento completa.
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-br from-gray-900 via-boracume-orange to-orange-600 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-yellow-400/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-white/5 to-yellow-400/5 rounded-full blur-3xl animate-spin" style={{animationDuration: '25s'}}></div>
        </div>
        
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="mb-8">
            <div className="inline-flex items-center bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-semibold text-white mb-6 border border-white/30">
              🚀 Última Chance
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight">
              Pronto para Revolucionar seu Restaurante?
            </h2>
            <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto leading-relaxed">
              Junte-se a mais de 1.000 restaurantes que já transformaram seus negócios e aumentaram suas vendas em até 300%
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-12">
            <Link 
              to="/dashboard" 
              className="group bg-white text-boracume-orange px-8 py-4 rounded-2xl font-bold hover:bg-gray-50 transition-all duration-300 shadow-2xl hover:shadow-3xl transform hover:-translate-y-1 flex items-center justify-center gap-3"
            >
              <Rocket className="w-6 h-6 group-hover:animate-bounce" />
              Começar Grátis Agora
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link 
              to="/demo" 
              className="group border-2 border-white text-white px-8 py-4 rounded-2xl font-bold hover:bg-white hover:text-boracume-orange transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 flex items-center justify-center gap-3"
            >
              <Play className="w-6 h-6 group-hover:scale-110 transition-transform" />
              Ver Demo ao Vivo
            </Link>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 text-white/80 text-sm">
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span>7 dias grátis</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Shield className="w-5 h-5 text-blue-400" />
              <span>Sem compromisso</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Clock className="w-5 h-5 text-purple-400" />
              <span>Ativo em 5 minutos</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="text-2xl">🍽️</div>
                <div className="text-2xl font-bold">
                  Bora<span className="text-boracume-green">Cumê</span>
                </div>
              </div>
              <p className="text-gray-400 mb-4">
                O sistema completo para transformar seu restaurante em uma máquina de vendas digital.
              </p>
              <div className="flex space-x-4">
                <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
                  <span className="text-xs">f</span>
                </div>
                <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
                  <span className="text-xs">ig</span>
                </div>
                <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
                  <span className="text-xs">in</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Produto</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/" className="hover:text-white">Funcionalidades</Link></li>
                <li><Link to="/" className="hover:text-white">Preços</Link></li>
                <li><Link to="/" className="hover:text-white">Integrações</Link></li>
                <li><Link to="/" className="hover:text-white">API</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Empresa</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/" className="hover:text-white">Sobre nós</Link></li>
                <li><Link to="/" className="hover:text-white">Blog</Link></li>
                <li><Link to="/" className="hover:text-white">Carreiras</Link></li>
                <li><Link to="/" className="hover:text-white">Imprensa</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Suporte</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/" className="hover:text-white">Central de Ajuda</Link></li>
                <li><Link to="/" className="hover:text-white">Contato</Link></li>
                <li><Link to="/" className="hover:text-white">WhatsApp</Link></li>
                <li><Link to="/" className="hover:text-white">Status</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              © 2024 BoraCumê. Todos os direitos reservados.
            </p>
            <div className="flex space-x-6 text-sm text-gray-400 mt-4 md:mt-0">
              <Link to="/" className="hover:text-white">Privacidade</Link>
              <Link to="/" className="hover:text-white">Termos</Link>
              <Link to="/" className="hover:text-white">Cookies</Link>
            </div>
          </div>
        </div>
      </footer>
=======
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/dashboard', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-boracume-light">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">BoraCumê</h1>
        <p className="text-xl text-gray-600">Redirecionando...</p>
      </div>
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
    </div>
  );
};

export default Index;
