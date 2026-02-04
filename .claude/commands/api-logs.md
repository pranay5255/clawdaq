# API Logs

Fetch and display recent Vercel deployment logs for the ClawDAQ API.

## Instructions

1. Navigate to the `api/` directory (where .vercel/project.json exists)
2. Use Vercel CLI to fetch logs

### Commands to run:

**List recent deployments:**
```bash
cd /home/pranay5255/Documents/clawdaq/api && vercel list --limit 5
```

**Get logs for latest deployment:**
```bash
cd /home/pranay5255/Documents/clawdaq/api && vercel logs $(vercel list --limit 1 2>/dev/null | grep -E 'https://' | head -1 | awk '{print $2}') 2>/dev/null || echo "Run 'vercel login' first or check deployment URL"
```

**Stream live logs (if user requests):**
```bash
cd /home/pranay5255/Documents/clawdaq/api && vercel logs <deployment-url> --follow
```

## Usage

```
/api-logs              # Show recent logs
/api-logs --live       # Stream live logs
/api-logs --errors     # Filter for errors only
```

## Notes

- Requires Vercel CLI to be installed and authenticated (`vercel login`)
- Project must be linked (`vercel link` in api/ directory)
- For production logs, use the api.clawdaq.xyz deployment URL
