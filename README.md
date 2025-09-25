# Livraria-CEPAL

Este é um projeto full-stack de um sistema de venda de livros para a BIENAL. A maior feira de livros do país, dividido em um backend de Node.js com Express e um frontend de React com Vite.

## Backend

O backend é responsável pela API do sistema, gerenciamento de dados e comunicação com o banco de dados.

### Tecnologias Utilizadas

* **Node.js**: Ambiente de execução do JavaScript no servidor.
* **Express**: Framework para construção de APIs.
* **PostgreSQL**: Banco de dados relacional.
* **pg**: Driver do PostgreSQL para Node.js.
* **cors**: Middleware para habilitar o CORS (Cross-Origin Resource Sharing).
* **cookie-parser**: Middleware para analisar os cookies das requisições.
* **csv-parser**: Módulo para fazer o parsing de arquivos CSV.
* **dotenv**: Módulo para carregar variáveis de ambiente a partir de um arquivo `.env`.
* **nodemon**: Ferramenta que reinicia o servidor automaticamente durante o desenvolvimento.

### Como Rodar

1.  **Instale as dependências:**
    ```bash
    npm install
    ```

2.  **Inicie o servidor em modo de desenvolvimento:**
    ```bash
    npm run dev
    ```

3.  **Inicie o servidor em modo de produção:**
    ```bash
    npm start
    ```

### Scripts Disponíveis

* `npm test`: Exibe uma mensagem de erro, pois não há testes configurados.
* `npm start`: Inicia o servidor em modo de produção.
* `npm run dev`: Inicia o servidor em modo de desenvolvimento com o nodemon.

## Frontend

O frontend é a interface do usuário, construída com React e estilizada com Material-UI.

### Tecnologias Utilizadas

* **React**: Biblioteca para construção de interfaces de usuário.
* **Vite**: Ferramenta de build para o frontend.
* **Material-UI**: Biblioteca de componentes React para um design mais rápido e fácil.
* **axios**: Cliente HTTP para fazer requisições à API do backend.
* **jsPDF**: Biblioteca para gerar PDFs no lado do cliente.
* **React Router**: Para o roteamento de páginas na aplicação.
* **ESLint**: Ferramenta de linting para o código JavaScript.

### Como Rodar

1.  **Instale as dependências:**
    ```bash
    npm install
    ```

2.  **Inicie o servidor de desenvolvimento:**
    ```bash
    npm run dev
    ```

### Scripts Disponíveis

* `npm run dev`: Inicia o servidor de desenvolvimento do Vite.
* `npm run build`: Compila a aplicação para produção.
* `npm run lint`: Executa o linter no código.
* `npm run preview`: Inicia um servidor local para visualizar a build de produção.
