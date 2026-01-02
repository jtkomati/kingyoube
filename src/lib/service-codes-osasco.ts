// Serviços mapeados dos CNAEs da KingYouBe para LC 116/2003
// Alíquota ISS Osasco: 2%

export interface ServiceCode {
  code: string;
  cnae: string;
  description: string;
  category: string;
  aliquota: number;
}

export const SERVICE_CODES_OSASCO: ServiceCode[] = [
  // Grupo 1 - Informática e Tecnologia
  {
    code: "1.01",
    cnae: "62.01-5-01",
    description: "Análise e desenvolvimento de sistemas de computadores",
    category: "Informática",
    aliquota: 2,
  },
  {
    code: "1.03",
    cnae: "63.19-4-00",
    description: "Processamento, armazenamento ou hospedagem de dados, textos, imagens, vídeos, páginas eletrônicas, aplicativos e sistemas de informação",
    category: "Informática",
    aliquota: 2,
  },
  {
    code: "1.04",
    cnae: "62.02-3-00",
    description: "Elaboração de programas de computadores, inclusive de jogos eletrônicos (desenvolvimento de software sob encomenda)",
    category: "Informática",
    aliquota: 2,
  },
  {
    code: "1.05",
    cnae: "62.03-1-00",
    description: "Licenciamento ou cessão de direito de uso de programas de computação (desenvolvimento e licenciamento de software não-customizado)",
    category: "Informática",
    aliquota: 2,
  },
  {
    code: "1.06",
    cnae: "62.04-0-00",
    description: "Assessoria e consultoria em informática",
    category: "Informática",
    aliquota: 2,
  },
  
  // Grupo 8 - Educação e Treinamento
  {
    code: "8.02",
    cnae: "85.99-6-03",
    description: "Instrução, treinamento, orientação pedagógica e educacional, avaliação de conhecimentos de qualquer natureza (treinamento em informática)",
    category: "Educação",
    aliquota: 2,
  },
  {
    code: "8.02",
    cnae: "85.99-6-04",
    description: "Instrução, treinamento, orientação pedagógica e educacional, avaliação de conhecimentos de qualquer natureza (treinamento em desenvolvimento profissional e gerencial)",
    category: "Educação",
    aliquota: 2,
  },
  
  // Grupo 10 - Intermediação e Agenciamento
  {
    code: "10.02",
    cnae: "74.90-1-04",
    description: "Agenciamento, corretagem ou intermediação de títulos em geral, valores mobiliários e contratos quaisquer",
    category: "Intermediação",
    aliquota: 2,
  },
  
  // Grupo 17 - Apoio Técnico e Administrativo
  {
    code: "17.01",
    cnae: "70.20-4-00",
    description: "Assessoria ou consultoria de qualquer natureza, não contida em outros itens desta lista (atividades de consultoria em gestão empresarial)",
    category: "Consultoria",
    aliquota: 2,
  },
  {
    code: "17.02",
    cnae: "82.11-3-00",
    description: "Datilografia, digitação, estenografia, expediente, secretaria em geral, resposta audível, redação, edição, interpretação, revisão, tradução, apoio e infraestrutura administrativa e congêneres",
    category: "Apoio Administrativo",
    aliquota: 2,
  },
];

// Agrupar por categoria para o dropdown
export const SERVICE_CODES_BY_CATEGORY = SERVICE_CODES_OSASCO.reduce((acc, service) => {
  if (!acc[service.category]) {
    acc[service.category] = [];
  }
  acc[service.category].push(service);
  return acc;
}, {} as Record<string, ServiceCode[]>);

// Obter categorias únicas
export const SERVICE_CATEGORIES = Object.keys(SERVICE_CODES_BY_CATEGORY);

// Buscar serviço por código
export function findServiceByCode(code: string): ServiceCode | undefined {
  return SERVICE_CODES_OSASCO.find(s => s.code === code);
}

// Buscar serviços por texto (código, descrição ou CNAE)
export function searchServices(query: string): ServiceCode[] {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return SERVICE_CODES_OSASCO;
  
  return SERVICE_CODES_OSASCO.filter(service => 
    service.code.toLowerCase().includes(normalizedQuery) ||
    service.description.toLowerCase().includes(normalizedQuery) ||
    service.cnae.toLowerCase().includes(normalizedQuery) ||
    service.category.toLowerCase().includes(normalizedQuery)
  );
}
