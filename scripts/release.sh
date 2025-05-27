#!/bin/bash

# Copyright IBM Corp. 2025
# Assisted by CursorAI

# Release helper script for vscode-stepzen extension
# Usage: ./scripts/release.sh [version]
# Example: ./scripts/release.sh 0.1.3

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not in a git repository"
    exit 1
fi

# Check if working directory is clean
if ! git diff-index --quiet HEAD --; then
    print_error "Working directory is not clean. Please commit or stash your changes."
    exit 1
fi

# Check if we're on main branch (for branch protection workflow)
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" = "main" ]; then
    print_warning "You're on the main branch. For repositories with branch protection:"
    print_warning "1. Create a release branch: git checkout -b release/v$NEW_VERSION"
    print_warning "2. Run this script again from the release branch"
    print_warning "3. Push the branch and create a PR"
    echo ""
    echo -n "Continue anyway? (y/N): "
    read CONTINUE
    if [[ ! $CONTINUE =~ ^[Yy]$ ]]; then
        print_info "Exiting. Create a release branch first."
        exit 0
    fi
fi

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
print_info "Current version: $CURRENT_VERSION"

# If version is provided as argument, use it; otherwise prompt
if [ $# -eq 1 ]; then
    NEW_VERSION=$1
else
    echo -n "Enter new version (current: $CURRENT_VERSION): "
    read NEW_VERSION
fi

# Validate version format (basic semver check)
if ! [[ $NEW_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?$ ]]; then
    print_error "Invalid version format. Please use semantic versioning (e.g., 1.0.0)"
    exit 1
fi

# Check if tag already exists
if git tag -l "v$NEW_VERSION" | grep -q "v$NEW_VERSION"; then
    print_error "Tag v$NEW_VERSION already exists"
    exit 1
fi

print_info "Updating version to $NEW_VERSION..."

# Update package.json version
npm version $NEW_VERSION --no-git-tag-version

# Run tests and linting (build will happen in CI)
print_info "Running tests and linting..."
npm run ci:lint

# Commit the version change
git add package.json package-lock.json
git commit -m "chore(release): bump version to $NEW_VERSION"

print_info "Version bump committed successfully!"

# Provide next steps based on current branch
if [ "$CURRENT_BRANCH" = "main" ]; then
    # Direct to main workflow (not recommended with branch protection)
    print_info "Creating tag v$NEW_VERSION..."
    git tag "v$NEW_VERSION"
    
    print_warning "Ready to push. Run the following commands to complete the release:"
    echo ""
    echo "  git push origin main"
    echo "  git push origin v$NEW_VERSION"
    echo ""
else
    # Branch-based workflow (recommended)
    print_warning "Next steps for release branch workflow:"
    echo ""
    echo "  1. Push the release branch:"
    echo "     git push origin $CURRENT_BRANCH"
    echo ""
    echo "  2. Create a Pull Request to merge into main"
    echo ""
    echo "  3. After PR is merged, create and push the tag:"
    echo "     git checkout main"
    echo "     git pull origin main"
    echo "     git tag v$NEW_VERSION"
    echo "     git push origin v$NEW_VERSION"
    echo ""
fi

print_info "The GitHub Actions workflow will automatically build and package the extension when the tag is pushed." 