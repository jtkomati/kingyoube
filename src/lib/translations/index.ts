import type { Language } from '@/contexts/LanguageContext';

export const translations: Record<Language, {
  common: Record<string, string>;
  sidebar: Record<string, string>;
}> = {
  pt: {
    common: {
      search: 'Buscar...',
      logout: 'Sair',
      permission: 'Permissão',
      menu: 'Menu',
    },
    sidebar: {
      accountantPortal: 'Portal Contador',
      aiAgents: 'Agentes de IA',
      dashboard: 'Dashboard',
      cfoCockpit: 'Cockpit CFO',
      cadastros: 'Cadastros',
      transactions: 'Transações',
      invoices: 'Notas Fiscais',
      reports: 'Relatórios',
      predictiveAnalytics: 'Análise Preditiva',
      integrations: 'Integrações',
      taxReform: 'Reforma Tributária',
      observability: 'Observabilidade',
      aiCommandCenter: 'AI Command Center',
    },
  },
  en: {
    common: {
      search: 'Search...',
      logout: 'Logout',
      permission: 'Permission',
      menu: 'Menu',
    },
    sidebar: {
      accountantPortal: 'Accountant Portal',
      aiAgents: 'AI Agents',
      dashboard: 'Dashboard',
      cfoCockpit: 'CFO Cockpit',
      cadastros: 'Records',
      transactions: 'Transactions',
      invoices: 'Invoices',
      reports: 'Reports',
      predictiveAnalytics: 'Predictive Analytics',
      integrations: 'Integrations',
      taxReform: 'Tax Reform',
      observability: 'Observability',
      aiCommandCenter: 'AI Command Center',
    },
  },
  es: {
    common: {
      search: 'Buscar...',
      logout: 'Salir',
      permission: 'Permiso',
      menu: 'Menú',
    },
    sidebar: {
      accountantPortal: 'Portal Contador',
      aiAgents: 'Agentes de IA',
      dashboard: 'Panel',
      cfoCockpit: 'Cockpit CFO',
      cadastros: 'Registros',
      transactions: 'Transacciones',
      invoices: 'Facturas',
      reports: 'Informes',
      predictiveAnalytics: 'Análisis Predictivo',
      integrations: 'Integraciones',
      taxReform: 'Reforma Fiscal',
      observability: 'Observabilidad',
      aiCommandCenter: 'Centro de IA',
    },
  },
  de: {
    common: {
      search: 'Suchen...',
      logout: 'Abmelden',
      permission: 'Berechtigung',
      menu: 'Menü',
    },
    sidebar: {
      accountantPortal: 'Buchhalterportal',
      aiAgents: 'KI-Agenten',
      dashboard: 'Dashboard',
      cfoCockpit: 'CFO-Cockpit',
      cadastros: 'Stammdaten',
      transactions: 'Transaktionen',
      invoices: 'Rechnungen',
      reports: 'Berichte',
      predictiveAnalytics: 'Prädiktive Analyse',
      integrations: 'Integrationen',
      taxReform: 'Steuerreform',
      observability: 'Observabilität',
      aiCommandCenter: 'KI-Zentrale',
    },
  },
  fr: {
    common: {
      search: 'Rechercher...',
      logout: 'Déconnexion',
      permission: 'Permission',
      menu: 'Menu',
    },
    sidebar: {
      accountantPortal: 'Portail Comptable',
      aiAgents: 'Agents IA',
      dashboard: 'Tableau de bord',
      cfoCockpit: 'Cockpit CFO',
      cadastros: 'Registres',
      transactions: 'Transactions',
      invoices: 'Factures',
      reports: 'Rapports',
      predictiveAnalytics: 'Analyse Prédictive',
      integrations: 'Intégrations',
      taxReform: 'Réforme Fiscale',
      observability: 'Observabilité',
      aiCommandCenter: 'Centre de Commande IA',
    },
  },
  ja: {
    common: {
      search: '検索...',
      logout: 'ログアウト',
      permission: '権限',
      menu: 'メニュー',
    },
    sidebar: {
      accountantPortal: '会計士ポータル',
      aiAgents: 'AIエージェント',
      dashboard: 'ダッシュボード',
      cfoCockpit: 'CFOコックピット',
      cadastros: '登録',
      transactions: '取引',
      invoices: '請求書',
      reports: 'レポート',
      predictiveAnalytics: '予測分析',
      integrations: '統合',
      taxReform: '税制改革',
      observability: 'オブザーバビリティ',
      aiCommandCenter: 'AIコマンドセンター',
    },
  },
};

export function t(language: Language, section: keyof typeof translations['pt'], key: string): string {
  return translations[language]?.[section]?.[key] || translations['pt'][section]?.[key] || key;
}
