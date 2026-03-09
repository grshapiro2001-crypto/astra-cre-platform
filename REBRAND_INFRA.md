# Talisman IO — Infrastructure Rebrand Checklist

## Domain
- [ ] Purchase talisman.io (or confirm ownership)
- [ ] Configure DNS for Vercel deployment
- [ ] Set up SSL certificate
- [ ] Add domain to Vercel project settings
- [ ] Update CORS allowed origins in backend to include talisman.io
- [ ] Set up redirect from old domain if applicable

## Vercel
- [ ] Rename project from astra-cre-* to talisman-io
- [ ] Update environment variables if any reference "astra"
- [ ] Update deployment URL in README

## Render
- [ ] Rename service from astra-cre-* to talisman-io
- [ ] Update environment variables if any reference "astra"
- [ ] Update CORS_ORIGINS env var to include talisman.io domain

## GitHub
- [ ] Rename repository: astra-cre-platform → talisman-io (or talisman-platform)
- [ ] Update all remote URLs locally after rename
- [ ] Update any GitHub Actions workflow references

## External Services
- [ ] Update Anthropic API webhook URLs if configured
- [ ] Update any OAuth redirect URIs
- [ ] Update Google Maps API key domain restrictions
- [ ] Update any monitoring/logging service names
