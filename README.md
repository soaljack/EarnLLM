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

## Getting Started

This project is designed for developers who want to run their own LLM monetization service. For detailed instructions on how to set up your local development environment, clone the repository, and seed your database, please see our comprehensive developer's guide:

**[➡️ Developer's Guide](./docs/DEVELOPMENT.md)**

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL with Sequelize ORM
- **Rate Limiting**: Redis
- **Testing**: Jest
- **Authentication**: Custom API Key strategy

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
