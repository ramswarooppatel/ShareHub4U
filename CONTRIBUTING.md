# Contributing to ShareHub4U

Thank you for your interest in contributing to ShareHub4U! We welcome contributions from the community.

## How to Contribute

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Create a feature branch** from `main`
4. **Make your changes**
5. **Test your changes** thoroughly
6. **Commit your changes** with clear commit messages
7. **Push to your fork**
8. **Create a Pull Request** to the main repository

## Development Setup

See the [README.md](README.md) for detailed setup instructions.

## Code Style

- Use TypeScript for all new code
- Follow the existing code style and conventions
- Use meaningful variable and function names
- Add comments for complex logic
- Ensure all code is properly typed

## Testing

- Test your changes in different browsers
- Test on different screen sizes
- Ensure real-time features work correctly
- Test file upload/download functionality

## Database Changes

If you need to make database schema changes:

1. Create a new migration file in `supabase/migrations/`
2. Update the `schema.sql` file to reflect the changes
3. Test the migration on a development database

## API Rules

- All database operations must use proper RLS policies
- Never bypass security checks
- Handle errors gracefully
- Use the Supabase client for all database interactions

## Pull Request Guidelines

- Provide a clear description of the changes
- Reference any related issues
- Ensure CI checks pass
- Request review from maintainers

## Issues

- Use GitHub issues to report bugs or request features
- Provide detailed steps to reproduce bugs
- Include browser/OS information when reporting issues

## Code of Conduct

Please be respectful and constructive in all interactions. We follow a code of conduct to ensure a positive community environment.

Thank you for contributing to ShareHub4U!