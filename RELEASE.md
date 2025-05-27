<!--
Copyright IBM Corp. 2025
Assisted by CursorAI
-->

# Release Process

This document describes how to create releases for the VSCode StepZen extension.

## Overview

The extension uses automated release workflows that:

- ✅ Validate that git tags match the version in `package.json`
- ✅ Build and package the extension automatically
- ✅ Upload VSIX artifacts for distribution
- ✅ Optionally publish to the VS Code Marketplace

## Quick Release (Recommended)

### For Repositories with Branch Protection

The recommended workflow for repositories with branch protection enabled:

```bash
# 1. Create a release branch
git checkout -b release/v0.1.3

# 2. Run the release script
npm run release
# Or specify version directly: ./scripts/release.sh 0.1.3

# 3. Push the release branch
git push origin release/v0.1.3

# 4. Create a Pull Request to merge into main
# 5. After PR is merged, create and push the tag:
git checkout main
git pull origin main
./scripts/release.sh --tag 0.1.3
```

**💡 Pro tip**: The `--tag` flag automates the tag creation and push, ensuring the release workflow triggers correctly.

### For Direct Main Access

If you have direct push access to main:

```bash
# Interactive mode (prompts for version)
npm run release

# Or specify version directly
./scripts/release.sh 0.1.3
```

The script will:

1. Validate the new version format
2. Update `package.json` and `package-lock.json`
3. Run linting and compilation checks
4. Commit the version change
5. Create a git tag (if on main) or provide PR workflow instructions
6. Provide instructions for pushing

## Manual Release Process

If you prefer to handle the release manually:

### 1. Update Version

```bash
# Update package.json version (this also updates package-lock.json)
npm version 0.1.3 --no-git-tag-version
```

### 2. Validate and Test

```bash
# Run all checks
npm run ci:lint
npm run compile

# Optional: Test packaging locally (requires publisher field in package.json)
npx @vscode/vsce package --no-yarn
```

### 3. Commit and Tag

```bash
# Commit version changes
git add package.json package-lock.json
git commit -m "chore(release): bump version to 0.1.3"

# Create tag (must match package.json version exactly)
git tag v0.1.3
```

### 4. Push Release

```bash
# Push commits and tags
git push origin main
git push origin v0.1.3
```

## Version Validation

The release workflow automatically validates that:

- The git tag format is `v{version}` (e.g., `v0.1.3`)
- The tag version matches the version in `package.json` exactly
- If validation fails, the workflow stops and no artifacts are created

### Example Validation

```
✅ Tag: v0.1.3, Package: 0.1.3 → Valid
❌ Tag: v0.1.3, Package: 0.1.2 → Invalid (mismatch)
❌ Tag: 0.1.3, Package: 0.1.3 → Invalid (missing 'v' prefix)
❌ Tag: v1.0, Package: 1.0.0 → Invalid (incomplete version)
```

## Automated Workflow

When you push a tag matching `v*`, the GitHub Actions workflow will:

1. **Validate** tag matches package.json version
2. **Build** on Node.js 18.x and 20.x
3. **Package** the extension into VSIX files
4. **Upload** artifacts to GitHub Actions (30-day retention)
5. **Publish** to marketplace (if `VSCE_PAT` secret is configured)

## Publisher Configuration

The extension requires a `publisher` field in `package.json` for packaging. Currently set to `stepzen-dev` for development builds.

### For Development/Internal Releases

- Keep `"publisher": "stepzen-dev"` for internal testing and development
- VSIX files can be installed manually via "Install from VSIX..." in VS Code

### For Official IBM Publishing

When ready for official IBM marketplace publishing:

1. Update `package.json` publisher to the official IBM publisher ID
2. Generate a Personal Access Token from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage)
3. Add it as a repository secret named `VSCE_PAT`
4. Uncomment the publish step in `.github/workflows/release.yml`

## Marketplace Publishing

To enable automatic marketplace publishing:

1. Generate a Personal Access Token from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage)
2. Add it as a repository secret named `VSCE_PAT`
3. Uncomment the publish step in `.github/workflows/release.yml`

## Versioning Guidelines

Follow [Semantic Versioning](https://semver.org/):

- **Patch** (0.1.2 → 0.1.3): Bug fixes, minor improvements
- **Minor** (0.1.3 → 0.2.0): New features, backward compatible
- **Major** (0.2.0 → 1.0.0): Breaking changes

## Troubleshooting

### Release Workflow Not Triggering

If you merged a version bump PR but the release workflow didn't run:

```bash
# Check if the tag exists
git tag --list | grep v0.1.3

# If no tag exists, create it (ensure you're on main with latest changes)
git checkout main && git pull origin main
./scripts/release.sh --tag 0.1.3
```

**Root cause**: The release workflow only triggers on tag pushes (`v*`), not on regular commits or PR merges.

### Version Mismatch Error

If the workflow fails with a version mismatch:

```bash
# Check current versions
git describe --tags --abbrev=0  # Latest tag
node -p "require('./package.json').version"  # Package version

# Fix by updating package.json or creating correct tag
npm version 0.1.3 --no-git-tag-version
git add package.json package-lock.json
git commit -m "fix: correct version to match tag"
```

### Failed Build

If compilation fails:

```bash
# Run the same checks locally
npm run ci:lint
npm run compile

# Fix any issues and commit
git add .
git commit -m "fix: resolve build issues"
```

### Artifact Download

To download VSIX files from a release:

1. Go to the [Actions tab](https://github.com/stepzen-dev/vscode-stepzen/actions)
2. Click on the release workflow run
3. Download artifacts from the "Artifacts" section

---

_Portions of the Content may be generated with the assistance of CursorAI_
