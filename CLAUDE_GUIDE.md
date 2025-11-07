# Claude Code Quick Reference

## Start Session
```bash
cd /Users/valtoosh/zkult
claude-code --context project-plan.xml
```

## Common Tasks
```bash
# Fix bug
claude-code fix "Description of bug"

# Add feature
claude-code task "Add feature as per project-plan.xml Phase X"

# Review code
claude-code review path/to/file.js

# Ask question
claude-code ask "How does X work?"
```

## Git Workflow
```bash
# Daily backup
./backup.sh

# Feature work
git checkout -b feature/name
# ... make changes ...
git add .
git commit -m "feat: Description"
git push origin feature/name

# Merge to main
git checkout main
git merge feature/name
git push origin main
```

## Emergency Recovery
```bash
# Restore from backup tag
git checkout backup-YYYYMMDD-HHMMSS

# Restore specific file
git checkout HEAD~1 path/to/file

# See all backups
git tag | grep backup
```