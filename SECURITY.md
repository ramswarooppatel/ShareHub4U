# Security Policy

## Supported Versions

We actively support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in ShareHub4U, please report it to us as follows:

1. **Do not** create a public GitHub issue for the vulnerability
2. Email security concerns to [pychunk.gov@gmail.com] 
3. Include detailed information about the vulnerability:
   - Description of the issue
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will acknowledge receipt within 48 hours and provide a more detailed response within 7 days indicating our next steps.

## Security Considerations

- All user data is stored securely in Supabase with Row Level Security
- File uploads are handled through Supabase Storage with proper access controls
- Authentication is managed through Supabase Auth
- Real-time features use Supabase's secure WebSocket connections

## Responsible Disclosure

We kindly ask that you:

- Give us reasonable time to fix the issue before public disclosure
- Avoid accessing or modifying user data
- Do not perform DoS attacks or degrade service performance
- Do not spam our systems

We appreciate your help in keeping ShareHub4U and our users safe!
