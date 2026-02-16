# Publishing @clawdaq/skill to npm

## Pre-flight Checklist

```bash
cd /home/pranay5255/Documents/clawdaq/packages/skill

# 1. Verify package structure
find . -type f | grep -v node_modules | sort

# 2. Check package.json
cat package.json | jq .

# 3. Verify SKILL.md has YAML frontmatter
head -20 skill/SKILL.md

# 4. Test activation script
node skill/scripts/activate.js --help
```

## Step 1: npm Authentication

### Login to npm

```bash
# Login with your npm account
npm login

# Or if using 2FA
npm login --auth-type=web

# Verify you're logged in
npm whoami
```

### Set up npm token (alternative to login)

```bash
# If you have an npm token
npm config set //registry.npmjs.org/:_authToken YOUR_NPM_TOKEN

# Verify
npm config get //registry.npmjs.org/:_authToken
```

## Step 2: Pre-publish Checks

```bash
# Check what will be published
npm pack --dry-run

# This shows all files that will be included
# Should see:
# - bin/clawdaq.js
# - skill/SKILL.md
# - skill/scripts/activate.js
# - skill/references/API.md
# - README.md
# - package.json

# Verify no sensitive files are included
npm pack --dry-run | grep -E "(credentials|secrets|.env)"

# Should return nothing
```

## Step 3: Test Package Locally

```bash
# Create a test tarball
npm pack

# This creates: clawdaq-skill-2.0.0.tgz

# Test install in temp directory
mkdir -p /tmp/test-clawdaq
cd /tmp/test-clawdaq
npm install /home/pranay5255/Documents/clawdaq/packages/skill/clawdaq-skill-2.0.0.tgz

# Test the CLI
npx @clawdaq/skill help

# Verify skill structure
ls -la node_modules/@clawdaq/skill/skill/

# Clean up
cd /home/pranay5255/Documents/clawdaq/packages/skill
rm clawdaq-skill-2.0.0.tgz
rm -rf /tmp/test-clawdaq
```

## Step 4: Version Check

```bash
# Check current version
npm view @clawdaq/skill version

# If package doesn't exist yet, this will error (that's OK for first publish)

# Check your package.json version
jq -r .version package.json

# Should be 2.0.0
```

## Step 5: Publish to npm

### Dry run first (safe)

```bash
# Test publish without actually publishing
npm publish --dry-run

# Review output carefully
# Check that only expected files are included
```

### Actual publish

```bash
# Publish as public package
npm publish --access public

# With 2FA (if enabled)
npm publish --access public --otp=123456

# Output should show:
# + @clawdaq/skill@2.0.0
```

## Step 6: Verify Publication

```bash
# View package on npm
npm view @clawdaq/skill

# Check specific fields
npm view @clawdaq/skill version
npm view @clawdaq/skill description
npm view @clawdaq/skill keywords

# Visit package page
open https://www.npmjs.com/package/@clawdaq/skill
# Or: xdg-open https://www.npmjs.com/package/@clawdaq/skill

# Test installation from npm
mkdir -p /tmp/test-npm
cd /tmp/test-npm
npm install -g @clawdaq/skill@latest
clawdaq help
clawdaq status

# Clean up
npm uninstall -g @clawdaq/skill
cd /home/pranay5255/Documents/clawdaq/packages/skill
rm -rf /tmp/test-npm
```

## Step 7: Git Tag Release

```bash
cd /home/pranay5255/Documents/clawdaq

# Tag the release
git tag -a packages/skill/v2.0.0 -m "Release @clawdaq/skill v2.0.0 - Agent Skills standard compliance"

# Push tag
git push origin packages/skill/v2.0.0

# Or push all tags
git push --tags
```

## Troubleshooting

### Error: Need to login

```bash
npm login
npm whoami
```

### Error: Package name taken

```bash
# Check if package exists
npm view @clawdaq/skill

# If exists and you don't own it, you need to:
# 1. Use a different name in package.json
# 2. Or get added as maintainer
```

### Error: Version already published

```bash
# Bump version
npm version patch  # 2.0.0 -> 2.0.1
# Or
npm version minor  # 2.0.0 -> 2.1.0
# Or
npm version major  # 2.0.0 -> 3.0.0

# Then publish again
npm publish --access public
```

### Error: 402 Payment Required

```bash
# You're trying to publish a scoped private package
# Use --access public
npm publish --access public
```

### Files missing from package

```bash
# Check .npmignore
cat .npmignore

# Or .gitignore (npm uses it by default)
cat .gitignore

# Make sure files are listed in package.json "files" field
jq .files package.json
```

## Complete Publish Workflow

```bash
#!/bin/bash
# Complete publish script

set -e  # Exit on error

echo "📦 Publishing @clawdaq/skill to npm"
echo ""

# Navigate to package
cd /home/pranay5255/Documents/clawdaq/packages/skill

# Pre-flight checks
echo "✓ Checking package structure..."
[ -f skill/SKILL.md ] || { echo "❌ skill/SKILL.md not found"; exit 1; }
[ -f bin/clawdaq.js ] || { echo "❌ bin/clawdaq.js not found"; exit 1; }

echo "✓ Verifying npm authentication..."
npm whoami || { echo "❌ Not logged in to npm. Run: npm login"; exit 1; }

echo "✓ Running dry-run..."
npm publish --dry-run --access public

echo ""
read -p "🤔 Does the dry-run look correct? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Publish cancelled"
    exit 1
fi

echo "✓ Publishing to npm..."
npm publish --access public

VERSION=$(jq -r .version package.json)
echo ""
echo "🎉 Successfully published @clawdaq/skill@$VERSION"
echo ""
echo "📋 Next steps:"
echo "  1. Test: npm install -g @clawdaq/skill@latest"
echo "  2. Tag: git tag packages/skill/v$VERSION"
echo "  3. Push: git push --tags"
echo "  4. View: https://www.npmjs.com/package/@clawdaq/skill"
```

Save as `publish.sh`, make executable, and run:

```bash
chmod +x publish.sh
./publish.sh
```

## Post-Publish

### Update documentation

```bash
# Update main docs to reference new version
echo "Published v2.0.0" >> CHANGELOG.md

# Commit changes
git add package.json CHANGELOG.md
git commit -m "chore: publish @clawdaq/skill v2.0.0"
git push
```

### Announce

- Tweet about the release
- Post in Discord/Slack
- Update website docs
- Submit to Agent Skills registry

## Unpublish (if needed)

```bash
# Unpublish specific version (within 72 hours)
npm unpublish @clawdaq/skill@2.0.0

# Unpublish entire package (use with caution!)
npm unpublish @clawdaq/skill --force

# Deprecate version (preferred over unpublish)
npm deprecate @clawdaq/skill@2.0.0 "Deprecated. Use v2.0.1 instead."
```

## Summary Commands

```bash
# Quick publish
cd /home/pranay5255/Documents/clawdaq/packages/skill
npm login
npm publish --dry-run --access public  # Review first!
npm publish --access public             # Actual publish
npm view @clawdaq/skill                 # Verify

# Test
npm install -g @clawdaq/skill@latest
clawdaq help

# Tag release
git tag packages/skill/v2.0.0
git push --tags
```
