import re
import os

files_to_update = [
    "src/components/GoodsRequestsScreen.tsx",
    "src/components/CompaniesScreen.tsx",
    "src/components/EditUtilityModal.tsx",
    "src/components/ProjectManagementScreen.tsx",
    "src/components/WorkOrdersScreen.tsx",
    "src/components/LoginScreen.tsx",
    "src/components/AssetsScreen.tsx",
    "src/components/UtilityScreen.tsx",
    "src/components/PreventiveMaintenanceScreen.tsx",
    "src/components/SettingsScreen.tsx",
    "src/components/InventoryScreen.tsx",
    "src/components/WorkRequestsScreen.tsx",
    "src/components/ForumScreen.tsx",
    "src/components/UserManagementScreen.tsx"
]

print("Starting update...")

for filepath in files_to_update:
    if not os.path.exists(filepath):
        print(f"Skipping {filepath} (does not exist)")
        continue

    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Regex patterns to find `<input`, `<textarea`, and `<form` tags and inject the attributes if they don't already have them.
    # We want to match `<input` but not `<inputGroup` or similar, so we use `\b`.
    # We also check that it doesn't already contain `autoComplete=`.
    
    # 1. Update `<input`
    # Replace `<input` with `<input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"`
    # But only if it's not already having `autoComplete` or another of these attributes.
    def replace_input(match):
        tag = match.group(0)
        # Check if already has autocomplete
        if "autoComplete" in content or "autoCorrect" in content:
            # We will handle it with a general check per match if needed, but since we verified
            # no files have these attributes, it's safe to do simple replace.
            pass
        return tag + ' autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"'

    # Since none of the files contain autocomplete, we can do a direct safe regex replace.
    # To be extremely precise, we look for '<input' followed by word boundary
    modified = re.sub(r'<input\b', r'<input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"', content)
    modified = re.sub(r'<textarea\b', r'<textarea autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"', modified)
    modified = re.sub(r'<form\b', r'<form autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"', modified)

    if modified != content:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(modified)
        print(f"Updated: {filepath}")
    else:
        print(f"No changes needed for: {filepath}")

print("Update complete!")
