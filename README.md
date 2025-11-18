# Telemedicine ABC

> SMS-to-phone telemedicine platform connecting patients with healthcare providers

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Wasp](https://img.shields.io/badge/Built%20with-Wasp-orange)](https://wasp-lang.dev)

> **Note**: This repository was created from [telemedicine-abc-wasp](https://github.com/Manoj-nathwani/telemedicine-abc-wasp) with a fresh commit history for open source release. For the full development history, see the original repository.

## Overview

Telemedicine ABC connects patients with qualified healthcare professionals through a simple SMS-to-phone consultation workflow. Patients send text messages describing their symptoms and receive phone consultations from licensed clinicians.

### For Patients 👥
- Send SMS with symptoms → Get free phone consultation
- No internet or app installation required
- Completely free service

### For Healthcare Providers 🏥
- Review SMS requests on web dashboard
- Schedule and conduct phone consultations
- Track patient history and outcomes
- Send follow-up SMS with prescriptions/advice

## Quick Start

**Prerequisites**: Node.js v20+, Docker Desktop, [Wasp CLI](https://wasp-lang.dev/docs/quick-start)

```bash
git clone <your-repo-url>
cd telemedicine-abc-wasp
npm install
cp .env.server.example .env.server
cp .env.client.example .env.client
npm run setup && npm run dev
```

Visit http://localhost:3000

**Test Accounts**: `admin@example.com`, `sarah@example.com`, `michael@example.com` (all use `password123`)

**Important Notes**:
- Always use `--run` flag for tests: `wasp test client --run`
- Use `wasp` commands directly (not `npm run build` or `npm start`)
- See `src/utils/dateTime.ts` for timezone handling (UTC storage, consistent display)

### Running Tests
```bash
# Run all tests
npm test

# Run end-to-end tests with Playwright
npx playwright test

# Run Playwright tests with visible browser
npx playwright test --headed

# Run specific test file
npx playwright test tests/landing-page.test.js
```

### Test Accounts
```
Admin:     admin@example.com / password123
Admin:     sarah@example.com / password123  
Clinician: michael@example.com / password123
```
*Note: These are example test accounts. Replace with your own test accounts in production.*

## How It Works

```
📱 Patient SMS → 🔍 Provider Triage → ✅ Accept → 📞 Phone Consultation → 💊 Follow-up SMS
```

1. Patient texts symptoms to system
2. Healthcare provider reviews on `/triage` dashboard
3. Provider accepts request and system schedules consultation
4. Provider calls patient at scheduled time
5. Provider records outcome and sends follow-up SMS if needed

## Documentation

- 🏗️ **[Architecture](ARCHITECTURE.md)** - System design and data flow
- 🔗 **[API Documentation](API.md)** - External SMS service integration
- 🚀 **[Deployment Guide](DEPLOYMENT.md)** - Deploy to Google Cloud + Cloudflare

## Technology Stack

- **Framework**: [Wasp](https://wasp-lang.dev) (React + Node.js)
- **Frontend**: React, TypeScript, Bootstrap 5
- **Backend**: Node.js, Prisma ORM
- **Database**: PostgreSQL (Google Cloud SQL)
- **Deployment**: Google Cloud Run (server), Cloudflare Pages (client)

## Language Support

The platform supports **English and French** for the healthcare provider web dashboard interface. Clinicians can switch between these languages using the language selector in the interface.

SMS templates sent to patients are configurable via the Admin Config page and can contain content in any language, but the provider interface itself is limited to English and French.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

This project is open source thanks to generous support from:

- **[ACX Grants Results 2025](https://www.astralcodexten.com/p/acx-grants-results-2025)**
- **[Open Philanthropy](https://www.openphilanthropy.org/)**

## Support

For issues and questions, see [ARCHITECTURE.md](ARCHITECTURE.md), [DEPLOYMENT.md](DEPLOYMENT.md), or create a GitHub issue.
