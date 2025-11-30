# Security Policy

## Supported Versions

We actively support security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1.0 | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability, please follow these steps:

### How to Report

1. **Do NOT** open a public GitHub issue for security vulnerabilities
2. Email security details to: [logicstamp.dev@gmail.com](mailto:logicstamp.dev@gmail.com)
   - Include "[SECURITY]" in the subject line for faster processing
   - If you don't receive a response within 48 hours, please follow up
3. Include the following information:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)
   - Your contact information (optional, but helpful for follow-up questions)

### What to Expect

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution Timeline**: Depends on severity and complexity
- **Public Disclosure**: After the vulnerability is patched and users have had time to update

### Security Best Practices

When using this MCP server, please follow these security guidelines:

#### 1. Path Validation

The MCP server validates `projectPath` parameters to ensure they are within allowed directories. However, you should:

- Only run the MCP server with trusted MCP clients
- Review MCP server configurations before use
- Avoid using absolute paths from untrusted sources

#### 2. Bundle Size Limits

- The server implements bundle size limits to prevent out-of-memory (OOM) attacks
- Large codebases may require multiple snapshot operations
- Monitor memory usage when analyzing very large projects

#### 3. Read-Only Operations

- The MCP server is **read-only** by design - it never modifies your project files
- All file modifications are handled by the MCP client (IDE), not the server
- This reduces the attack surface significantly

#### 4. Snapshot Management

- Snapshots are stored in memory and auto-expire after 1 hour
- Old snapshots are automatically cleaned up
- No persistent storage of sensitive code data

#### 5. Dependency Security

- Keep dependencies up to date: `npm audit` and `npm update`
- Review dependency changes before updating
- The server uses minimal dependencies to reduce attack surface

#### 6. Configuration Security

- **Never commit sensitive paths** in `.mcp.json` or `.claude.json` files
- Use global configuration (`~/.claude.json` or `~/.cursor/mcp.json`) for personal setups
- Review project-level MCP configurations before committing to git
- Be cautious when sharing MCP configurations with absolute paths

#### 7. Network Security

- The MCP server communicates via stdio (standard input/output)
- No network ports are opened
- All communication is local to your machine

#### 8. Code Execution

- The server shells out to the `stamp` CLI command
- Ensure the `stamp` command is from a trusted source
- Verify `logicstamp-context` CLI installation: `stamp --version`
- Only install packages from trusted npm registries

### Known Security Considerations

#### Path Traversal Protection

The server validates project paths, but users should:
- Avoid passing untrusted `projectPath` values
- Use relative paths when possible
- Validate paths in MCP client configurations

#### Resource Limits

- Token budgets cap total tokens per request
- Bundle size limits prevent OOM attacks
- Snapshot TTL auto-expires old snapshots

#### Information Disclosure

- The server reads and analyzes your codebase
- Only use with trusted MCP clients
- Review what information is exposed through component contracts
- Be aware that style metadata (Tailwind classes, colors) may reveal design system details

### Security Updates

Security updates will be:
- Released as patch versions (e.g., 0.1.1, 0.1.2)
- Documented in CHANGELOG.md (if applicable)
- Announced via GitHub releases
- Prioritized over feature updates

### Dependency Vulnerabilities

If you discover a vulnerability in a dependency:

1. Check if it affects this project's usage
2. Report via email to [logicstamp.dev@gmail.com](mailto:logicstamp.dev@gmail.com) with "[SECURITY]" in the subject
3. We will update dependencies promptly
4. Monitor `npm audit` for known vulnerabilities

### Responsible Disclosure

We follow responsible disclosure practices:

- **Private reporting** - Vulnerabilities are reported privately first
- **Coordinated release** - Patches and disclosures are coordinated
- **Credit** - Security researchers are credited (with permission)
- **No retaliation** - We appreciate security research and will not take legal action against researchers acting in good faith

### Security Checklist for Users

- [ ] Keep `logicstamp-context-mcp` updated to the latest version
- [ ] Keep `logicstamp-context` CLI updated
- [ ] Review MCP configuration files before use
- [ ] Only use with trusted MCP clients (Claude Code, Cursor, Claude Desktop)
- [ ] Run `npm audit` regularly if using from source
- [ ] Verify package integrity: `npm install` from official npm registry
- [ ] Review what code is being analyzed before running snapshots
- [ ] Be cautious with project paths in configurations

### Additional Resources

- [Model Context Protocol Security](https://modelcontextprotocol.io/security)
- [npm Security Best Practices](https://docs.npmjs.com/security-best-practices)
- [Node.js Security Checklist](https://nodejs.org/en/docs/guides/security/)

## Questions?

For security-related questions that are not vulnerabilities, please:
- Open a GitHub discussion
- Check existing issues
- Review the documentation in `docs/`

Thank you for helping keep LogicStamp Context MCP secure!

