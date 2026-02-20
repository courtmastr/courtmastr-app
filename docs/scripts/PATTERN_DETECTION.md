# Pattern Detection Script

## Overview

The `detect-patterns.sh` script scans the CourtMaster codebase for violations of three critical coding patterns:

- **CP-016**: Inline `v-dialog` blocks (should use `BaseDialog` component)
- **CP-017**: Inline empty state markup (should use `EmptyState` component)
- **CP-018**: Manual async state management (should use `useAsyncOperation` composable)

## Usage

### Basic Usage

```bash
./scripts/detect-patterns.sh
```

### Output

The script generates a formatted report showing:

1. **Per-pattern violations** with file paths and line numbers
2. **Summary statistics** with total violation counts
3. **Exit code** (0 = compliant, 1 = violations found)

### Example Output

```
=== CourtMaster Pattern Detection Report ===
Generated: Tue Feb 17 21:39:42 CST 2026
Project: /Users/ramc/Documents/Code/courtmaster-v2

=== CP-016: Inline v-dialog (should use BaseDialog) ===
Pattern: Inline <v-dialog> blocks that should use <BaseDialog> component

✗ Found violations:
  src/features/registration/views/RegistrationManagementView.vue:1495
  src/features/registration/views/RegistrationManagementView.vue:1555
  ...

=== Summary ===

CP-016 (Inline v-dialog):              38 violations
CP-017 (Inline empty states):          22 violations
CP-018 (Manual async):                 41 violations

Total violations:                101

⚠ Found 101 violations. Review and refactor as needed.
```

## Pattern Details

### CP-016: Inline v-dialog → BaseDialog

**Detection**: Searches for `<v-dialog` tags not using `BaseDialog` component

**Why**: Standardized dialog component ensures consistent styling, behavior, and accessibility

**Migration**: Replace inline `v-dialog` blocks with `<BaseDialog>` component

```vue
<!-- ❌ Before -->
<v-dialog v-model="showDialog" max-width="600">
  <v-card>
    <v-card-title>Title</v-card-title>
    <v-card-text>Content</v-card-text>
    <v-card-actions>
      <v-btn @click="showDialog = false">Cancel</v-btn>
      <v-btn @click="save">Save</v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>

<!-- ✅ After -->
<BaseDialog
  v-model="showDialog"
  title="Title"
  @confirm="save"
>
  <v-text-field v-model="form.name" label="Name" />
</BaseDialog>
```

**See**: [docs/coding-patterns/CODING_PATTERNS.md#cp-016](../coding-patterns/CODING_PATTERNS.md#cp-016)

---

### CP-017: Inline Empty States → EmptyState

**Detection**: Searches for `text-center py-8` class pattern (common empty state markup)

**Why**: Standardized empty state component ensures consistent messaging and actions

**Migration**: Replace inline empty state markup with `<EmptyState>` component

```vue
<!-- ❌ Before -->
<v-card-text class="text-center py-8">
  <v-icon size="48" color="grey-lighten-1">mdi-folder-open</v-icon>
  <p class="text-body-2 text-grey mt-2">No items</p>
</v-card-text>

<!-- ✅ After -->
<EmptyState
  title="No categories yet"
  message="Add your first category to get started"
  :action="{ label: 'Add Category', handler: openAddDialog }"
/>
```

**See**: [docs/coding-patterns/CODING_PATTERNS.md#cp-017](../coding-patterns/CODING_PATTERNS.md#cp-017)

---

### CP-018: Manual Async → useAsyncOperation

**Detection**: Searches for `loading.value = true` patterns not using `useAsyncOperation`

**Why**: Centralized async operation composable reduces boilerplate and ensures consistent error handling

**Migration**: Replace manual async state with `useAsyncOperation` composable

```typescript
// ❌ Before
const loading = ref(false);
const error = ref<string | null>(null);

async function save() {
  loading.value = true;
  error.value = null;
  try {
    await store.save();
  } catch (err) {
    error.value = 'Failed';
  } finally {
    loading.value = false;
  }
}

// ✅ After
const { loading, error, execute } = useAsyncOperation();

async function save() {
  await execute(() => store.save());
}
```

**See**: [docs/coding-patterns/CODING_PATTERNS.md#cp-018](../coding-patterns/CODING_PATTERNS.md#cp-018)

---

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Pattern Detection

on: [pull_request]

jobs:
  patterns:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run pattern detection
        run: ./scripts/detect-patterns.sh
```

### Pre-commit Hook

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
./scripts/detect-patterns.sh
if [ $? -ne 0 ]; then
  echo "Pattern violations detected. Please fix before committing."
  exit 1
fi
```

---

## Refactoring Workflow

### Step 1: Run Detection

```bash
./scripts/detect-patterns.sh > pattern-report.txt
```

### Step 2: Prioritize Violations

- **High Priority**: CP-016 (dialog consistency) and CP-018 (async consistency)
- **Medium Priority**: CP-017 (empty state consistency)

### Step 3: Refactor by File

```bash
# Example: Fix RegistrationManagementView.vue
# 1. Replace all v-dialog blocks with BaseDialog
# 2. Replace all text-center py-8 with EmptyState
# 3. Replace all manual async with useAsyncOperation
```

### Step 4: Verify

```bash
./scripts/detect-patterns.sh
# Should show fewer violations
```

---

## Troubleshooting

### Script Not Executable

```bash
chmod +x ./scripts/detect-patterns.sh
```

### False Positives

The script may flag:
- Comments containing pattern keywords (filtered with `grep -v "// "`)
- Intentional exceptions (add `<!-- CP-016-EXCEPTION -->` comment)

### Performance

For large codebases, the script may take 5-10 seconds. This is normal.

---

## Maintenance

### Adding New Patterns

To add detection for a new pattern (e.g., CP-019):

1. Add a new section in `detect-patterns.sh`
2. Define the grep pattern
3. Update the summary section
4. Test with `./scripts/detect-patterns.sh`

### Updating Detection Logic

If a pattern's detection needs refinement:

1. Edit the grep pattern in the script
2. Test with sample violations
3. Update this documentation

---

## Related Documentation

- [Coding Patterns Guide](../coding-patterns/CODING_PATTERNS.md)
- [BaseDialog Component](../ui-patterns/base-dialog.md)
- [EmptyState Component](../ui-patterns/empty-state.md)
- [useAsyncOperation Composable](../ui-patterns/use-async-operation.md)

---

*Last Updated: 2026-02-18*
