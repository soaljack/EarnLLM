# EarnLLM

[![CI Status](https://github.com/soaljack/EarnLLM/actions/workflows/ci.yml/badge.svg)](https://github.com/soaljack/EarnLLM/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

EarnLLM is a powerful, self-hostable API service designed to help developers monetize and manage access to Large Language Models (LLMs). It provides a flexible and scalable platform for offering tiered access, tracking usage, and handling billing for your AI-powered applications.

## Key Features

- **API Key Management**: Securely generate, manage, and revoke API keys.
- **Rate Limiting**: Protect your services from abuse with configurable, plan-based rate limits.
- **Usage Tracking**: Monitor token usage and API calls per user and model.
- **Tiered Pricing Plans**: Easily define and assign different access levels (e.g., Free, Pro, Pay-as-you-go).
- **Bring Your Own Model (BYOM)**: Integrate and offer access to your own hosted models alongside standard ones like GPT-4.
- **Extensible**: Built with a modular architecture using Node.js, Express, and Sequelize.

## Project Status

**Stable**. The core architecture has been refactored for stability and scalability. The integration test suite is robust and all database models are now managed by Sequelize migrations, ensuring a reliable and reproducible setup.

## Getting Started

This project is designed for developers who want to run their own LLM monetization service. For detailed instructions on how to set up your local development environment, clone the repository, and run the database migrations, please see our comprehensive developer's guide:

**[➡️ Developer's Guide](./docs/DEVELOPMENT.md)**

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL with Sequelize ORM and a full migration suite.
- **Rate Limiting**: Redis (with in-memory fallback for development).
- **Testing**: Jest, with a stable integration test suite running against a real test database.
- **Authentication**: JWT for user sessions and a custom API Key strategy for service access.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
