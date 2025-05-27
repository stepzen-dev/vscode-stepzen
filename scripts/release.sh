#!/bin/bash

# Copyright IBM Corp. 2025
# Assisted by CursorAI

# Release helper script for vscode-stepzen extension
# Usage: 
#   ./scripts/release.sh [version]           - Create release branch and bump version
#   ./scripts/release.sh --tag [version]     - Create and push tag after PR merge
# Examples: 
#   ./scripts/release.sh 0.1.3              - Start release process
#   ./scripts/release.sh --tag 0.1.3        - Complete release by creating tag

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

print_step() {
    echo -e "${BLUE}🔄 $1${NC}"
}

# Function to create and push tag
create_and_push_tag() {
    local version=$1
    
    # Validate we're on main and up to date
    CURRENT_BRANCH=$(git branch --show-current)
    if [ "$CURRENT_BRANCH" != "main" ]; then
        print_error "Must be on main branch to create release tag"
        print_info "Run: git checkout main && git pull origin main"
        exit 1
    fi
    
    # Check if working directory is clean
    if ! git diff-index --quiet HEAD --; then
        print_error "Working directory is not clean. Please commit or stash your changes."
        exit 1
    fi
    
    # Validate package.json version matches
    PACKAGE_VERSION=$(node -p "require('./package.json').version")
    if [ "$PACKAGE_VERSION" != "$version" ]; then
        print_error "Package.json version ($PACKAGE_VERSION) doesn't match requested tag version ($version)"
        print_info "Make sure the version bump PR has been merged to main"
        exit 1
    fi
    
    # Check if tag already exists
    if git tag -l "v$version" | grep -q "v$version"; then
        print_error "Tag v$version already exists"
        exit 1
    fi
    
    print_step "Creating and pushing tag v$version..."
    git tag "v$version"
    git push origin "v$version"
    
    print_info "✅ Tag v$version created and pushed successfully!"
    print_info "🚀 GitHub Actions will now build and package the release"
    print_info "📦 Check the Actions tab for build progress: https://github.com/stepzen-dev/vscode-stepzen/actions"
    
    return 0
}

# Handle --tag flag for post-merge tag creation
if [ "$1" = "--tag" ]; then
    if [ $# -ne 2 ]; then
        print_error "Usage: $0 --tag <version>"
        print_info "Example: $0 --tag 0.1.3"
        exit 1
    fi
    create_and_push_tag "$2"
    exit 0
fi

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
    print_warning "1. Create a release branch: git checkout -b release/v\$NEW_VERSION"
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

print_step "Updating version to $NEW_VERSION..."

# Update package.json version
npm version $NEW_VERSION --no-git-tag-version

# Run tests and linting (build will happen in CI)
print_step "Running tests and linting..."
npm run ci:lint

# Commit the version change
git add package.json package-lock.json
git commit -m "chore(release): bump version to $NEW_VERSION"

print_info "✅ Version bump committed successfully!"

# Provide next steps based on current branch
if [ "$CURRENT_BRANCH" = "main" ]; then
    # Direct to main workflow (not recommended with branch protection)
    print_step "Creating tag v$NEW_VERSION..."
    git tag "v$NEW_VERSION"
    
    print_warning "Ready to push. Run the following commands to complete the release:"
    echo ""
    echo "  git push origin main"
    echo "  git push origin v$NEW_VERSION"
    echo ""
else
    # Branch-based workflow (recommended)
    print_info "🎯 Next steps for release branch workflow:"
    echo ""
    echo "  1. Push the release branch:"
    echo "     ${BLUE}git push origin $CURRENT_BRANCH${NC}"
    echo ""
    echo "  2. Create a Pull Request to merge into main"
    echo ""
    echo "  3. After PR is merged, create and push the tag:"
    echo "     ${BLUE}git checkout main && git pull origin main${NC}"
    echo "     ${BLUE}$0 --tag $NEW_VERSION${NC}"
    echo ""
    echo "  ${GREEN}💡 Pro tip: The --tag flag automates step 3 for you!${NC}"
fi

print_info "🚀 The GitHub Actions workflow will automatically build and package the extension when the tag is pushed." 