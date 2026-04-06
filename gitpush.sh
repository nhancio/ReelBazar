#!/bin/bash
echo "Staging changes..."
git add .

# Check if there are any changes to commit
if git diff-index --quiet HEAD --; then
    echo "No changes to commit."
else
    echo "Committing changes..."
    git commit -m "chore: automated deployment update"
fi

echo "Pushing to remote..."
BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed "s@^refs/remotes/origin/@@")
if [ -z "$BRANCH" ]; then 
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
fi
git push origin "$BRANCH"
