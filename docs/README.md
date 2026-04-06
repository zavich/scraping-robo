# Documentação Técnica e Funcional do Projeto

## Visão Geral

Este projeto é uma API desenvolvida com o framework NestJS, projetada para realizar scraping de dados e gerenciar filas de processamento. Ele utiliza tecnologias como Redis, Puppeteer e BullMQ para lidar com tarefas assíncronas e processamento em massa.

## Estrutura do Projeto

A estrutura do projeto segue as melhores práticas do NestJS, com módulos, serviços, controladores e provedores bem definidos. Aqui está uma visão geral:

- **src/**: Contém o código-fonte principal.
  - **app.module.ts**: Módulo raiz da aplicação.
  - **connection/**: Gerencia conexões externas, como Redis.
  - **guards/**: Contém guardas de autenticação e autorização.
  - **helpers/**: Funções auxiliares reutilizáveis.
  - **interfaces/**: Definições de tipos e enums.
  - **modules/**: Contém os módulos principais da aplicação, como `pje`, `receita-federal`, `users`, etc.
  - **providers/**: Provedores dinâmicos para criação de workers e filas.
  - **services/**: Serviços compartilhados, como AWS S3 e Captcha.
  - **utils/**: Utilitários gerais, como manipulação de strings e validações de data.
- **test/**: Contém testes end-to-end.
- **docs/**: Pasta para documentação (esta pasta).

## Dependências Principais

- **NestJS**: Framework para construção de aplicações Node.js escaláveis.
- **BullMQ**: Gerenciamento de filas.
- **Redis**: Armazenamento em memória para filas e cache.
- **Puppeteer**: Automação de navegadores para scraping.
- **Tesseract.js**: Reconhecimento óptico de caracteres (OCR).

## Configuração e Execução

### Pré-requisitos

- Node.js (v18 ou superior)
- Redis
- Docker (opcional, para execução em contêineres)

### Instalação

```bash
npm install
```

### Execução

#### Desenvolvimento

```bash
npm run start:dev
```

#### Produção

```bash
npm run build
npm run start:prod
```

### Testes

```bash
npm run test
npm run test:e2e
```

## Arquitetura

### Módulos

- **PJE**: Gerencia processos judiciais eletrônicos.
- **Receita Federal**: Realiza scraping de dados da Receita Federal.
- **Webhooks**: Gerencia notificações externas.

### Provedores Dinâmicos

Os provedores dinâmicos criam workers para filas específicas, como `processos-trt` e `documentos-trt`. Eles utilizam decorators do BullMQ para configurar filas com limites de concorrência e duração de bloqueio.

### Serviços

- **ScrapingService**: Realiza scraping de dados.
- **CaptchaService**: Resolve captchas.
- **AwsS3Service**: Gerencia uploads para o AWS S3.

## Docker

O projeto inclui um `Dockerfile` e um `docker-compose.yaml` para facilitar a execução em contêineres. Certifique-se de configurar as variáveis de ambiente corretamente.

### Construção e Execução

```bash
docker-compose up --build
```

## Contribuição

1. Faça um fork do repositório.
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`).
3. Faça commit das suas alterações (`git commit -m 'Adiciona nova feature'`).
4. Faça push para a branch (`git push origin feature/nova-feature`).
5. Abra um Pull Request.

## Licença

Este projeto está licenciado sob a licença MIT.
