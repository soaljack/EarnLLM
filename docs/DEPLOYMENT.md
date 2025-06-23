# Production Deployment Checklist

This guide provides a step-by-step checklist for deploying the EarnLLM application to a production environment. Follow these steps carefully to ensure a secure, stable, and performant deployment.

---

### 1. Server & Environment Setup

- [ ] **Provision Server**: Set up a virtual private server (VPS) or a cloud instance (e.g., AWS EC2, DigitalOcean Droplet) with a modern Linux distribution (e.g., Ubuntu 22.04 LTS).
- [ ] **Install Node.js**: Install a specific LTS version of Node.js (e.g., v18.x or v20.x). Use a version manager like `nvm` to manage Node.js versions.
- [ ] **Install PostgreSQL**: Install and configure a PostgreSQL server. Create a dedicated database and user for the application.
- [ ] **Install Redis**: Install and configure a Redis server for rate limiting.
- [ ] **Install PM2**: Install PM2 globally to manage the Node.js process: `npm install pm2 -g`.
- [ ] **Configure Firewall**: Set up a firewall (e.g., `ufw`) to allow traffic only on necessary ports (e.g., 22 for SSH, 80 for HTTP, 443 for HTTPS).

### 2. Code & Configuration

- [ ] **Clone Repository**: Clone the application source code from the Git repository.
- [ ] **Install Dependencies**: Install only production dependencies: `npm install --production`.
- [ ] **Create `.env` File**: Create a `.env` file in the project root and populate it with production-ready values. **NEVER commit this file to version control.**
    ```env
    # Application Environment
    NODE_ENV=production
    PORT=3000

    # Database
    DB_HOST=localhost
    DB_PORT=5432
    DB_USER=your_prod_db_user
    DB_PASSWORD=your_prod_db_password
    DB_NAME=earnllm_prod

    # Security
    JWT_SECRET=a_very_strong_and_long_random_secret_string

    # External APIs
    OPENAI_API_KEY=sk-your_real_openai_api_key
    STRIPE_SECRET_KEY=sk_live_your_real_stripe_secret_key
    STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_signing_secret

    # Frontend URL
    FRONTEND_URL=https://your-domain.com
    ```

### 3. Database Migration & Seeding

- [ ] **Run Migrations**: Apply all database migrations to set up the schema: `npx sequelize-cli db:migrate --env production`.
- [ ] **Seed Initial Data**:
    - [ ] Seed the default pricing plans: `npm run seed:plans`.
    - [ ] Seed the supported LLM models: `npm run seed:models`.

### 4. Application Start & Process Management

- [ ] **Start Application with PM2**: Start the application using PM2 to ensure it runs in the background and restarts automatically on failure.
    ```bash
    pm2 start src/app.js --name earnllm-api
    ```
- [ ] **Save PM2 Configuration**: Save the process list so it automatically restarts on server reboot: `pm2 save`.

### 5. Web Server & HTTPS

- [ ] **Set Up Reverse Proxy**: Configure a web server like Nginx or Caddy to act as a reverse proxy. This will forward traffic from port 80/443 to the application's port (e.g., 3000).
- [ ] **Enable HTTPS**: Obtain and install an SSL/TLS certificate to enable HTTPS. Services like Let's Encrypt provide free certificates.

### 6. Final Checks & Monitoring

- [ ] **Stripe Webhook**: In your Stripe dashboard, configure the webhook endpoint to point to your production URL: `https://your-domain.com/api/billing/webhook`. Ensure you are using the correct webhook signing secret.
- [ ] **Security Audit**: Run a production security audit to check for vulnerabilities in dependencies: `npm audit --production`.
- [ ] **Smoke Testing**: Perform manual tests on key API endpoints (e.g., user registration, login, chat completion, subscription creation) to ensure everything is working as expected.
- [ ] **Logging**: Verify that production logs (in JSON format) are being correctly written to the console or a log file, ready to be ingested by a logging service.
- [ ] **Monitoring**: Set up basic monitoring for the server's CPU, memory, and disk usage, as well as for the application's health and response times.
