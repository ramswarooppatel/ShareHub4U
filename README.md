# ShareHub4U

A modern, real-time file sharing and collaboration platform built with React, TypeScript, and Supabase. ShareHub4U allows users to create rooms for secure file sharing, collaborative markdown editing, and real-time communication.

## Features

- **Real-time Collaboration**: Create rooms for instant file sharing and markdown editing
- **Secure Access Control**: Public, private, locked, and private key rooms
- **Anonymous Participation**: Allow anonymous users to join rooms
- **File Management**: Upload, preview, and manage files in rooms
- **Markdown Editor**: Collaborative markdown editing with real-time updates
- **Device Tracking**: Track participants across devices
- **Pro Features**: Unlimited rooms with pro codes
- **Responsive Design**: Modern UI built with Tailwind CSS and shadcn/ui

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Supabase (PostgreSQL, Real-time, Storage, Auth)
- **UI**: Tailwind CSS, shadcn/ui components
- **State Management**: React hooks
- **Build Tool**: Vite

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project

### Installation

1. Clone the repository:
```bash
git clone https://github.com/ramswarooppatel/ShareHub4U.git
cd ShareHub4U
```

2. Install dependencies:
```bash
npm install
```

3. Set up Supabase:
   - Create a new Supabase project
   - Run the schema.sql file in your Supabase SQL editor
   - Update the Supabase client configuration in `src/integrations/supabase/client.ts`

4. Configure environment variables:
   - Copy `.env.example` to `.env.local`
   - Add your Supabase URL and anon key

5. Start the development server:
```bash
npm run dev
```

## Database Schema

The complete database schema is available in `schema.sql`. It includes tables for users, rooms, participants, files, join requests, markdown notes, and pro codes.

## API Rules

All database operations use Row Level Security (RLS) policies to ensure secure access control. See the schema.sql file for detailed policies.

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions, please open an issue on GitHub.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS


To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
