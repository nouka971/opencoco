# VPS reset checklist

1. Reinstall the VPS or rebuild it from a clean image.
2. Create a dedicated `opencoco` user with no password login.
3. Rotate all SSH keys and remove legacy authorized keys.
4. Install Node.js 20, npm, git, and PM2.
5. Clone the private repo into `/opt/opencoco/repo`.
6. Place `.env` only on the VPS and restrict it to the deploy user.
7. Create `/opt/opencoco/releases` and `/opt/opencoco/current`.
8. Add GitHub Actions deploy secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_PRIVATE_KEY`.
9. Run the first deploy manually before enabling automatic deploys.
