# Guia de Desenvolvimento

Este guia estabelece os padrões e práticas recomendadas para o desenvolvimento neste projeto. Siga estas diretrizes para garantir consistência, qualidade e manutenibilidade do código.

## Premissas Básicas

- **Atualização de Documentação**: Sempre que uma nova feature for criada, o desenvolvedor deve garantir que a documentação na pasta `docs` foi devidamente atualizada antes de abrir uma Pull Request (PR).
- **Qualidade do Código**: Todo código deve ser limpo, bem documentado e seguir os padrões estabelecidos neste guia.

## Estrutura de Código

### Organização de Pastas

- **Módulos**: Cada funcionalidade deve ser encapsulada em um módulo dentro de `src/modules`.
- **Serviços**: Lógica de negócios deve ser implementada em serviços dentro de `src/modules/<modulo>/services`.
- **Controladores**: Pontos de entrada da API devem ser definidos em controladores dentro de `src/modules/<modulo>`.
- **Provedores**: Provedores dinâmicos devem ser definidos em `src/providers`.
- **Utils**: Funções auxiliares genéricas devem ser colocadas em `src/utils`.

### Nomeação

- Use nomes descritivos e consistentes para arquivos, classes, métodos e variáveis.
- Arquivos devem ser nomeados em `kebab-case`.
- Classes e interfaces devem usar `PascalCase`.
- Métodos e variáveis devem usar `camelCase`.

### Padrões de Código

- Siga as regras definidas no ESLint e Prettier.
- Utilize TypeScript para tipagem estática.
- Sempre escreva testes para novas funcionalidades.

## Desenvolvimento de Features

### Passos para Criar uma Nova Feature

1. **Planejamento**:
   - Entenda os requisitos da feature.
   - Planeje a estrutura do código e os módulos necessários.

2. **Implementação**:
   - Crie um branch para a feature (`git checkout -b feature/nome-da-feature`).
   - Desenvolva a funcionalidade seguindo os padrões estabelecidos.

3. **Testes**:
   - Escreva testes unitários e end-to-end para a feature.
   - Certifique-se de que todos os testes existentes continuam passando.

4. **Documentação**:
   - Atualize ou crie a documentação relevante na pasta `docs`.

5. **Pull Request**:
   - Abra uma PR detalhando as mudanças realizadas.
   - Certifique-se de que a PR está alinhada com os padrões do projeto.

### Boas Práticas

- **Reutilização de Código**: Sempre que possível, reutilize serviços e utilitários existentes.
- **Injeção de Dependências**: Utilize o sistema de injeção de dependências do NestJS para gerenciar serviços.
- **Tratamento de Erros**: Garanta que erros sejam tratados adequadamente e logados.
- **Logs**: Utilize o sistema de logging para registrar informações importantes.

## Testes

- **Cobertura**: Certifique-se de que o código possui cobertura de testes adequada.
- **Ferramentas**: Utilize o Jest para testes unitários e end-to-end.
- **Execução**:
  ```bash
  npm run test
  npm run test:e2e
  npm run test:cov
  ```

## Integração Contínua

- Certifique-se de que o pipeline de CI/CD está passando antes de abrir uma PR.
- Resolva quaisquer problemas apontados pelo ESLint, Prettier ou testes automatizados.

## Revisão de Código

- **Checklist para Revisão**:
  - O código segue os padrões estabelecidos?
  - A funcionalidade está bem testada?
  - A documentação foi atualizada?
  - O código é limpo e fácil de entender?

## Ferramentas e Dependências

- **Redis**: Utilizado para filas e cache.
- **BullMQ**: Gerenciamento de filas.
- **Puppeteer**: Automação de navegadores.
- **Tesseract.js**: OCR para reconhecimento de texto.
- **AWS S3**: Armazenamento de arquivos.

## Atualização de Dependências

- Sempre atualize as dependências de forma controlada.
- Teste o projeto após qualquer atualização de dependência.

## Conclusão

Seguindo este guia, garantimos que o projeto se mantenha consistente, escalável e fácil de manter. Se tiver dúvidas, consulte a documentação ou entre em contato com o time responsável.
